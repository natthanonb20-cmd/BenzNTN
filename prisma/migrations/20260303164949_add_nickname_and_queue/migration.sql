-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'CONVERTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "nickname" TEXT;

-- CreateTable
CREATE TABLE "WaitingQueue" (
    "id" TEXT NOT NULL,
    "queueNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "phone" TEXT,
    "lineUserId" TEXT,
    "note" TEXT,
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "convertedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitingQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitingQueue_queueNumber_key" ON "WaitingQueue"("queueNumber");
