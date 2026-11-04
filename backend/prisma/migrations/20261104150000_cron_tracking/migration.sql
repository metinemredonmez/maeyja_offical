-- Scheduled jobs: last state per job and a history of the runs worth keeping (admin → Zamanlanmış işler).
CREATE TABLE "CronJob" (
    "name" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastDurationMs" INTEGER,
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastOkAt" TIMESTAMP(3),
    "failStreak" INTEGER NOT NULL DEFAULT 0,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronJob_pkey" PRIMARY KEY ("name")
);

CREATE TABLE "CronRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "actorId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "error" TEXT,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CronRun_name_startedAt_idx" ON "CronRun"("name", "startedAt");
CREATE INDEX "CronRun_startedAt_idx" ON "CronRun"("startedAt");
