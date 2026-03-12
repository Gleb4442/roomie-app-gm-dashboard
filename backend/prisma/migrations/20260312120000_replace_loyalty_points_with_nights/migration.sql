-- Replace loyalty points system with nights-per-year tier system

-- 1. Update LoyaltyTransactionType enum
-- Remove old values, add new ones
ALTER TYPE "LoyaltyTransactionType" RENAME TO "LoyaltyTransactionType_old";
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('STAY_NIGHTS', 'MANUAL_ADJUST', 'TIER_CHANGE');

-- Migrate existing transaction types
ALTER TABLE "loyalty_transactions" ALTER COLUMN "type" TYPE TEXT;
UPDATE "loyalty_transactions" SET "type" = 'STAY_NIGHTS' WHERE "type" IN ('EARN_STAY', 'EARN_SERVICE', 'EARN_PRECHECKIN', 'EARN_BONUS');
UPDATE "loyalty_transactions" SET "type" = 'MANUAL_ADJUST' WHERE "type" IN ('REDEEM', 'EXPIRE', 'MANUAL_ADJUST');
ALTER TABLE "loyalty_transactions" ALTER COLUMN "type" TYPE "LoyaltyTransactionType" USING "type"::"LoyaltyTransactionType";
DROP TYPE "LoyaltyTransactionType_old";

-- 2. Update loyalty_settings: remove points columns, add nights requirements
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "currencyName";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "pointsPerNight";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "pointsPerAmount";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "preCheckinBonus";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "pointsValueRate";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "minRedeemPoints";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "pointsExpiryDays";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "tiersEnabled";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "silverThreshold";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "goldThreshold";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "platinumThreshold";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "bronzeMultiplier";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "silverMultiplier";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "goldMultiplier";
ALTER TABLE "loyalty_settings" DROP COLUMN IF EXISTS "platinumMultiplier";

ALTER TABLE "loyalty_settings" ADD COLUMN "silverNightsRequired" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "loyalty_settings" ADD COLUMN "goldNightsRequired" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "loyalty_settings" ADD COLUMN "platinumNightsRequired" INTEGER NOT NULL DEFAULT 50;

-- 3. Update loyalty_accounts: replace points with nights
ALTER TABLE "loyalty_accounts" DROP COLUMN IF EXISTS "points";
ALTER TABLE "loyalty_accounts" DROP COLUMN IF EXISTS "lifetimePoints";
ALTER TABLE "loyalty_accounts" DROP COLUMN IF EXISTS "lastEarnAt";

ALTER TABLE "loyalty_accounts" ADD COLUMN "nightsThisYear" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "loyalty_accounts" ADD COLUMN "totalNights" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "loyalty_accounts" ADD COLUMN "yearStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update index
DROP INDEX IF EXISTS "loyalty_accounts_hotelId_points_idx";
CREATE INDEX "loyalty_accounts_hotelId_nightsThisYear_idx" ON "loyalty_accounts"("hotelId", "nightsThisYear");

-- 4. Update loyalty_transactions: replace points with nights
-- Rename points → nights (convert point values to approximate night counts)
ALTER TABLE "loyalty_transactions" RENAME COLUMN "points" TO "nights";
-- Set all existing values to 0 since point values don't translate to nights
UPDATE "loyalty_transactions" SET "nights" = 0;

ALTER TABLE "loyalty_transactions" DROP COLUMN IF EXISTS "orderId";
ALTER TABLE "loyalty_transactions" DROP COLUMN IF EXISTS "expiresAt";
