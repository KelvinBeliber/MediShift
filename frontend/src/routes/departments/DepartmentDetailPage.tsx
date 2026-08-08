import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline'
import {
  CheckCircleIcon as CheckCircleSolid,
  TrashIcon,
  XCircleIcon as XCircleSolid,
} from '@heroicons/react/16/solid'
import { PageHeader } from '@/components/layout/PageHeader'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { StatCard } from '@/components/data/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePermission } from '@/features/auth/usePermission'
import { departmentsApi } from '@/features/departments/api'
import { SHIFT_TYPES, AUTO_GENERATED_SHIFT_TYPES, type StaffingRequirement } from '@/features/departments/types'
import { employeesApi } from '@/features/employees/api'
import { certificationsApi } from '@/features/certifications/api'
import { toApiError } from '@/lib/api/errors'

/** Screen 10 — `/departments/:id`. */
export function DepartmentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = usePermission('department:manage')

  const [managerDialogOpen, setManagerDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [staffingDraft, setStaffingDraft] = useState<StaffingRequirement[] | null>(null)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])

  const { data: department, isLoading } = useQuery({
    queryKey: ['departments', id],
    queryFn: () => departmentsApi.get(id),
    enabled: Boolean(id),
  })
  const { data: stats } = useQuery({
    queryKey: ['departments', id, 'stats'],
    queryFn: () => departmentsApi.stats(id),
    enabled: Boolean(id),
  })
  const { data: certData } = useQuery({
    queryKey: ['certifications'],
    queryFn: () => certificationsApi.list(),
  })
  const { data: allEmployees } = useQuery({
    queryKey: ['employees', 'all-for-assignment'],
    queryFn: () => employeesApi.list({ limit: 100 }),
    enabled: assignDialogOpen,
  })

  const certifications = certData?.items ?? []
  const requirements = staffingDraft ?? department?.staffingRequirements ?? []

  const assignManager = useMutation({
    mutationFn: (employeeId: string) => departmentsApi.assignManager(id, employeeId),
    onSuccess: () => {
      toast.success('Manager assigned')
      void queryClient.invalidateQueries({ queryKey: ['departments', id] })
      setManagerDialogOpen(false)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const assignEmployees = useMutation({
    mutationFn: (employeeIds: string[]) => departmentsApi.assignEmployees(id, employeeIds),
    onSuccess: (result) => {
      toast.success(`${result.modifiedCount} employee(s) assigned to this department`)
      void queryClient.invalidateQueries({ queryKey: ['departments', id] })
      void queryClient.invalidateQueries({ queryKey: ['departments', id, 'stats'] })
      setAssignDialogOpen(false)
      setSelectedEmployeeIds([])
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const saveStaffing = useMutation({
    mutationFn: (data: StaffingRequirement[]) => departmentsApi.update(id, { staffingRequirements: data }),
    onSuccess: () => {
      toast.success('Staffing requirements saved')
      void queryClient.invalidateQueries({ queryKey: ['departments', id] })
      void queryClient.invalidateQueries({ queryKey: ['departments', id, 'stats'] })
      setStaffingDraft(null)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const deactivate = useMutation({
    mutationFn: () => departmentsApi.deactivate(id),
    onSuccess: () => {
      toast.success('Department deactivated')
      void queryClient.invalidateQueries({ queryKey: ['departments'] })
      void navigate('/departments')
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const assignableEmployees = useMemo(
    () => (allEmployees?.items ?? []).filter((e) => e.department?.id !== id),
    [allEmployees, id],
  )

  if (isLoading || !department) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  function updateRequirement(index: number, patch: Partial<StaffingRequirement>) {
    const next = [...requirements]
    next[index] = { ...next[index]!, ...patch }
    setStaffingDraft(next)
  }

  function addRequirement() {
    setStaffingDraft([...requirements, { shiftType: 'morning', minStaff: 1, requiredCertifications: [] }])
  }

  function removeRequirement(index: number) {
    setStaffingDraft(requirements.filter((_, i) => i !== index))
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Departments', to: '/departments' }, { label: department.name }]} />
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => void navigate('/departments')}>
        <ArrowLeftIcon /> Departments
      </Button>
      <PageHeader
        title={department.name}
        description={
          <span className="inline-flex items-center gap-1.5">
            {department.code} ·
            {department.isActive ? (
              <CheckCircleSolid className="size-3.5 text-secondary-foreground" aria-hidden="true" />
            ) : (
              <XCircleSolid className="size-3.5 text-muted-foreground" aria-hidden="true" />
            )}
            {department.isActive ? 'Active' : 'Inactive'}
          </span>
        }
        actions={
          canManage &&
          department.isActive && (
            <Button variant="destructive" onClick={() => deactivate.mutate()} disabled={deactivate.isPending}>
              Deactivate
            </Button>
          )
        }
      />

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total employees" value={String(stats.totalEmployees)} />
          <StatCard label="Active" value={String(stats.activeEmployees)} />
          {stats.byEmploymentType.slice(0, 2).map((row) => (
            <StatCard key={row.employmentType} label={row.employmentType.replace('_', ' ')} value={String(row.count)} />
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Roster</CardTitle>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setAssignDialogOpen(true)}>
                <PlusIcon /> Assign employees
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {(department.employees ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees assigned yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(department.employees ?? []).map((emp) => (
                    <TableRow
                      key={emp.id}
                      className="cursor-pointer"
                      onClick={() => void navigate(`/employees/${emp.id}`)}
                    >
                      <TableCell>
                        {emp.firstName} {emp.lastName}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{emp.employeeId}</TableCell>
                      <TableCell className="capitalize">{emp.status?.replace('_', ' ') ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Manager</CardTitle>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setManagerDialogOpen(true)}>
                {department.manager ? 'Change' : 'Assign'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {department.manager ? (
              <p className="text-sm">
                {department.manager.firstName} {department.manager.lastName}{' '}
                <span className="font-mono text-xs text-muted-foreground">({department.manager.employeeId})</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No manager assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Staffing requirements</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Drives the AI scheduler. Only morning/afternoon/night (weekday) and weekend requirements
              auto-generate shifts — other types must be created manually.
            </p>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" onClick={addRequirement}>
              <PlusIcon /> Add row
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {requirements.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No staffing requirements configured — the AI generator has nothing to work from yet.
            </p>
          )}
          {requirements.map((req, index) => (
            <div key={index} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
              <Select
                value={req.shiftType}
                onValueChange={(v) => updateRequirement(index, { shiftType: v as StaffingRequirement['shiftType'] })}
                disabled={!canManage}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type.replace('_', ' ')}
                      {!(AUTO_GENERATED_SHIFT_TYPES as readonly string[]).includes(type) && ' (manual only)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                Min staff
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={req.minStaff}
                  disabled={!canManage}
                  onChange={(e) => updateRequirement(index, { minStaff: Number(e.target.value) })}
                />
              </label>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {certifications.map((cert) => {
                  const active = req.requiredCertifications.includes(cert.id)
                  return (
                    <button
                      key={cert.id}
                      type="button"
                      disabled={!canManage}
                      onClick={() =>
                        updateRequirement(index, {
                          requiredCertifications: active
                            ? req.requiredCertifications.filter((c) => c !== cert.id)
                            : [...req.requiredCertifications, cert.id],
                        })
                      }
                    >
                      <Badge variant={active ? 'default' : 'outline'} className="cursor-pointer text-xs">
                        {cert.name}
                      </Badge>
                    </button>
                  )
                })}
              </div>
              {canManage && (
                <Button variant="ghost" size="icon-sm" onClick={() => removeRequirement(index)}>
                  <TrashIcon />
                </Button>
              )}
            </div>
          ))}
          {canManage && staffingDraft && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setStaffingDraft(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={saveStaffing.isPending} onClick={() => saveStaffing.mutate(requirements)}>
                {saveStaffing.isPending ? 'Saving…' : 'Save requirements'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign manager</DialogTitle>
          </DialogHeader>
          <Select onValueChange={(v) => assignManager.mutate(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an employee in this department" />
            </SelectTrigger>
            <SelectContent>
              {(department.employees ?? []).map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Only employees already in this department (or with no department at all) can be assigned.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign employees</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {assignableEmployees.length === 0 && (
              <p className="text-sm text-muted-foreground">No other employees available to assign.</p>
            )}
            {assignableEmployees.map((emp) => {
              const checked = selectedEmployeeIds.includes(emp.id)
              return (
                <label key={emp.id} className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-secondary/60">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedEmployeeIds((prev) =>
                        checked ? prev.filter((id) => id !== emp.id) : [...prev, emp.id],
                      )
                    }
                  />
                  {emp.firstName} {emp.lastName}
                  {emp.department && (
                    <span className="text-xs text-muted-foreground">(currently {emp.department.name})</span>
                  )}
                </label>
              )
            })}
          </div>
          <DialogFooter>
            <Button
              disabled={selectedEmployeeIds.length === 0 || assignEmployees.isPending}
              onClick={() => assignEmployees.mutate(selectedEmployeeIds)}
            >
              {assignEmployees.isPending ? 'Assigning…' : `Assign ${selectedEmployeeIds.length || ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
