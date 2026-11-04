-- LOG-04: alerts staff must hear about (failed payments, stuck jobs, attacks). One open row per code + key.
CREATE TYPE "AlertLevel" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "openKey" TEXT,
    "level" "AlertLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "meta" JSONB,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Alert_openKey_key" ON "Alert"("openKey");
CREATE INDEX "Alert_resolvedAt_lastAt_idx" ON "Alert"("resolvedAt", "lastAt");
