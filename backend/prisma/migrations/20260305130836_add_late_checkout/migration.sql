-- CreateEnum
CREATE TYPE "LateCheckoutStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterTable
ALTER TABLE "guest_stays" ADD COLUMN     "extensionRequestedUntil" TIMESTAMP(3),
ADD COLUMN     "extensionStatus" "LateCheckoutStatus";

-- CreateTable
CREATE TABLE "late_checkout_requests" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "requestedTime" TEXT NOT NULL,
    "status" "LateCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "late_checkout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "late_checkout_requests_stayId_idx" ON "late_checkout_requests"("stayId");

-- AddForeignKey
ALTER TABLE "late_checkout_requests" ADD CONSTRAINT "late_checkout_requests_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "guest_stays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
