DROP INDEX "MarketCandle_symbol_timeframe_openTime_key";
DROP INDEX "MarketCandle_symbol_timeframe_isFinal_openTime_idx";

CREATE UNIQUE INDEX "MarketCandle_source_symbol_timeframe_openTime_key"
ON "MarketCandle"("source", "symbol", "timeframe", "openTime");

CREATE INDEX "MarketCandle_source_symbol_timeframe_isFinal_openTime_idx"
ON "MarketCandle"("source", "symbol", "timeframe", "isFinal", "openTime");
