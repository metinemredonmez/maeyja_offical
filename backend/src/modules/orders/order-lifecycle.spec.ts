import { OrderStatus } from '@prisma/client';
import { TRANSITIONS } from './order-lifecycle.service';

describe('order transitions', () => {
  it('has an entry for every status', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual(Object.values(OrderStatus).sort());
  });

  it('treats cancelled and refunded as terminal', () => {
    expect(TRANSITIONS.CANCELLED).toEqual([]);
    expect(TRANSITIONS.REFUNDED).toEqual([]);
  });

  it('never allows going back to awaiting payment', () => {
    for (const next of Object.values(TRANSITIONS)) expect(next).not.toContain('PENDING_PAYMENT');
  });
});
