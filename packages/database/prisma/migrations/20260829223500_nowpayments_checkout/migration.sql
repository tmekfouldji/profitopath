ALTER TYPE "PaymentProvider" ADD VALUE 'NOWPAYMENTS';

ALTER TABLE "Payment"
ADD COLUMN "providerInvoiceId" VARCHAR(128);

CREATE UNIQUE INDEX "Payment_providerInvoiceId_key"
ON "Payment"("providerInvoiceId");
