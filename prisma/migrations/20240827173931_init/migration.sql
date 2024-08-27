/*
  Warnings:

  - You are about to alter the column `serialNumber` on the `Module` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - A unique constraint covering the columns `[userId,videoId]` on the table `UserVideoProgress` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Module" ALTER COLUMN "serialNumber" SET DATA TYPE INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "UserVideoProgress_userId_videoId_key" ON "UserVideoProgress"("userId", "videoId");
