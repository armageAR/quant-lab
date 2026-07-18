CREATE TABLE "ExecutableOpportunity" (
  "id" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "configurationId" TEXT NOT NULL,
  "canonicalSymbol" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "buyMarketId" TEXT NOT NULL,
  "sellMarketId" TEXT NOT NULL,
  "buyVenueId" TEXT NOT NULL,
  "sellVenueId" TEXT NOT NULL,
  "buyBookEventId" UUID NOT NULL,
  "sellBookEventId" UUID NOT NULL,
  "buyTakerFee" DECIMAL(38,18) NOT NULL,
  "sellTakerFee" DECIMAL(38,18) NOT NULL,
  "topOfBookSpread" DECIMAL(38,18),
  "bestSize" DECIMAL(38,18),
  "maxExecutableSize" DECIMAL(38,18),
  "grossProfit" DECIMAL(38,18),
  "feeCost" DECIMAL(38,18),
  "slippageCost" DECIMAL(38,18),
  "netProfit" DECIMAL(38,18),
  "netProfitRate" DECIMAL(38,18),
  "sizeEvaluations" JSONB NOT NULL,
  "buyFreshnessMs" INTEGER NOT NULL,
  "sellFreshnessMs" INTEGER NOT NULL,
  "crossVenueSkewMs" INTEGER NOT NULL,
  "rejectionReason" TEXT,
  "blockReason" TEXT,
  "evaluatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ExecutableOpportunity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExecutableOpportunity_idempotencyKey_key" ON "ExecutableOpportunity"("idempotencyKey");
CREATE INDEX "ExecutableOpportunity_canonicalSymbol_evaluatedAt_idx" ON "ExecutableOpportunity"("canonicalSymbol", "evaluatedAt");
CREATE INDEX "ExecutableOpportunity_classification_evaluatedAt_idx" ON "ExecutableOpportunity"("classification", "evaluatedAt");
CREATE INDEX "ExecutableOpportunity_rejectionReason_evaluatedAt_idx" ON "ExecutableOpportunity"("rejectionReason", "evaluatedAt");
ALTER TABLE "ExecutableOpportunity" ADD CONSTRAINT "ExecutableOpportunity_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "DetectorConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutableOpportunity" ADD CONSTRAINT "ExecutableOpportunity_buyBookEventId_fkey" FOREIGN KEY ("buyBookEventId") REFERENCES "MarketOrderBookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutableOpportunity" ADD CONSTRAINT "ExecutableOpportunity_sellBookEventId_fkey" FOREIGN KEY ("sellBookEventId") REFERENCES "MarketOrderBookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
