-- AI-01: DMARC/DKIM result of the From address, recorded when a message is imported.
ALTER TABLE "MailMessage" ADD COLUMN "senderVerified" BOOLEAN NOT NULL DEFAULT false;
