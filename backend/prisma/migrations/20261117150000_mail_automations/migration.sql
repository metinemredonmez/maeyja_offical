-- Automatic e-mails (welcome, after purchase, win-back): one row per e-mail and address, so none goes twice.
-- CreateTable
CREATE TABLE "MailAutomationSend" (
    "id" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "refId" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailAutomationSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailAutomationSend_flow_sentAt_idx" ON "MailAutomationSend"("flow", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailAutomationSend_flow_email_refId_key" ON "MailAutomationSend"("flow", "email", "refId");

