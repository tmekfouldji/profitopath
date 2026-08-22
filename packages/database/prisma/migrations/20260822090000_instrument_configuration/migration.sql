-- CreateTable
CREATE TABLE "InstrumentConfiguration" (
    "id" UUID NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "baseCurrency" CHAR(3) NOT NULL,
    "quoteCurrency" CHAR(3) NOT NULL,
    "priceScale" INTEGER NOT NULL,
    "quantityStep" DECIMAL(30,12) NOT NULL,
    "minimumQuantity" DECIMAL(30,12) NOT NULL,
    "contractSize" DECIMAL(30,12) NOT NULL,
    "leverage" DECIMAL(30,12) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InstrumentConfiguration_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "instrumentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Execution" ADD COLUMN "instrumentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Position" ADD COLUMN "instrumentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Position" ADD COLUMN "openingExecutionId" UUID;
ALTER TABLE "ClosedTrade" ADD COLUMN "instrumentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AccountSnapshot" ADD COLUMN "sourceEventId" VARCHAR(128);

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentConfiguration_symbol_version_key" ON "InstrumentConfiguration"("symbol", "version");
CREATE UNIQUE INDEX "InstrumentConfiguration_one_active_symbol_key" ON "InstrumentConfiguration"("symbol") WHERE "active" = true;
CREATE INDEX "InstrumentConfiguration_active_symbol_idx" ON "InstrumentConfiguration"("active", "symbol");
CREATE UNIQUE INDEX "Position_one_open_account_symbol_key" ON "Position"("tradingAccountId", "symbol") WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "AccountSnapshot_sourceEventId_key" ON "AccountSnapshot"("sourceEventId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_symbol_instrumentVersion_fkey" FOREIGN KEY ("symbol", "instrumentVersion") REFERENCES "InstrumentConfiguration"("symbol", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_symbol_instrumentVersion_fkey" FOREIGN KEY ("symbol", "instrumentVersion") REFERENCES "InstrumentConfiguration"("symbol", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_symbol_instrumentVersion_fkey" FOREIGN KEY ("symbol", "instrumentVersion") REFERENCES "InstrumentConfiguration"("symbol", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_openingExecutionId_fkey" FOREIGN KEY ("openingExecutionId") REFERENCES "Execution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClosedTrade" ADD CONSTRAINT "ClosedTrade_symbol_instrumentVersion_fkey" FOREIGN KEY ("symbol", "instrumentVersion") REFERENCES "InstrumentConfiguration"("symbol", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
