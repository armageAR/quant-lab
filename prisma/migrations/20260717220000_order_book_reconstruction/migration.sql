CREATE TABLE "MarketOrderBookEvent" (
  "id" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sequence" TEXT NOT NULL,
  "previousSequence" TEXT,
  "eventTime" TIMESTAMPTZ(6),
  "receivedAt" TIMESTAMPTZ(6) NOT NULL,
  "processedAt" TIMESTAMPTZ(6) NOT NULL,
  "bids" JSONB NOT NULL,
  "asks" JSONB NOT NULL,
  "checksum" TEXT,
  "depth" INTEGER NOT NULL,
  "rawEnvelopeId" UUID NOT NULL,
  CONSTRAINT "MarketOrderBookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderBookInvalidation" (
  "id" UUID NOT NULL,
  "marketId" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "sequence" TEXT,
  "reason" TEXT NOT NULL,
  "details" JSONB,
  "detectedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "OrderBookInvalidation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketOrderBookEvent_idempotencyKey_key" ON "MarketOrderBookEvent"("idempotencyKey");
CREATE UNIQUE INDEX "MarketOrderBookEvent_marketId_sequence_kind_key" ON "MarketOrderBookEvent"("marketId", "sequence", "kind");
CREATE INDEX "MarketOrderBookEvent_marketId_eventTime_id_idx" ON "MarketOrderBookEvent"("marketId", "eventTime", "id");
CREATE INDEX "MarketOrderBookEvent_marketId_kind_processedAt_idx" ON "MarketOrderBookEvent"("marketId", "kind", "processedAt");
CREATE INDEX "OrderBookInvalidation_marketId_detectedAt_idx" ON "OrderBookInvalidation"("marketId", "detectedAt");

ALTER TABLE "MarketOrderBookEvent" ADD CONSTRAINT "MarketOrderBookEvent_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderBookInvalidation" ADD CONSTRAINT "OrderBookInvalidation_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
