-- AlterTable
ALTER TABLE "hotels" ADD COLUMN     "chainId" TEXT;

-- CreateTable
CREATE TABLE "hotel_chains" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_chains_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "hotel_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
