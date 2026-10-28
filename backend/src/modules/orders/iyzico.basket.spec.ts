import { toKurus } from '../../common/utils/money.util';
import { buildBasketItems } from './iyzico.basket';

const sum = (items: { price: string }[]) => items.reduce((s, i) => s + toKurus(i.price), 0);

describe('buildBasketItems', () => {
  it('sums exactly to the order total with a percentage discount and shipping', () => {
    const order = {
      subtotal: 43500.01,
      discountTotal: 4350,
      shippingTotal: 150,
      items: [
        { sku: 'A', productName: 'Bag', variantName: 'Red', lineTotal: 29000 },
        { sku: 'B', productName: 'Bag', variantName: 'Bicolor', lineTotal: 14500.01 },
      ],
    };
    const items = buildBasketItems(order);
    expect(sum(items)).toBe(toKurus(43500.01 - 4350 + 150));
    expect(items.at(-1)?.id).toBe('SHIPPING');
    expect(items.every((i) => toKurus(i.price) > 0)).toBe(true);
  });

  it('spreads awkward discounts without losing a kuruş', () => {
    const order = {
      subtotal: 300,
      discountTotal: 100,
      shippingTotal: 0,
      items: [1, 2, 3].map((n) => ({ sku: `S${n}`, productName: 'Item', variantName: null, lineTotal: 100 })),
    };
    const items = buildBasketItems(order);
    expect(items).toHaveLength(3);
    expect(sum(items)).toBe(20000);
  });

  it('drops lines that become free so iyzico does not reject zero-priced items', () => {
    const order = {
      subtotal: 100,
      discountTotal: 100,
      shippingTotal: 150,
      items: [{ sku: 'A', productName: 'Item', variantName: null, lineTotal: 100 }],
    };
    expect(buildBasketItems(order).map((i) => i.id)).toEqual(['SHIPPING']);
  });
});
