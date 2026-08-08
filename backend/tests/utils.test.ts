import jwt from 'jsonwebtoken';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../src/utils/jwt';
import { generateRawToken, hashToken } from '../src/utils/tokens';
import { getPaginationParams, buildPaginationMeta } from '../src/utils/pagination';
import { nextSequentialId } from '../src/utils/idGenerator';
import { Request } from 'express';

describe('jwt utils', () => {
  it('round-trips an access token', () => {
    const token = signAccessToken({ sub: 'user1', role: 'employee' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user1');
    expect(payload.role).toBe('employee');
  });

  it('round-trips a refresh token', () => {
    const token = signRefreshToken({ sub: 'user1', tokenId: 'abc123' });
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe('user1');
    expect(payload.tokenId).toBe('abc123');
  });

  it('rejects an access token verified with the wrong secret (tampering/cross-use)', () => {
    const forged = jwt.sign({ sub: 'user1', role: 'employee' }, 'wrong-secret');
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('an access token cannot be verified as a refresh token (distinct secrets)', () => {
    const accessToken = signAccessToken({ sub: 'user1', role: 'employee' });
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });

  it('rejects a malformed token string', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrow();
  });
});

describe('token hashing utils', () => {
  it('generates unique raw tokens each call', () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64); // 32 bytes hex-encoded
  });

  it('hashToken is deterministic for the same input and differs for different input', () => {
    const raw = 'some-raw-token-value';
    expect(hashToken(raw)).toBe(hashToken(raw));
    expect(hashToken(raw)).not.toBe(hashToken('different-value'));
    expect(hashToken(raw)).toHaveLength(64); // sha256 hex digest
  });
});

describe('pagination utils', () => {
  function fakeReq(query: Record<string, string>): Request {
    return { query } as unknown as Request;
  }

  it('applies sensible defaults when no query params are given', () => {
    const params = getPaginationParams(fakeReq({}));
    expect(params.page).toBe(1);
    expect(params.limit).toBe(20);
    expect(params.skip).toBe(0);
    expect(params.sort).toEqual({ createdAt: -1 });
  });

  it('parses page/limit and computes skip correctly', () => {
    const params = getPaginationParams(fakeReq({ page: '3', limit: '10' }));
    expect(params.page).toBe(3);
    expect(params.limit).toBe(10);
    expect(params.skip).toBe(20);
  });

  it('caps limit at 100 and floors page at 1', () => {
    const capped = getPaginationParams(fakeReq({ limit: '9999' }));
    expect(capped.limit).toBe(100);

    // page=0 floors to 1; limit=0 falls back to the default (0 is falsy in
    // the `Number(x) || DEFAULT` check) rather than clamping to 1 — either is
    // a defensible reading of an invalid explicit "0", this just pins down
    // which one the implementation actually does.
    const floored = getPaginationParams(fakeReq({ page: '0', limit: '0' }));
    expect(floored.page).toBe(1);
    expect(floored.limit).toBe(20);

    const flooredNegativeLimit = getPaginationParams(fakeReq({ limit: '-5' }));
    expect(flooredNegativeLimit.limit).toBe(1);
  });

  it('parses multi-field sort with "-" prefix for descending', () => {
    const params = getPaginationParams(fakeReq({ sort: '-priority,name' }));
    expect(params.sort).toEqual({ priority: -1, name: 1 });
  });

  it('buildPaginationMeta computes totalPages including remainders and zero-total edge cases', () => {
    expect(buildPaginationMeta(1, 10, 25)).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
    expect(buildPaginationMeta(1, 10, 20)).toEqual({ page: 1, limit: 10, total: 20, totalPages: 2 });
    expect(buildPaginationMeta(1, 10, 0)).toEqual({ page: 1, limit: 10, total: 0, totalPages: 1 });
  });
});

describe('sequential ID generator', () => {
  it('increments atomically and formats with zero-padding', async () => {
    const key = `test-counter-${Date.now()}`;
    const first = await nextSequentialId(key, 'EMP', 4);
    const second = await nextSequentialId(key, 'EMP', 4);

    expect(first).toMatch(/^EMP-\d{4}$/);
    const firstNum = Number(first.split('-')[1]);
    const secondNum = Number(second.split('-')[1]);
    expect(secondNum).toBe(firstNum + 1);
  });

  it('different counter keys are independent', async () => {
    const keyA = `counter-a-${Date.now()}`;
    const keyB = `counter-b-${Date.now()}`;
    const a = await nextSequentialId(keyA, 'A', 3);
    const b = await nextSequentialId(keyB, 'B', 3);
    expect(a).toBe('A-001');
    expect(b).toBe('B-001');
  });
});
