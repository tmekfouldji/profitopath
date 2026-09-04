CREATE TABLE "MarketDataCoverage" (
    "id" UUID NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "timeframe" VARCHAR(8) NOT NULL,
    "rangeStart" TIMESTAMPTZ(3) NOT NULL,
    "rangeEnd" TIMESTAMPTZ(3) NOT NULL,
    "dataVersion" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MarketDataCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketDataCoverage_unique_range"
ON "MarketDataCoverage"("source", "symbol", "timeframe", "rangeStart", "rangeEnd");

CREATE INDEX "MarketDataCoverage_lookup_range"
ON "MarketDataCoverage"("source", "symbol", "timeframe", "rangeStart", "rangeEnd");
