CREATE TABLE "DetectorConfiguration" (
  "id" TEXT NOT NULL,
  "detectorId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "configuration" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DetectorConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ObservedOpportunity" (
  "id" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "configurationId" TEXT NOT NULL,
  "canonicalSymbol" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "buyMarketId" TEXT NOT NULL,
  "sellMarketId" TEXT NOT NULL,
  "buyBookEventId" UUID NOT NULL,
  "sellBookEventId" UUID NOT NULL,
  "buyPrice" DECIMAL(38,18),
  "sellPrice" DECIMAL(38,18),
  "observedSpread" DECIMAL(38,18),
  "buyFreshnessMs" INTEGER NOT NULL,
  "sellFreshnessMs" INTEGER NOT NULL,
  "crossVenueSkewMs" INTEGER NOT NULL,
  "rejectionReason" TEXT,
  "evaluatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ObservedOpportunity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DetectorConfiguration_fingerprint_key" ON "DetectorConfiguration"("fingerprint");
CREATE UNIQUE INDEX "DetectorConfiguration_detectorId_version_fingerprint_key" ON "DetectorConfiguration"("detectorId", "version", "fingerprint");
CREATE UNIQUE INDEX "ObservedOpportunity_idempotencyKey_key" ON "ObservedOpportunity"("idempotencyKey");
CREATE INDEX "ObservedOpportunity_canonicalSymbol_evaluatedAt_idx" ON "ObservedOpportunity"("canonicalSymbol", "evaluatedAt");
CREATE INDEX "ObservedOpportunity_classification_evaluatedAt_idx" ON "ObservedOpportunity"("classification", "evaluatedAt");
CREATE INDEX "ObservedOpportunity_rejectionReason_evaluatedAt_idx" ON "ObservedOpportunity"("rejectionReason", "evaluatedAt");
ALTER TABLE "ObservedOpportunity" ADD CONSTRAINT "ObservedOpportunity_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "DetectorConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObservedOpportunity" ADD CONSTRAINT "ObservedOpportunity_buyBookEventId_fkey" FOREIGN KEY ("buyBookEventId") REFERENCES "MarketOrderBookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObservedOpportunity" ADD CONSTRAINT "ObservedOpportunity_sellBookEventId_fkey" FOREIGN KEY ("sellBookEventId") REFERENCES "MarketOrderBookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
