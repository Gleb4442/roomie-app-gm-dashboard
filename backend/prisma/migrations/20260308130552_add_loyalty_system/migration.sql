-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN_STAY', 'EARN_SERVICE', 'EARN_PRECHECKIN', 'EARN_BONUS', 'REDEEM', 'EXPIRE', 'MANUAL_ADJUST');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateTable
CREATE TABLE "loyalty_settings" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "programName" TEXT NOT NULL DEFAULT 'Loyalty Program',
    "currencyName" TEXT NOT NULL DEFAULT 'points',
    "pointsPerNight" INTEGER NOT NULL DEFAULT 100,
    "pointsPerAmount" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "preCheckinBonus" INTEGER NOT NULL DEFAULT 50,
    "pointsValueRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "minRedeemPoints" INTEGER NOT NULL DEFAULT 500,
    "pointsExpiryDays" INTEGER,
    "tiersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "silverThreshold" INTEGER NOT NULL DEFAULT 1000,
    "goldThreshold" INTEGER NOT NULL DEFAULT 5000,
    "platinumThreshold" INTEGER NOT NULL DEFAULT 15000,
    "bronzeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "silverMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.25,
    "goldMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "platinumMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "lastEarnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "stayId" TEXT,
    "orderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_settings_hotelId_key" ON "loyalty_settings"("hotelId");

-- CreateIndex
CREATE INDEX "loyalty_accounts_hotelId_points_idx" ON "loyalty_accounts"("hotelId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_guestId_hotelId_key" ON "loyalty_accounts"("guestId", "hotelId");

-- CreateIndex
CREATE INDEX "loyalty_transactions_accountId_createdAt_idx" ON "loyalty_transactions"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_transactions_stayId_idx" ON "loyalty_transactions"("stayId");

-- AddForeignKey
ALTER TABLE "loyalty_settings" ADD CONSTRAINT "loyalty_settings_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "loyalty_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
