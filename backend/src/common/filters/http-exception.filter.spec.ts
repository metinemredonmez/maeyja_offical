import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalExceptionFilter } from './http-exception.filter';

function run(exception: unknown) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const req = { method: 'POST', originalUrl: '/api/v1/auth/register' };
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }) } as unknown as ArgumentsHost;
  new GlobalExceptionFilter().catch(exception, host);
  return { status: res.status.mock.calls[0][0] as number, body: res.json.mock.calls[0][0] as Record<string, unknown> };
}

const prismaError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(`Invalid \`prisma.user.create()\` invocation: ${code}`, { code, clientVersion: 'test', meta });

describe('error responses (EXC-01)', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('maps a known Prisma error without its code, column or constraint name', () => {
    const { status, body } = run(prismaError('P2002', { target: ['email'], modelName: 'User' }));
    expect(status).toBe(409);
    expect(body.message).toBe('Bu kayıt zaten mevcut');
    expect(JSON.stringify(body)).not.toMatch(/P2002|email|User|prisma/i);
  });

  it('turns an unmapped Prisma error into a generic 500', () => {
    const { status, body } = run(prismaError('P2010', { message: 'column "secret_col" does not exist' }));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/P2010|secret_col|prisma/i);
  });

  it('still passes an intended client error and its machine code through', () => {
    const { status, body } = run(new BadRequestException({ message: 'MFA gerekli', code: 'MFA_SETUP_REQUIRED' }));
    expect(status).toBe(400);
    expect(body).toMatchObject({ message: 'MFA gerekli', code: 'MFA_SETUP_REQUIRED' });
  });
});
