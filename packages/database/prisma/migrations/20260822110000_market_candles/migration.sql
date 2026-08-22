-- CreateTable
CREATE TABLE "MarketCandle" (
    "id" UUID NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "timeframe" VARCHAR(8) NOT NULL,
    "openTime" TIMESTAMPTZ(3) NOT NULL,
    "closeTime" TIMESTAMPTZ(3) NOT NULL,
    "open" DECIMAL(30,12) NOT NULL,
    "high" DECIMAL(30,12) NOT NULL,
    "low" DECIMAL(30,12) NOT NULL,
    "close" DECIMAL(30,12) NOT NULL,
    "volume" DECIMAL(38,12),
    "source" VARCHAR(32) NOT NULL,
    "isFinal" BOOLEAN NOT NULL,
    "dataVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MarketCandle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketCandle_symbol_timeframe_openTime_key"
ON "MarketCandle"("symbol", "timeframe", "openTime");

CREATE INDEX "MarketCandle_symbol_timeframe_isFinal_openTime_idx"
ON "MarketCandle"("symbol", "timeframe", "isFinal", "openTime");
