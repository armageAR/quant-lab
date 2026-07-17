CREATE TABLE "Venue" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Venue_code_key" ON "Venue"("code");
CREATE TABLE "Instrument" (
  "id" TEXT NOT NULL, "kind" TEXT NOT NULL, "baseCurrency" TEXT NOT NULL, "quoteCurrency" TEXT NOT NULL,
  "canonicalSymbol" TEXT NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Instrument_canonicalSymbol_key" ON "Instrument"("canonicalSymbol");
CREATE TABLE "Market" (
  "id" TEXT NOT NULL, "venueId" TEXT NOT NULL, "instrumentId" TEXT NOT NULL, "venueSymbol" TEXT NOT NULL,
  "status" TEXT NOT NULL, "spot" BOOLEAN NOT NULL, "firstSeenAt" TIMESTAMPTZ(6) NOT NULL,
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Market_venueId_venueSymbol_key" ON "Market"("venueId", "venueSymbol");
CREATE INDEX "Market_instrumentId_status_spot_idx" ON "Market"("instrumentId", "status", "spot");
CREATE TABLE "MarketAlias" (
  "id" UUID NOT NULL, "venueId" TEXT NOT NULL, "marketId" TEXT NOT NULL, "alias" TEXT NOT NULL,
  "validFrom" TIMESTAMPTZ(6) NOT NULL, "validTo" TIMESTAMPTZ(6), CONSTRAINT "MarketAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketAlias_venueId_alias_validFrom_key" ON "MarketAlias"("venueId", "alias", "validFrom");
CREATE INDEX "MarketAlias_marketId_validTo_idx" ON "MarketAlias"("marketId", "validTo");
CREATE TABLE "TradingRuleVersion" (
  "id" UUID NOT NULL, "marketId" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
  "priceIncrement" DECIMAL(38,18) NOT NULL, "quantityIncrement" DECIMAL(38,18) NOT NULL,
  "minimumQuantity" DECIMAL(38,18), "maximumQuantity" DECIMAL(38,18), "minimumNotional" DECIMAL(38,18),
  "effectiveAt" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "TradingRuleVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TradingRuleVersion_marketId_fingerprint_key" ON "TradingRuleVersion"("marketId", "fingerprint");
CREATE INDEX "TradingRuleVersion_marketId_effectiveAt_idx" ON "TradingRuleVersion"("marketId", "effectiveAt");
CREATE TABLE "FeeScheduleVersion" (
  "id" UUID NOT NULL, "marketId" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
  "maker" DECIMAL(38,18) NOT NULL, "taker" DECIMAL(38,18) NOT NULL, "source" TEXT NOT NULL,
  "effectiveAt" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "FeeScheduleVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeeScheduleVersion_marketId_fingerprint_key" ON "FeeScheduleVersion"("marketId", "fingerprint");
CREATE INDEX "FeeScheduleVersion_marketId_effectiveAt_idx" ON "FeeScheduleVersion"("marketId", "effectiveAt");
CREATE TABLE "CapabilitySnapshot" (
  "id" UUID NOT NULL, "venueId" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "capabilities" JSONB NOT NULL,
  "observedAt" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "CapabilitySnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CapabilitySnapshot_venueId_fingerprint_key" ON "CapabilitySnapshot"("venueId", "fingerprint");
CREATE INDEX "CapabilitySnapshot_venueId_observedAt_idx" ON "CapabilitySnapshot"("venueId", "observedAt");
ALTER TABLE "Market" ADD CONSTRAINT "Market_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Market" ADD CONSTRAINT "Market_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketAlias" ADD CONSTRAINT "MarketAlias_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketAlias" ADD CONSTRAINT "MarketAlias_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TradingRuleVersion" ADD CONSTRAINT "TradingRuleVersion_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeScheduleVersion" ADD CONSTRAINT "FeeScheduleVersion_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilitySnapshot" ADD CONSTRAINT "CapabilitySnapshot_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
