/*
  Warnings:

  - You are about to drop the column `contractFile` on the `Contract` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "contractFile",
ADD COLUMN     "contractFiles" TEXT[];
