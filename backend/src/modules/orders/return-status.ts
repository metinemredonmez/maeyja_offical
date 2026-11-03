import { ReturnStatus } from '@prisma/client';

/** BUS-01: where a return can go from each step. Rejected and refunded are final. */
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: [ReturnStatus.APPROVED, ReturnStatus.REJECTED],
  APPROVED: [ReturnStatus.RECEIVED, ReturnStatus.REJECTED],
  RECEIVED: [ReturnStatus.REFUNDED, ReturnStatus.REJECTED],
  REJECTED: [],
  REFUNDED: [],
};

export const canMoveReturn = (from: ReturnStatus, to: ReturnStatus) => RETURN_TRANSITIONS[from].includes(to);
