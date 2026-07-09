-- CreateEnum
CREATE TYPE "EmergencyAccessStatus" AS ENUM ('INACTIVE', 'PENDING', 'ACTIVE', 'EXPIRED', 'DENIED');

-- CreateTable
CREATE TABLE "EmergencyAccessGrant" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sessionValidityHours" INTEGER NOT NULL,
    "waitingPeriodHours" INTEGER NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "status" "EmergencyAccessStatus" NOT NULL DEFAULT 'INACTIVE',
    "waitingPeriodUntil" TIMESTAMP(3),
    "sessionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyAccessGrant_ownerId_contactId_key" ON "EmergencyAccessGrant"("ownerId", "contactId");

-- AddForeignKey
ALTER TABLE "EmergencyAccessGrant" ADD CONSTRAINT "EmergencyAccessGrant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAccessGrant" ADD CONSTRAINT "EmergencyAccessGrant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
