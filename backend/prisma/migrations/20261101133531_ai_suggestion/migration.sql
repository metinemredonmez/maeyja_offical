-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiSuggestion_productId_status_idx" ON "AiSuggestion"("productId", "status");
