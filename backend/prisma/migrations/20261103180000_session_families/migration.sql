-- SES-02/04/05: sessions end on role/password/MFA change; refresh tokens belong to a sign-in with an absolute lifetime.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "RefreshToken"
  ADD COLUMN "familyId" TEXT,
  ADD COLUMN "familyStartedAt" TIMESTAMP(3),
  ADD COLUMN "mfa" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
