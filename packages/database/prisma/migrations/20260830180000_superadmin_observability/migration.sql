ALTER TYPE "UserRole" ADD VALUE 'SUPERADMIN';

CREATE TABLE "WebsiteVisit" (
    "id" UUID NOT NULL,
    "visitorHash" CHAR(64) NOT NULL,
    "visitDay" DATE NOT NULL,
    "entryPath" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteVisit_visitorHash_visitDay_key"
  ON "WebsiteVisit"("visitorHash", "visitDay");

CREATE INDEX "WebsiteVisit_visitDay_idx" ON "WebsiteVisit"("visitDay");
