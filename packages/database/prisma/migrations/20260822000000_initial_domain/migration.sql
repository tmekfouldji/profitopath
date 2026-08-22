-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TRADER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'FROZEN', 'FINALIZED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompetitionEntryStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'COMPLETED', 'BREACHED', 'DISQUALIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TradingAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'BREACHED', 'DISQUALIFIED', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP', 'STOP_LOSS', 'TAKE_PROFIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PositionSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "BalanceLedgerType" AS ENUM ('INITIAL_BALANCE', 'REALIZED_PNL', 'COMMISSION', 'SWAP', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RuleBreachType" AS ENUM ('MAX_DRAWDOWN', 'DAILY_LOSS', 'WEEKLY_CUTOFF', 'ADMIN_DISQUALIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MOCK');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PrizeStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PAYOUT_PENDING', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TRADER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" UUID NOT NULL,
    "countryCode" CHAR(2),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "termsVersion" VARCHAR(50),
    "acceptedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ChallengeTier" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "entryFeeMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "maxDrawdownMinor" BIGINT NOT NULL,
    "performanceBenchmarkMinor" BIGINT NOT NULL,
    "startingBalanceMinor" BIGINT NOT NULL,
    "rulesVersion" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChallengeTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "signupClosesAt" TIMESTAMPTZ(3) NOT NULL,
    "tradingStartsAt" TIMESTAMPTZ(3) NOT NULL,
    "tradingEndsAt" TIMESTAMPTZ(3) NOT NULL,
    "rulesVersion" INTEGER NOT NULL,
    "finalizedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "competitionId" UUID NOT NULL,
    "tierId" UUID NOT NULL,
    "status" "CompetitionEntryStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "activatedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "disqualifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CompetitionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingAccount" (
    "id" UUID NOT NULL,
    "competitionEntryId" UUID NOT NULL,
    "status" "TradingAccountStatus" NOT NULL DEFAULT 'PENDING',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "startingBalanceMinor" BIGINT NOT NULL,
    "balanceMinor" BIGINT NOT NULL,
    "realizedPnlMinor" BIGINT NOT NULL DEFAULT 0,
    "configVersion" INTEGER NOT NULL,
    "breachedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "tradingAccountId" UUID NOT NULL,
    "clientOrderId" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" DECIMAL(30,12) NOT NULL,
    "filledQuantity" DECIMAL(30,12) NOT NULL DEFAULT 0,
    "requestedPrice" DECIMAL(30,12),
    "limitPrice" DECIMAL(30,12),
    "stopPrice" DECIMAL(30,12),
    "stopLossPrice" DECIMAL(30,12),
    "takeProfitPrice" DECIMAL(30,12),
    "averageFillPrice" DECIMAL(30,12),
    "rejectionReason" VARCHAR(500),
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" UUID NOT NULL,
    "engineEventId" VARCHAR(128) NOT NULL,
    "orderId" UUID NOT NULL,
    "tradingAccountId" UUID NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "side" "OrderSide" NOT NULL,
    "quantity" DECIMAL(30,12) NOT NULL,
    "price" DECIMAL(30,12) NOT NULL,
    "notional" DECIMAL(38,12) NOT NULL,
    "commission" DECIMAL(30,12) NOT NULL DEFAULT 0,
    "executedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" UUID NOT NULL,
    "tradingAccountId" UUID NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "side" "PositionSide" NOT NULL,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "quantity" DECIMAL(30,12) NOT NULL,
    "averageEntryPrice" DECIMAL(30,12) NOT NULL,
    "realizedPnl" DECIMAL(30,12) NOT NULL DEFAULT 0,
    "stopLossPrice" DECIMAL(30,12),
    "takeProfitPrice" DECIMAL(30,12),
    "openedAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosedTrade" (
    "id" UUID NOT NULL,
    "tradingAccountId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "openingExecutionId" UUID NOT NULL,
    "closingExecutionId" UUID NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "side" "PositionSide" NOT NULL,
    "quantity" DECIMAL(30,12) NOT NULL,
    "entryPrice" DECIMAL(30,12) NOT NULL,
    "exitPrice" DECIMAL(30,12) NOT NULL,
    "realizedPnl" DECIMAL(30,12) NOT NULL,
    "commission" DECIMAL(30,12) NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosedTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountBalanceLedgerEntry" (
    "id" UUID NOT NULL,
    "tradingAccountId" UUID NOT NULL,
    "type" "BalanceLedgerType" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "balanceAfterMinor" BIGINT NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "referenceType" VARCHAR(64),
    "referenceId" VARCHAR(128),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountBalanceLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSnapshot" (
    "id" UUID NOT NULL,
    "tradingAccountId" UUID NOT NULL,
    "sequence" BIGINT NOT NULL,
    "balanceMinor" BIGINT NOT NULL,
    "equityMinor" BIGINT NOT NULL,
    "marginUsedMinor" BIGINT NOT NULL,
    "marginFreeMinor" BIGINT NOT NULL,
    "unrealizedPnlMinor" BIGINT NOT NULL,
    "maxDrawdownMinor" BIGINT NOT NULL,
    "dataVersion" INTEGER NOT NULL,
    "asOf" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleBreach" (
    "id" UUID NOT NULL,
    "tradingAccountId" UUID NOT NULL,
    "type" "RuleBreachType" NOT NULL,
    "observedMinor" BIGINT,
    "thresholdMinor" BIGINT,
    "rulesVersion" INTEGER NOT NULL,
    "sourceEventId" VARCHAR(128) NOT NULL,
    "details" JSONB,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleBreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "competitionEntryId" UUID,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MOCK',
    "providerPaymentId" VARCHAR(128),
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "metadata" JSONB,
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prize" (
    "id" UUID NOT NULL,
    "competitionId" UUID NOT NULL,
    "tierId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "freeEntryCredits" INTEGER NOT NULL DEFAULT 0,
    "status" "PrizeStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "winnerEntryId" UUID,
    "reviewReason" VARCHAR(1000),
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Prize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" UUID NOT NULL,
    "prizeId" UUID NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "transactionReference" VARCHAR(255),
    "approvedAt" TIMESTAMPTZ(3),
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardFinalization" (
    "id" UUID NOT NULL,
    "competitionId" UUID NOT NULL,
    "rulesVersion" INTEGER NOT NULL,
    "resultHash" VARCHAR(128) NOT NULL,
    "result" JSONB NOT NULL,
    "finalizedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardFinalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(128) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(1000),
    "before" JSONB,
    "after" JSONB,
    "correlationId" VARCHAR(128),
    "idempotencyKey" VARCHAR(128),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeTier_code_key" ON "ChallengeTier"("code");

-- CreateIndex
CREATE INDEX "ChallengeTier_active_idx" ON "ChallengeTier"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_code_key" ON "Competition"("code");

-- CreateIndex
CREATE INDEX "Competition_status_tradingStartsAt_tradingEndsAt_idx" ON "Competition"("status", "tradingStartsAt", "tradingEndsAt");

-- CreateIndex
CREATE INDEX "CompetitionEntry_competitionId_tierId_status_idx" ON "CompetitionEntry"("competitionId", "tierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionEntry_userId_competitionId_tierId_key" ON "CompetitionEntry"("userId", "competitionId", "tierId");

-- CreateIndex
CREATE UNIQUE INDEX "TradingAccount_competitionEntryId_key" ON "TradingAccount"("competitionEntryId");

-- CreateIndex
CREATE INDEX "TradingAccount_status_idx" ON "TradingAccount"("status");

-- CreateIndex
CREATE INDEX "Order_tradingAccountId_status_idx" ON "Order"("tradingAccountId", "status");

-- CreateIndex
CREATE INDEX "Order_symbol_status_idx" ON "Order"("symbol", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tradingAccountId_clientOrderId_key" ON "Order"("tradingAccountId", "clientOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Execution_engineEventId_key" ON "Execution"("engineEventId");

-- CreateIndex
CREATE INDEX "Execution_tradingAccountId_executedAt_idx" ON "Execution"("tradingAccountId", "executedAt");

-- CreateIndex
CREATE INDEX "Execution_orderId_executedAt_idx" ON "Execution"("orderId", "executedAt");

-- CreateIndex
CREATE INDEX "Position_tradingAccountId_symbol_status_idx" ON "Position"("tradingAccountId", "symbol", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClosedTrade_closingExecutionId_key" ON "ClosedTrade"("closingExecutionId");

-- CreateIndex
CREATE INDEX "ClosedTrade_tradingAccountId_closedAt_idx" ON "ClosedTrade"("tradingAccountId", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBalanceLedgerEntry_idempotencyKey_key" ON "AccountBalanceLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AccountBalanceLedgerEntry_tradingAccountId_occurredAt_idx" ON "AccountBalanceLedgerEntry"("tradingAccountId", "occurredAt");

-- CreateIndex
CREATE INDEX "AccountSnapshot_tradingAccountId_asOf_idx" ON "AccountSnapshot"("tradingAccountId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "AccountSnapshot_tradingAccountId_sequence_key" ON "AccountSnapshot"("tradingAccountId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RuleBreach_sourceEventId_key" ON "RuleBreach"("sourceEventId");

-- CreateIndex
CREATE INDEX "RuleBreach_tradingAccountId_occurredAt_idx" ON "RuleBreach"("tradingAccountId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Prize_winnerEntryId_key" ON "Prize"("winnerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Prize_competitionId_tierId_rank_key" ON "Prize"("competitionId", "tierId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_prizeId_key" ON "Payout"("prizeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_transactionReference_key" ON "Payout"("transactionReference");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardFinalization_competitionId_key" ON "LeaderboardFinalization"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_idempotencyKey_key" ON "AuditEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "ChallengeTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_competitionEntryId_fkey" FOREIGN KEY ("competitionEntryId") REFERENCES "CompetitionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosedTrade" ADD CONSTRAINT "ClosedTrade_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosedTrade" ADD CONSTRAINT "ClosedTrade_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosedTrade" ADD CONSTRAINT "ClosedTrade_openingExecutionId_fkey" FOREIGN KEY ("openingExecutionId") REFERENCES "Execution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosedTrade" ADD CONSTRAINT "ClosedTrade_closingExecutionId_fkey" FOREIGN KEY ("closingExecutionId") REFERENCES "Execution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountBalanceLedgerEntry" ADD CONSTRAINT "AccountBalanceLedgerEntry_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSnapshot" ADD CONSTRAINT "AccountSnapshot_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleBreach" ADD CONSTRAINT "RuleBreach_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_competitionEntryId_fkey" FOREIGN KEY ("competitionEntryId") REFERENCES "CompetitionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "ChallengeTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "CompetitionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "Prize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardFinalization" ADD CONSTRAINT "LeaderboardFinalization_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce one net open position per account/symbol while retaining unlimited closed history.
CREATE UNIQUE INDEX "Position_one_open_per_symbol_key"
ON "Position"("tradingAccountId", "symbol")
WHERE "status" = 'OPEN';
