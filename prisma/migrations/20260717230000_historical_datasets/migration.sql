CREATE TABLE "DatasetManifest" (
  "id" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "from" TIMESTAMPTZ(6) NOT NULL,
  "to" TIMESTAMPTZ(6) NOT NULL,
  "eventCount" INTEGER NOT NULL,
  "sourceCoverage" JSONB NOT NULL,
  "qualityReport" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" TIMESTAMPTZ(6),
  "pinnedAt" TIMESTAMPTZ(6),
  "exportedAt" TIMESTAMPTZ(6),
  "exportPath" TEXT,
  "compactedAt" TIMESTAMPTZ(6),
  CONSTRAINT "DatasetManifest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DatasetMarket" (
  "manifestId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  CONSTRAINT "DatasetMarket_pkey" PRIMARY KEY ("manifestId", "marketId")
);
CREATE TABLE "DatasetEvent" (
  "manifestId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  "checksum" TEXT NOT NULL,
  CONSTRAINT "DatasetEvent_pkey" PRIMARY KEY ("manifestId", "ordinal")
);
CREATE UNIQUE INDEX "DatasetManifest_checksum_key" ON "DatasetManifest"("checksum");
CREATE INDEX "DatasetManifest_createdAt_idx" ON "DatasetManifest"("createdAt");
CREATE INDEX "DatasetManifest_pinnedAt_idx" ON "DatasetManifest"("pinnedAt");
CREATE INDEX "DatasetMarket_marketId_idx" ON "DatasetMarket"("marketId");
CREATE UNIQUE INDEX "DatasetEvent_manifestId_eventType_sourceId_key" ON "DatasetEvent"("manifestId", "eventType", "sourceId");
CREATE INDEX "DatasetEvent_eventType_sourceId_idx" ON "DatasetEvent"("eventType", "sourceId");
ALTER TABLE "DatasetMarket" ADD CONSTRAINT "DatasetMarket_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "DatasetManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DatasetMarket" ADD CONSTRAINT "DatasetMarket_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DatasetEvent" ADD CONSTRAINT "DatasetEvent_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "DatasetManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
