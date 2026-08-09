import request from 'supertest';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { app } from './helpers/app';
import { createUserWithRole, authHeader, makeLinkedEmployeeUser } from './helpers/auth';
import { makeDepartment, makeSchedule, makeShift, makeEmployee, makeCertification } from './helpers/factories';
import { Attendance } from '../src/models/Attendance.model';
import { Employee } from '../src/models/Employee.model';
import { LeaveRequest } from '../src/models/LeaveRequest.model';
import { ShiftAssignment } from '../src/models/ShiftAssignment.model';
import { ASSISTANT_TOOLS, stripSensitive } from '../src/services/assistant/tools';
import { __setAnthropicClientForTests } from '../src/services/assistant/anthropicClient';

/**
 * A scripted stand-in for the model.
 *
 * Every turn is pre-written, so these tests assert what the *backend* does with
 * a given sequence of tool calls rather than what a model happens to choose.
 * That is the only way to prove the scoping and salary guarantees hold through
 * the loop: a real model might simply never ask for another department's data,
 * which would make the test pass for the wrong reason.
 */
type ScriptedTurn =
  | { kind: 'tool_use'; name: string; input: unknown }
  | { kind: 'text'; text: string };

interface Recorded {
  system: string;
  toolNames: string[];
  toolResults: unknown[];
}

function scriptedClient(turns: ScriptedTurn[], recorded: Recorded) {
  let turnIndex = 0;

  return {
    messages: {
      create: async (params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
        recorded.system = String(params.system ?? '');
        recorded.toolNames = (params.tools ?? []).map((tool) => (tool as { name: string }).name);

        // Capture what the previous tool call actually returned to the model.
        const last = params.messages[params.messages.length - 1];
        if (last && last.role === 'user' && Array.isArray(last.content)) {
          for (const block of last.content) {
            if ((block as { type: string }).type === 'tool_result') {
              recorded.toolResults.push(JSON.parse(String((block as { content: string }).content)));
            }
          }
        }

        const turn = turns[Math.min(turnIndex, turns.length - 1)];
        turnIndex += 1;

        const content: Anthropic.ContentBlock[] =
          turn.kind === 'tool_use'
            ? [
                {
                  type: 'tool_use',
                  id: `toolu_${turnIndex}`,
                  name: turn.name,
                  input: turn.input,
                } as Anthropic.ToolUseBlock,
              ]
            : [{ type: 'text', text: turn.text, citations: null } as unknown as Anthropic.TextBlock];

        return {
          id: `msg_${turnIndex}`,
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          content,
          stop_reason: turn.kind === 'tool_use' ? 'tool_use' : 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        } as unknown as Anthropic.Message;
      },
    },
  } as unknown as Anthropic;
}

function install(turns: ScriptedTurn[]): Recorded {
  const recorded: Recorded = { system: '', toolNames: [], toolResults: [] };
  __setAnthropicClientForTests(scriptedClient(turns, recorded));
  return recorded;
}

afterEach(() => {
  __setAnthropicClientForTests(null);
});

describe('AI Assistant — the tool set is structurally read-only', () => {
  // These are the constraints that must hold no matter what the model does, so
  // they are asserted against the tool registry itself rather than against a
  // conversation. A future tool that breaks one of them fails here.

  it('exposes no tool whose name implies a write', () => {
    const writeVerbs = /^(create|add|update|edit|set|delete|remove|publish|approve|reject|assign|generate|send|cancel|import|save)/;
    const offenders = ASSISTANT_TOOLS.filter((tool) => writeVerbs.test(tool.name));
    expect(offenders.map((t) => t.name)).toEqual([]);
  });

  it('exposes no generic query escape hatch', () => {
    // Every tool must be a named question with a fixed argument shape. A field
    // that accepts free-form query text, a collection name, or an aggregation
    // pipeline would let the model reach data no reviewer ever approved.
    const escapeHatch = /^(query|sql|filter|pipeline|aggregate|collection|model|find|where|raw|mongo|expression)$/i;

    for (const tool of ASSISTANT_TOOLS) {
      const schema = z.toJSONSchema(tool.schema, { io: 'input' }) as {
        properties?: Record<string, unknown>;
      };
      const fields = Object.keys(schema.properties ?? {});
      expect({ tool: tool.name, offending: fields.filter((f) => escapeHatch.test(f)) }).toEqual({
        tool: tool.name,
        offending: [],
      });
    }
  });

  it('strips compensation fields from any assembled result', () => {
    const scrubbed = stripSensitive({
      name: 'Ada Nurse',
      salary: 90000,
      nested: [{ hourlyRate: 42, overtimeHours: 6 }],
      overtimeHours: 12,
    });

    expect(JSON.stringify(scrubbed)).not.toMatch(/salary|hourlyRate|90000|42/);
    expect(scrubbed).toEqual({ name: 'Ada Nurse', nested: [{ overtimeHours: 6 }], overtimeHours: 12 });
  });
});

describe('AI Assistant — permission gate', () => {
  it('denies an Employee-role account', async () => {
    const { accessToken } = await makeLinkedEmployeeUser();

    const ask = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: 'Who worked the most overtime this month?' });
    expect(ask.status).toBe(403);

    const capabilities = await request(app)
      .get('/api/v1/assistant/capabilities')
      .set(authHeader(accessToken));
    expect(capabilities.status).toBe(403);
  });

  it('denies a Shift Coordinator, who holds neither report:view nor analytics:view', async () => {
    const { accessToken } = await createUserWithRole('shift_coordinator');

    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: 'Which department is understaffed?' });

    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/assistant/ask').send({ question: 'Anything' });
    expect(res.status).toBe(401);
  });
});

describe('AI Assistant — a manager gets a grounded answer', () => {
  it('answers an overtime question from real attendance data', async () => {
    const department = await makeDepartment({ name: 'Intensive Care' });
    const busy = await makeEmployee({ firstName: 'Ada', lastName: 'Nurse', department: department.id } as never);
    const quiet = await makeEmployee({ firstName: 'Ben', lastName: 'Medic', department: department.id } as never);

    await Attendance.create({
      employee: busy.id,
      date: new Date('2030-03-04'),
      status: 'overtime',
      totalHoursWorked: 12,
      overtimeHours: 4,
    });
    await Attendance.create({
      employee: quiet.id,
      date: new Date('2030-03-04'),
      status: 'overtime',
      totalHoursWorked: 9,
      overtimeHours: 1,
    });

    const recorded = install([
      { kind: 'tool_use', name: 'list_departments', input: {} },
      {
        kind: 'tool_use',
        name: 'get_overtime_summary',
        input: { department: department.id, dateFrom: '2030-03-01', dateTo: '2030-03-31' },
      },
      { kind: 'text', text: 'Ada Nurse worked the most overtime in Intensive Care in March 2030, at 4 hours.' },
    ]);

    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: 'Who worked the most overtime in Intensive Care this March?' });

    expect(res.status).toBe(200);
    expect(res.body.data.answer).toContain('Ada Nurse');
    expect(res.body.data.scope).toBe('hospital');
    expect(res.body.data.toolCalls.map((c: { tool: string }) => c.tool)).toEqual([
      'list_departments',
      'get_overtime_summary',
    ]);

    // The answer is grounded: the figures it cites came back from a real query.
    const overtime = recorded.toolResults[1] as {
      totalOvertimeHours: number;
      topEmployees: { name: string; overtimeHours: number }[];
    };
    expect(overtime.totalOvertimeHours).toBe(5);
    expect(overtime.topEmployees[0]).toMatchObject({ name: 'Ada Nurse', overtimeHours: 4 });
  });

  it('reaches several tools across one conversation', async () => {
    const department = await makeDepartment({ name: 'Cardiology' });
    const schedule = await makeSchedule({ department: department.id });
    await makeShift({
      schedule: schedule.id,
      department: department.id,
      date: new Date('2030-06-10'),
      requiredStaff: 3,
    });
    const employee = await makeEmployee({ department: department.id } as never);
    await LeaveRequest.create({
      employee: employee.id,
      leaveType: 'vacation',
      startDate: new Date('2030-06-09'),
      endDate: new Date('2030-06-12'),
      totalDays: 4,
      status: 'approved',
    });

    const recorded = install([
      {
        kind: 'tool_use',
        name: 'get_staffing_levels',
        input: { department: department.id, dateFrom: '2030-06-01', dateTo: '2030-06-30' },
      },
      {
        kind: 'tool_use',
        name: 'get_upcoming_leave',
        input: { department: department.id, dateFrom: '2030-06-01', dateTo: '2030-06-30' },
      },
      { kind: 'tool_use', name: 'get_expiring_certifications', input: { department: department.id, withinDays: 60 } },
      { kind: 'text', text: 'Cardiology is short 3 people on 10 June, with one nurse on approved vacation.' },
    ]);

    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: 'Is Cardiology covered in June?' });

    expect(res.status).toBe(200);
    expect(res.body.data.toolCalls).toHaveLength(3);
    expect(res.body.data.toolCalls.every((c: { ok: boolean }) => c.ok)).toBe(true);

    const staffing = recorded.toolResults[0] as {
      openPositions: number;
      understaffedShifts: { shortBy: number }[];
    };
    expect(staffing.openPositions).toBe(3);
    expect(staffing.understaffedShifts[0].shortBy).toBe(3);

    const leave = recorded.toolResults[1] as { requestCount: number };
    expect(leave.requestCount).toBe(1);
  });

  it('explains why an employee could not be assigned to a shift', async () => {
    const department = await makeDepartment({ name: 'Emergency' });
    const schedule = await makeSchedule({ department: department.id });
    const certification = await makeCertification({ name: 'ACLS' });

    const shift = await makeShift({
      schedule: schedule.id,
      department: department.id,
      date: new Date('2030-07-02'),
      requiredStaff: 2,
      requiredCertifications: [certification._id],
    } as never);

    const onLeave = await makeEmployee({
      firstName: 'Cara',
      lastName: 'Onleave',
      department: department.id,
      certifications: [{ certification: certification._id }],
    } as never);
    await LeaveRequest.create({
      employee: onLeave.id,
      leaveType: 'sick',
      startDate: new Date('2030-07-01'),
      endDate: new Date('2030-07-03'),
      totalDays: 3,
      status: 'approved',
    });

    await makeEmployee({
      firstName: 'Dan',
      lastName: 'Uncertified',
      department: department.id,
      certifications: [],
    } as never);

    const recorded = install([
      { kind: 'tool_use', name: 'explain_shift_staffing', input: { shiftId: shift.id } },
      { kind: 'text', text: 'Cara Onleave is on approved sick leave and Dan Uncertified is missing ACLS.' },
    ]);

    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: 'Why is the 2 July emergency night shift short?' });

    expect(res.status).toBe(200);

    const diagnostics = recorded.toolResults[0] as {
      shortBy: number;
      candidates: { name: string; eligibility: string; detail?: string }[];
    };
    expect(diagnostics.shortBy).toBe(2);

    const cara = diagnostics.candidates.find((c) => c.name === 'Cara Onleave');
    const dan = diagnostics.candidates.find((c) => c.name === 'Dan Uncertified');
    expect(cara?.eligibility).toBe('on_approved_leave');
    expect(dan?.eligibility).toBe('missing_required_certification');
    expect(dan?.detail).toContain('ACLS');
  });
});

describe('AI Assistant — department scoping is enforced server-side', () => {
  /**
   * The scenario the whole scoping design exists for: a Department Head asks
   * about a department that is not theirs. The model is *told* to ask for the
   * other department — the point is that asking gets it nowhere.
   */
  async function twoDepartments() {
    const mine = await makeDepartment({ name: 'Oncology' });
    const theirs = await makeDepartment({ name: 'Neurology' });

    const mineEmployee = await makeEmployee({ firstName: 'Mine', department: mine.id } as never);
    const theirsEmployee = await makeEmployee({ firstName: 'Theirs', department: theirs.id } as never);

    await Attendance.create({
      employee: mineEmployee.id,
      date: new Date('2030-04-02'),
      status: 'overtime',
      totalHoursWorked: 10,
      overtimeHours: 2,
    });
    await Attendance.create({
      employee: theirsEmployee.id,
      date: new Date('2030-04-02'),
      status: 'overtime',
      totalHoursWorked: 20,
      overtimeHours: 12,
    });

    const head = await makeLinkedEmployeeUser({ department: mine.id } as never, 'department_head');
    return { mine, theirs, head };
  }

  it('pins a Department Head to their own department and says so', async () => {
    const { mine, theirs, head } = await twoDepartments();

    const recorded = install([
      // The model asks for Neurology. It gets Oncology.
      {
        kind: 'tool_use',
        name: 'get_overtime_summary',
        input: { department: theirs.id, dateFrom: '2030-04-01', dateTo: '2030-04-30' },
      },
      { kind: 'text', text: 'These figures are for Oncology, the only department you can see.' },
    ]);

    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(head.accessToken))
      .send({ question: 'How much overtime did Neurology work in April?' });

    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe('department');
    expect(res.body.data.departmentName).toBe('Oncology');

    const overtime = recorded.toolResults[0] as {
      totalOvertimeHours: number;
      topEmployees: { name: string; department: string }[];
      scopeNote?: string;
    };

    // Oncology's 2 hours, not Neurology's 12.
    expect(overtime.totalOvertimeHours).toBe(2);
    expect(overtime.topEmployees.every((e) => e.department === mine.name)).toBe(true);
    expect(overtime.scopeNote).toContain('Oncology');
  });

  it('shows a Department Head only their own department in list_departments', async () => {
    const { mine, head } = await twoDepartments();

    const recorded = install([
      { kind: 'tool_use', name: 'list_departments', input: {} },
      { kind: 'text', text: 'You can ask about Oncology.' },
    ]);

    await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(head.accessToken))
      .send({ question: 'What departments can I ask about?' });

    const departments = recorded.toolResults[0] as { name: string }[];
    expect(departments.map((d) => d.name)).toEqual([mine.name]);
  });

  it('will not open another department\'s shift by id', async () => {
    const { theirs, head } = await twoDepartments();
    const schedule = await makeSchedule({ department: theirs.id });
    const foreignShift = await makeShift({
      schedule: schedule.id,
      department: theirs.id,
      date: new Date('2030-04-05'),
      requiredStaff: 4,
    });

    const recorded = install([
      { kind: 'tool_use', name: 'explain_shift_staffing', input: { shiftId: foreignShift.id } },
      { kind: 'text', text: 'I could not find that shift in your department.' },
    ]);

    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(head.accessToken))
      .send({ question: `Why is shift ${foreignShift.id} short?` });

    expect(res.status).toBe(200);
    expect(res.body.data.toolCalls[0].ok).toBe(false);
    expect(recorded.toolResults[0]).toEqual({ error: 'No shift with that id in your department' });
  });

  it('lets an HR Manager see every department', async () => {
    await twoDepartments();

    const recorded = install([
      { kind: 'tool_use', name: 'list_departments', input: {} },
      { kind: 'text', text: 'Oncology and Neurology.' },
    ]);

    const { accessToken } = await createUserWithRole('hr_manager');
    await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: 'What departments are there?' });

    const departments = recorded.toolResults[0] as { name: string }[];
    expect(departments.map((d) => d.name).sort()).toEqual(['Neurology', 'Oncology']);
  });
});

describe('AI Assistant — salary never reaches the model', () => {
  it('omits salary from every tool result, for the role that can otherwise read it', async () => {
    const department = await makeDepartment({ name: 'Radiology' });
    const employee = await makeEmployee({
      firstName: 'Wellpaid',
      lastName: 'Consultant',
      department: department.id,
    } as never);
    // `salary` is `select: false`, so it has to be written explicitly to prove
    // the exclusion is doing work rather than the field simply being absent.
    await Employee.updateOne({ _id: employee._id }, { $set: { salary: 987654 } });
    expect(await Employee.findById(employee._id).select('+salary').then((e) => e?.salary)).toBe(987654);

    await Attendance.create({
      employee: employee.id,
      date: new Date('2030-05-06'),
      status: 'overtime',
      totalHoursWorked: 11,
      overtimeHours: 3,
    });
    const schedule = await makeSchedule({ department: department.id });
    const shift = await makeShift({
      schedule: schedule.id,
      department: department.id,
      date: new Date('2030-05-06'),
      requiredStaff: 2,
    });
    await ShiftAssignment.create({ shift: shift.id, employee: employee.id, status: 'assigned' });

    const recorded = install([
      {
        kind: 'tool_use',
        name: 'get_overtime_summary',
        input: { dateFrom: '2030-05-01', dateTo: '2030-05-31' },
      },
      {
        kind: 'tool_use',
        name: 'get_attendance_summary',
        input: { dateFrom: '2030-05-01', dateTo: '2030-05-31' },
      },
      { kind: 'tool_use', name: 'explain_shift_staffing', input: { shiftId: shift.id } },
      { kind: 'tool_use', name: 'get_expiring_certifications', input: {} },
      { kind: 'text', text: 'Wellpaid Consultant worked 3 hours of overtime in May.' },
    ]);

    // hr_manager holds payroll:view — the role most able to see compensation
    // elsewhere in the app. It makes no difference here.
    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: 'How much overtime was worked in May?' });

    expect(res.status).toBe(200);

    const everythingTheModelSaw = JSON.stringify(recorded.toolResults);
    expect(everythingTheModelSaw).not.toMatch(/salary/i);
    expect(everythingTheModelSaw).not.toContain('987654');
    expect(JSON.stringify(res.body)).not.toMatch(/salary|987654/i);

    // ...and the tool results were not simply empty.
    expect(everythingTheModelSaw).toContain('Wellpaid');
  });

  it('offers no tool that could return compensation', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');
    const recorded = install([{ kind: 'text', text: 'Salary is not something I can look up.' }]);

    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: 'What is the salary of every nurse?' });

    expect(res.status).toBe(200);
    expect(res.body.data.toolCalls).toEqual([]);
    // Nothing in the tool set even mentions pay, so there is nothing to call.
    expect(recorded.toolNames.join(' ')).not.toMatch(/salary|pay|wage|compensation/i);
    expect(recorded.system).toMatch(/salary are out of scope/i);
  });
});

describe('AI Assistant — request handling', () => {
  it('rejects an empty question', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');
    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: '   ' });

    expect(res.status).toBe(422);
  });

  it('stops a model that will not stop calling tools', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');
    // The scripted client repeats its last turn forever once the script runs out.
    install([{ kind: 'tool_use', name: 'list_departments', input: {} }]);

    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: 'Loop forever' });

    expect(res.status).toBe(504);
    expect(res.body.message).toMatch(/narrower question/i);
  });

  it('hands an invalid tool argument back to the model instead of failing the turn', async () => {
    const { accessToken } = await createUserWithRole('hr_manager');
    const recorded = install([
      { kind: 'tool_use', name: 'get_overtime_summary', input: { dateFrom: 'last March', dateTo: 'now' } },
      { kind: 'text', text: 'I need the dates as YYYY-MM-DD — which month did you mean?' },
    ]);

    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(accessToken))
      .send({ question: 'Overtime for last March?' });

    expect(res.status).toBe(200);
    expect(res.body.data.toolCalls[0].ok).toBe(false);
    expect(recorded.toolResults[0]).toMatchObject({ error: 'Invalid arguments' });
  });

  it('reports capabilities without calling the model', async () => {
    const department = await makeDepartment({ name: 'Paediatrics' });
    const head = await makeLinkedEmployeeUser({ department: department.id } as never, 'department_head');

    const res = await request(app)
      .get('/api/v1/assistant/capabilities')
      .set(authHeader(head.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe('department');
    expect(res.body.data.departmentName).toBe('Paediatrics');
    expect(res.body.data.rateLimit.limit).toBeGreaterThan(0);
  });

  it('tells a Department Head with no department why they cannot use it', async () => {
    const head = await makeLinkedEmployeeUser({}, 'department_head');

    const res = await request(app)
      .post('/api/v1/assistant/ask')
      .set(authHeader(head.accessToken))
      .send({ question: 'How is my department doing?' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/no department assigned/i);
  });
});
