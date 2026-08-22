-- CreateEnum
CREATE TYPE "LeaderboardEligibilityStatus" AS ENUM (
    'ELIGIBLE',
    'ENTRY_STATUS',
    'ACCOUNT_STATUS',
    'RULE_BREACH',
    'DISQUALIFIED',
    'MISSING_SNAPSHOT'
);

-- CreateTable
CREATE TABLE "LeaderboardScoreInput" (
    "id" UUID NOT NULL,
    "competitionId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "tierId" UUID NOT NULL,
    "tradingAccountId" UUID NOT NULL,
    "sourceSnapshotId" UUID,
    "policyVersion" INTEGER NOT NULL,
    "eligibilityStatus" "LeaderboardEligibilityStatus" NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "startingBalanceMinor" BIGINT NOT NULL,
    "equityMinor" BIGINT NOT NULL,
    "netPerformanceMinor" BIGINT NOT NULL,
    "maxObservedDrawdownMinor" BIGINT NOT NULL,
    "finalScoreReachedAt" TIMESTAMPTZ(3) NOT NULL,
    "activatedAt" TIMESTAMPTZ(3) NOT NULL,
    "cutoffAt" TIMESTAMPTZ(3) NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "dataVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardScoreInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardStanding" (
    "id" UUID NOT NULL,
    "finalizationId" UUID NOT NULL,
    "competitionId" UUID NOT NULL,
    "tierId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isTied" BOOLEAN NOT NULL DEFAULT false,
    "displayName" VARCHAR(100) NOT NULL,
    "startingBalanceMinor" BIGINT NOT NULL,
    "equityMinor" BIGINT NOT NULL,
    "netPerformanceMinor" BIGINT NOT NULL,
    "maxObservedDrawdownMinor" BIGINT NOT NULL,
    "finalScoreReachedAt" TIMESTAMPTZ(3) NOT NULL,
    "activatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardStanding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardScoreInput_competitionId_entryId_policyVersion_key"
ON "LeaderboardScoreInput"("competitionId", "entryId", "policyVersion");

CREATE INDEX "LeaderboardScoreInput_competitionId_tierId_eligibilityStatus_idx"
ON "LeaderboardScoreInput"("competitionId", "tierId", "eligibilityStatus");

CREATE INDEX "LeaderboardScoreInput_tradingAccountId_cutoffAt_idx"
ON "LeaderboardScoreInput"("tradingAccountId", "cutoffAt");

CREATE UNIQUE INDEX "LeaderboardStanding_finalizationId_entryId_key"
ON "LeaderboardStanding"("finalizationId", "entryId");

CREATE UNIQUE INDEX "LeaderboardStanding_finalizationId_tierId_displayOrder_key"
ON "LeaderboardStanding"("finalizationId", "tierId", "displayOrder");

CREATE INDEX "LeaderboardStanding_competitionId_tierId_rank_displayOrder_idx"
ON "LeaderboardStanding"("competitionId", "tierId", "rank", "displayOrder");

-- AddForeignKey
ALTER TABLE "LeaderboardScoreInput"
ADD CONSTRAINT "LeaderboardScoreInput_competitionId_fkey"
FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaderboardScoreInput"
ADD CONSTRAINT "LeaderboardScoreInput_entryId_fkey"
FOREIGN KEY ("entryId") REFERENCES "CompetitionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaderboardScoreInput"
ADD CONSTRAINT "LeaderboardScoreInput_tierId_fkey"
FOREIGN KEY ("tierId") REFERENCES "ChallengeTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaderboardScoreInput"
ADD CONSTRAINT "LeaderboardScoreInput_tradingAccountId_fkey"
FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaderboardScoreInput"
ADD CONSTRAINT "LeaderboardScoreInput_sourceSnapshotId_fkey"
FOREIGN KEY ("sourceSnapshotId") REFERENCES "AccountSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaderboardStanding"
ADD CONSTRAINT "LeaderboardStanding_finalizationId_fkey"
FOREIGN KEY ("finalizationId") REFERENCES "LeaderboardFinalization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaderboardStanding"
ADD CONSTRAINT "LeaderboardStanding_competitionId_fkey"
FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaderboardStanding"
ADD CONSTRAINT "LeaderboardStanding_tierId_fkey"
FOREIGN KEY ("tierId") REFERENCES "ChallengeTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaderboardStanding"
ADD CONSTRAINT "LeaderboardStanding_entryId_fkey"
FOREIGN KEY ("entryId") REFERENCES "CompetitionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
