import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z, ZodError } from 'zod';
import { errorHandler } from '../src/middleware/errorHandler';
import { validateRequest } from '../src/middleware/validateRequest';
import { ApiError } from '../src/utils/ApiError';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response & { status: jest.Mock; json: jest.Mock };
}

describe('errorHandler middleware', () => {
  it('maps ApiError to its own status code and message', () => {
    const res = mockRes();
    errorHandler(ApiError.conflict('Duplicate thing'), {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Duplicate thing' }));
  });

  it('maps ZodError to 422 with per-field details', () => {
    const schema = z.object({ email: z.string().email() });
    let zodError: ZodError;
    try {
      schema.parse({ email: 'not-an-email' });
      throw new Error('should have thrown');
    } catch (e) {
      zodError = e as ZodError;
    }

    const res = mockRes();
    errorHandler(zodError, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details[0].path).toBe('email');
  });

  it('maps a Mongoose duplicate-key error (code 11000) to 409', () => {
    const res = mockRes();
    const dupError = Object.assign(new Error('duplicate'), { code: 11000, keyValue: { email: 'x@x.com' } });
    errorHandler(dupError, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('maps a Mongoose CastError to 400', () => {
    const res = mockRes();
    const castError = new mongoose.Error.CastError('ObjectId', 'not-an-id', 'employee');
    errorHandler(castError, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('maps a Mongoose ValidationError to 422', () => {
    const res = mockRes();
    const validationError = new mongoose.Error.ValidationError();
    validationError.errors.name = new mongoose.Error.ValidatorError({ message: 'Name is required', path: 'name' });
    errorHandler(validationError, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('defaults unknown errors to 500', () => {
    const res = mockRes();
    errorHandler(new Error('something exploded'), {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('validateRequest middleware', () => {
  it('calls next() with no error when the body is valid, and replaces req.body with the parsed result', () => {
    const schema = z.object({ age: z.coerce.number() });
    const req = { body: { age: '42' } } as Request;
    const next = jest.fn();

    validateRequest({ body: schema })(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(); // no error
    expect(req.body).toEqual({ age: 42 }); // coerced
  });

  it('calls next(error) with a ZodError when the body is invalid', () => {
    const schema = z.object({ email: z.string().email() });
    const req = { body: { email: 'nope' } } as Request;
    const next = jest.fn();

    validateRequest({ body: schema })(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ZodError));
  });

  it('stores validated query on req.validatedQuery instead of reassigning req.query', () => {
    const schema = z.object({ page: z.coerce.number() });
    const req = { query: { page: '2' } } as unknown as Request;
    const next = jest.fn();

    validateRequest({ query: schema })(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.validatedQuery).toEqual({ page: 2 });
    expect(req.query).toEqual({ page: '2' }); // untouched — still the original string
  });

  it('reassigns req.params in place (params are safely mutable, unlike query)', () => {
    const schema = z.object({ id: z.string() });
    const req = { params: { id: 'abc' } } as unknown as Request;
    const next = jest.fn();

    validateRequest({ params: schema })(req, {} as Response, next);

    expect(req.params).toEqual({ id: 'abc' });
  });
});
