import { ReturnStatus } from '@prisma/client';
import { canMoveReturn } from './return-status';

describe('return request steps (BUS-01)', () => {
  it('follows the steps forward', () => {
    expect(canMoveReturn(ReturnStatus.REQUESTED, ReturnStatus.APPROVED)).toBe(true);
    expect(canMoveReturn(ReturnStatus.APPROVED, ReturnStatus.RECEIVED)).toBe(true);
    expect(canMoveReturn(ReturnStatus.RECEIVED, ReturnStatus.REFUNDED)).toBe(true);
  });

  it('refuses skipped steps and leaving a final state', () => {
    expect(canMoveReturn(ReturnStatus.REQUESTED, ReturnStatus.REFUNDED)).toBe(false);
    expect(canMoveReturn(ReturnStatus.REJECTED, ReturnStatus.APPROVED)).toBe(false);
    expect(canMoveReturn(ReturnStatus.REFUNDED, ReturnStatus.REQUESTED)).toBe(false);
  });
});
