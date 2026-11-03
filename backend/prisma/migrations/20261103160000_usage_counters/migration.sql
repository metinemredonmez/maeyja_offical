-- RES-01: AI quotas survive restarts and deploys.
CREATE TABLE "UsageCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "UsageCounter_expiresAt_idx" ON "UsageCounter"("expiresAt");
