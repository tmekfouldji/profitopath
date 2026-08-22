-- AlterTable
ALTER TABLE "InstrumentConfiguration"
ADD COLUMN "marketHoursMode" VARCHAR(32) NOT NULL DEFAULT 'UTC_24X5';

ALTER TABLE "Order"
ADD COLUMN "terminalReason" VARCHAR(500),
ADD COLUMN "protectedPositionId" UUID,
ADD COLUMN "ocoGroupId" VARCHAR(128),
ADD COLUMN "triggerQuoteSequence" BIGINT,
ADD COLUMN "triggeredAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "Order_symbol_status_type_acceptedAt_idx"
ON "Order"("symbol", "status", "type", "acceptedAt");

CREATE INDEX "Order_protectedPositionId_status_idx"
ON "Order"("protectedPositionId", "status");

CREATE INDEX "Order_ocoGroupId_status_idx"
ON "Order"("ocoGroupId", "status");

CREATE UNIQUE INDEX "Order_one_active_position_protection_key"
ON "Order"("protectedPositionId", "type")
WHERE "protectedPositionId" IS NOT NULL AND "status" = 'ACCEPTED';

-- AddForeignKey
ALTER TABLE "Order"
ADD CONSTRAINT "Order_protectedPositionId_fkey"
FOREIGN KEY ("protectedPositionId") REFERENCES "Position"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
