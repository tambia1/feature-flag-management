-- CreateEnum
CREATE TYPE "IconStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "iconSourceKey" TEXT,
ADD COLUMN     "iconStatus" "IconStatus";

UPDATE "companies" SET "iconStatus" = 'READY' WHERE "iconUrl" IS NOT NULL;
