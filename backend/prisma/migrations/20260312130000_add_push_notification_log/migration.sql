-- CreateTable
CREATE TABLE "push_notification_logs" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'individual',
    "targetGuestId" TEXT,
    "targetStage" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "sentBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_notification_logs_hotelId_createdAt_idx" ON "push_notification_logs"("hotelId", "createdAt");

-- AddForeignKey
ALTER TABLE "push_notification_logs" ADD CONSTRAINT "push_notification_logs_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_logs" ADD CONSTRAINT "push_notification_logs_targetGuestId_fkey" FOREIGN KEY ("targetGuestId") REFERENCES "guest_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
