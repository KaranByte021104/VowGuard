-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "samlCertificate" TEXT,
ADD COLUMN     "samlPrivateKey" TEXT;

-- CreateTable
CREATE TABLE "SAMLApp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "acsUrl" TEXT NOT NULL,
    "audienceUri" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SAMLApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SAMLAppAccess" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SAMLAppAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SAMLAppAccess_appId_userId_key" ON "SAMLAppAccess"("appId", "userId");

-- AddForeignKey
ALTER TABLE "SAMLApp" ADD CONSTRAINT "SAMLApp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAMLAppAccess" ADD CONSTRAINT "SAMLAppAccess_appId_fkey" FOREIGN KEY ("appId") REFERENCES "SAMLApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAMLAppAccess" ADD CONSTRAINT "SAMLAppAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
