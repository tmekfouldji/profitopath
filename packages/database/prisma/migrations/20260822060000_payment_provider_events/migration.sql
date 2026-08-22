-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "checkoutUrl" TEXT,
ADD COLUMN "expiresAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "PaymentProviderEvent" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerEventId" VARCHAR(128) NOT NULL,
    "providerPaymentId" VARCHAR(128) NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderEvent_provider_providerEventId_key" ON "PaymentProviderEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_paymentId_receivedAt_idx" ON "PaymentProviderEvent"("paymentId", "receivedAt");

-- AddForeignKey
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
