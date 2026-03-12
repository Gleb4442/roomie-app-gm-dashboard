-- CreateEnum
CREATE TYPE "JourneySubStage" AS ENUM (
  'BOOKING_CONFIRMED',
  'DAYS_7_BEFORE',
  'DAYS_1_BEFORE',
  'CHECK_IN_DAY',
  'DAY_1',
  'MID_STAY',
  'DAYS_1_BEFORE_OUT',
  'CHECKOUT_DAY',
  'DAYS_1_AFTER',
  'DAYS_7_AFTER',
  'IDLE'
);

-- CreateEnum
CREATE TYPE "GuestGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "GuestBudget" AS ENUM ('ECONOMY', 'MID', 'PREMIUM', 'LUXURY');

-- CreateEnum
CREATE TYPE "TravelStyle" AS ENUM ('BUSINESS', 'LEISURE', 'FAMILY', 'ROMANTIC', 'GROUP');

-- AlterTable: Add subStage and totalSpentDuringStay to guest_stays
ALTER TABLE "guest_stays" ADD COLUMN "subStage" "JourneySubStage" NOT NULL DEFAULT 'IDLE';
ALTER TABLE "guest_stays" ADD COLUMN "totalSpentDuringStay" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: Add language to guest_accounts
ALTER TABLE "guest_accounts" ADD COLUMN "language" TEXT DEFAULT 'uk';

-- CreateTable: guest_profiles
CREATE TABLE "guest_profiles" (
  "id" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "gender" "GuestGender",
  "ageRange" TEXT,
  "country" TEXT,
  "city" TEXT,
  "budget" "GuestBudget",
  "travelStyle" "TravelStyle",
  "interests" TEXT[],
  "dietaryNeeds" TEXT[],
  "totalBookings" INTEGER NOT NULL DEFAULT 0,
  "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgStayNights" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastVisitAt" TIMESTAMP(3),
  "favoriteRoomType" TEXT,
  "topOrderedItems" TEXT[],
  "mostVisitedHotel" TEXT,
  "guestSummary" TEXT,
  "lastInteractionTopics" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "guest_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_profiles_guestId_key" ON "guest_profiles"("guestId");

-- AddForeignKey
ALTER TABLE "guest_profiles" ADD CONSTRAINT "guest_profiles_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "guest_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: Set subStage for existing stays based on current stage
UPDATE "guest_stays" SET "subStage" = 'BOOKING_CONFIRMED' WHERE "stage" = 'PRE_ARRIVAL';
UPDATE "guest_stays" SET "subStage" = 'CHECK_IN_DAY' WHERE "stage" = 'CHECKED_IN';
UPDATE "guest_stays" SET "subStage" = 'DAY_1' WHERE "stage" = 'IN_STAY';
UPDATE "guest_stays" SET "subStage" = 'CHECKOUT_DAY' WHERE "stage" = 'CHECKOUT';
UPDATE "guest_stays" SET "subStage" = 'DAYS_1_AFTER' WHERE "stage" = 'POST_STAY';
UPDATE "guest_stays" SET "subStage" = 'IDLE' WHERE "stage" = 'BETWEEN_STAYS';
