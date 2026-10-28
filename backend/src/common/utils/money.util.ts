import { Prisma } from '@prisma/client';

type Numeric = Prisma.Decimal | number | string | null | undefined;

/** Work in integer kuruş to avoid float drift, convert back at the edges. */
export const toKurus = (value: Numeric): number => Math.round(Number(value ?? 0) * 100);
export const fromKurus = (kurus: number): number => Math.round(kurus) / 100;
export const toNumber = (value: Numeric): number => fromKurus(toKurus(value));

/** VAT contained in a VAT-inclusive amount, in kuruş. */
export const includedVatKurus = (grossKurus: number, ratePercent: number): number =>
  Math.round(grossKurus - grossKurus / (1 + ratePercent / 100));
