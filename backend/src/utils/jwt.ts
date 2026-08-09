import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { env } from '@config/env';

/**
 * Both token types are HS256 over *different* secrets. The algorithm is pinned
 * on verify as well as sign: without `algorithms`, jsonwebtoken will honour
 * whatever `alg` the token header claims, which is the classic algorithm
 * confusion foothold.
 *
 * The `typ` claim is belt-and-braces on top of the split secrets — even if the
 * two secrets were ever misconfigured to the same value, an access token still
 * cannot be presented as a refresh token (or vice versa).
 */
const ALGORITHM = 'HS256' as const;

const signOptions = { algorithm: ALGORITHM } satisfies SignOptions;
const verifyOptions = { algorithms: [ALGORITHM] } satisfies VerifyOptions;

export interface AccessTokenPayload {
  sub: string;
  role: string;
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  /** Identifies this single token; rotated on every refresh. */
  tokenId: string;
  /** Identifies the login session (token family); survives rotation. */
  sessionId: string;
  typ: 'refresh';
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'typ'>): string {
  return jwt.sign({ ...payload, typ: 'access' }, env.jwt.accessSecret, {
    ...signOptions,
    expiresIn: env.jwt.accessExpiresIn as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'typ'>): string {
  return jwt.sign({ ...payload, typ: 'refresh' }, env.jwt.refreshSecret, {
    ...signOptions,
    expiresIn: env.jwt.refreshExpiresIn as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.jwt.accessSecret, verifyOptions) as AccessTokenPayload;
  if (payload.typ !== 'access') {
    throw new jwt.JsonWebTokenError('Token is not an access token');
  }
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.jwt.refreshSecret, verifyOptions) as RefreshTokenPayload;
  if (payload.typ !== 'refresh') {
    throw new jwt.JsonWebTokenError('Token is not a refresh token');
  }
  return payload;
}
