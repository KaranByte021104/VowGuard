-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'VOIDED');

-- CreateTable
CREATE TABLE "AccessControlConfig" (
    "id" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "minimumApproverCount" INTEGER NOT NULL DEFAULT 1,
    "autoVoidHours" INTEGER NOT NULL DEFAULT 24,
    "grantedAccessHours" INTEGER NOT NULL DEFAULT 1,
    "automaticApprovalRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessControlConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessControlApprover" (
    "configId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AccessControlApprover_pkey" PRIMARY KEY ("configId","userId")
);

-- CreateTable
CREATE TABLE "AccessControlExcludedUser" (
    "configId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AccessControlExcludedUser_pkey" PRIMARY KEY ("configId","userId")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "timing" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "voidsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessApproval" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessControlConfig_secretId_key" ON "AccessControlConfig"("secretId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessApproval_requestId_approverId_key" ON "AccessApproval"("requestId", "approverId");

-- AddForeignKey
ALTER TABLE "AccessControlConfig" ADD CONSTRAINT "AccessControlConfig_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessControlApprover" ADD CONSTRAINT "AccessControlApprover_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AccessControlConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessControlApprover" ADD CONSTRAINT "AccessControlApprover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessControlExcludedUser" ADD CONSTRAINT "AccessControlExcludedUser_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AccessControlConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessControlExcludedUser" ADD CONSTRAINT "AccessControlExcludedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessApproval" ADD CONSTRAINT "AccessApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AccessRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessApproval" ADD CONSTRAINT "AccessApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
