/*
  Warnings:

  - You are about to drop the column `grantedAccessHours` on the `AccessControlConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AccessControlConfig" DROP COLUMN "grantedAccessHours",
ADD COLUMN     "grantDurationMinutes" INTEGER NOT NULL DEFAULT 60;
