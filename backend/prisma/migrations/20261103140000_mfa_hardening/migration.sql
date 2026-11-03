-- AUT-01/02/04: second-factor failures and lock survive restarts; a TOTP code works once; e-mailed enrollment code.
ALTER TYPE "AuthTokenType" ADD VALUE IF NOT EXISTS 'MFA_ENROLL';

ALTER TABLE "User"
  ADD COLUMN "mfaFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mfaLockedUntil" TIMESTAMP(3),
  ADD COLUMN "mfaLastStep" INTEGER;
