CREATE TABLE "IbkrHistoricalBar" (
  "id" UUID NOT NULL,
  "conId" TEXT NOT NULL,
  "eventTime" TIMESTAMPTZ(6) NOT NULL,
  "receivedAt" TIMESTAMPTZ(6) NOT NULL,
  "processedAt" TIMESTAMPTZ(6) NOT NULL,
  "sourcePrecision" TEXT NOT NULL,
  "open" DECIMAL(38,18) NOT NULL,
  "high" DECIMAL(38,18) NOT NULL,
  "low" DECIMAL(38,18) NOT NULL,
  "close" DECIMAL(38,18) NOT NULL,
  "volume" DECIMAL(38,18) NOT NULL,
  "tradeCount" INTEGER,
  "requestId" TEXT NOT NULL,
  "useRth" BOOLEAN NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IbkrHistoricalBar_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IbkrHistoricalBar_conId_eventTime_sourcePrecision_key"
  ON "IbkrHistoricalBar"("conId", "eventTime", "sourcePrecision");
CREATE INDEX "IbkrHistoricalBar_conId_eventTime_idx"
  ON "IbkrHistoricalBar"("conId", "eventTime");
