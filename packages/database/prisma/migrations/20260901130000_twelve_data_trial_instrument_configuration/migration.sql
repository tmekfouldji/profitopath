ALTER TABLE "InstrumentConfiguration"
ADD COLUMN "marketDataSource" VARCHAR(32) NOT NULL DEFAULT 'MOCK',
ADD COLUMN "syntheticSpread" DECIMAL(30,12);
