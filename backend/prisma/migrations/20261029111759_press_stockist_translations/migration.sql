-- AlterTable
ALTER TABLE "PressItem" ADD COLUMN     "translations" JSONB;

-- AlterTable
ALTER TABLE "Stockist" ADD COLUMN     "translations" JSONB;

-- CreateTable
CREATE TABLE "TranslationMeta" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "srcHash" TEXT NOT NULL,
    "outHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TranslationMeta_model_rowId_lang_field_key" ON "TranslationMeta"("model", "rowId", "lang", "field");
