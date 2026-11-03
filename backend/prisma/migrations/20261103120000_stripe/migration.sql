-- Card payments move to Stripe (iyzico stays in the enum for later).
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'STRIPE';
