CREATE INDEX "VerificationToken_identifier_expires_idx"
  ON "VerificationToken"("identifier", "expires");
