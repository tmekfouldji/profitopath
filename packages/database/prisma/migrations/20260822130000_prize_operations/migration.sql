-- CreateEnum
CREATE TYPE "WinnerReviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PrizeKycStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FreeEntryCreditStatus" AS ENUM ('AVAILABLE', 'REDEEMED', 'VOID');

-- AlterTable
ALTER TABLE "Prize"
ADD COLUMN "sourceFinalizationId" UUID,
ADD COLUMN "sourceStandingId" UUID,
ADD COLUMN "sourceResultHash" VARCHAR(128),
ADD COLUMN "winnerReviewStatus" "WinnerReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "winnerReviewedByUserId" UUID,
ADD COLUMN "winnerReviewedAt" TIMESTAMPTZ(3),
ADD COLUMN "kycStatus" "PrizeKycStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "kycReviewedByUserId" UUID,
ADD COLUMN "kycReviewedAt" TIMESTAMPTZ(3),
ADD COLUMN "kycReason" VARCHAR(1000),
ADD COLUMN "approvedByUserId" UUID;

-- AlterTable
ALTER TABLE "Payout"
ADD COLUMN "approvedByUserId" UUID,
ADD COLUMN "processingAt" TIMESTAMPTZ(3),
ADD COLUMN "paidByUserId" UUID,
ADD COLUMN "reconciledByUserId" UUID,
ADD COLUMN "reconciledAt" TIMESTAMPTZ(3),
ADD COLUMN "reconciliationNote" VARCHAR(1000);

-- CreateTable
CREATE TABLE "FreeEntryCredit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sourcePrizeId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "status" "FreeEntryCreditStatus" NOT NULL DEFAULT 'AVAILABLE',
    "redeemedAt" TIMESTAMPTZ(3),
    "voidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FreeEntryCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prize_sourceStandingId_key" ON "Prize"("sourceStandingId");
CREATE INDEX "Prize_competitionId_status_idx" ON "Prize"("competitionId", "status");
CREATE INDEX "Prize_winnerEntryId_winnerReviewStatus_kycStatus_idx"
ON "Prize"("winnerEntryId", "winnerReviewStatus", "kycStatus");
CREATE INDEX "Payout_status_reconciledAt_idx" ON "Payout"("status", "reconciledAt");
CREATE UNIQUE INDEX "FreeEntryCredit_sourcePrizeId_ordinal_key"
ON "FreeEntryCredit"("sourcePrizeId", "ordinal");
CREATE INDEX "FreeEntryCredit_userId_status_idx" ON "FreeEntryCredit"("userId", "status");

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_sourceFinalizationId_fkey"
FOREIGN KEY ("sourceFinalizationId") REFERENCES "LeaderboardFinalization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Prize" ADD CONSTRAINT "Prize_sourceStandingId_fkey"
FOREIGN KEY ("sourceStandingId") REFERENCES "LeaderboardStanding"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FreeEntryCredit" ADD CONSTRAINT "FreeEntryCredit_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FreeEntryCredit" ADD CONSTRAINT "FreeEntryCredit_sourcePrizeId_fkey"
FOREIGN KEY ("sourcePrizeId") REFERENCES "Prize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
