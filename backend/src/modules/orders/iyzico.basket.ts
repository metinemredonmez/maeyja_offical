import { Prisma } from '@prisma/client';
import { fromKurus, toKurus } from '../../common/utils/money.util';
import { IyzicoBasketItem } from './iyzico.client';

type Money = Prisma.Decimal | number | string;

export interface BasketOrder {
  subtotal: Money;
  discountTotal: Money;
  shippingTotal: Money;
  items: { sku: string; productName: string; variantName: string | null; lineTotal: Money }[];
}

/**
 * iyzico requires basket item prices to sum exactly to `price`, and every item to be > 0.
 * The order discount is spread over lines proportionally (rounding remainder on the last line);
 * shipping is sent as its own item.
 */
export function buildBasketItems(order: BasketOrder): IyzicoBasketItem[] {
  const subtotalK = toKurus(order.subtotal);
  const discountK = toKurus(order.discountTotal);
  const items: IyzicoBasketItem[] = [];
  let allocated = 0;
  order.items.forEach((item, idx) => {
    const lineK = toKurus(item.lineTotal);
    const isLast = idx === order.items.length - 1;
    const share = isLast ? discountK - allocated : Math.round((discountK * lineK) / Math.max(subtotalK, 1));
    allocated += share;
    const priceK = lineK - share;
    if (priceK > 0) {
      items.push({
        id: item.sku,
        name: `${item.productName}${item.variantName ? ` ${item.variantName}` : ''}`.slice(0, 100),
        category1: 'Fashion',
        itemType: 'PHYSICAL',
        price: fromKurus(priceK).toFixed(2),
      });
    }
  });
  const shippingK = toKurus(order.shippingTotal);
  if (shippingK > 0) items.push({ id: 'SHIPPING', name: 'Kargo', category1: 'Shipping', itemType: 'PHYSICAL', price: fromKurus(shippingK).toFixed(2) });
  return items;
}
