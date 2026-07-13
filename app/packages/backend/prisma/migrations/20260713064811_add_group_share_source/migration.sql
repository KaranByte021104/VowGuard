-- AlterTable
ALTER TABLE "SecretShare" ADD COLUMN     "groupShareSourceId" TEXT;

-- AddForeignKey
ALTER TABLE "SecretShare" ADD CONSTRAINT "SecretShare_groupShareSourceId_fkey" FOREIGN KEY ("groupShareSourceId") REFERENCES "UserGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
