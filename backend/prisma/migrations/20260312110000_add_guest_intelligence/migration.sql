-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SENT', 'VIEWED', 'REDEEMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "guest_tags" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_offers" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "guestId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'percent',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "code" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerRule" TEXT,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_reviews" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "stayId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "categories" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "managerReply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_tags_guestId_hotelId_tag_key" ON "guest_tags"("guestId", "hotelId", "tag");
CREATE INDEX "guest_tags_hotelId_tag_idx" ON "guest_tags"("hotelId", "tag");

CREATE INDEX "guest_offers_hotelId_status_idx" ON "guest_offers"("hotelId", "status");
CREATE INDEX "guest_offers_guestId_idx" ON "guest_offers"("guestId");

CREATE INDEX "guest_reviews_hotelId_rating_idx" ON "guest_reviews"("hotelId", "rating");
CREATE INDEX "guest_reviews_guestId_idx" ON "guest_reviews"("guestId");

-- AddForeignKey
ALTER TABLE "guest_tags" ADD CONSTRAINT "guest_tags_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guest_tags" ADD CONSTRAINT "guest_tags_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guest_offers" ADD CONSTRAINT "guest_offers_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guest_offers" ADD CONSTRAINT "guest_offers_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guest_reviews" ADD CONSTRAINT "guest_reviews_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guest_reviews" ADD CONSTRAINT "guest_reviews_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
