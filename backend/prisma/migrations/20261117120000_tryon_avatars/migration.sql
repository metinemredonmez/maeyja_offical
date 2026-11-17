-- "See it on me" avatars and the bags placed on them; each made once, shared by every visitor who picks the same.
-- CreateTable
CREATE TABLE "TryonAvatar" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TryonAvatar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TryonLook" (
    "id" TEXT NOT NULL,
    "avatarId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "colorSlug" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TryonLook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TryonAvatar_key_key" ON "TryonAvatar"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TryonLook_avatarId_productId_colorSlug_key" ON "TryonLook"("avatarId", "productId", "colorSlug");

-- AddForeignKey
ALTER TABLE "TryonLook" ADD CONSTRAINT "TryonLook_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "TryonAvatar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

