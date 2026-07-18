CREATE TABLE "IbkrContractVersion" (
    "id" UUID NOT NULL,
    "conId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "securityType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "primaryExchange" TEXT NOT NULL,
    "localSymbol" TEXT NOT NULL,
    "minimumTick" DECIMAL(38,18) NOT NULL,
    "timeZoneId" TEXT NOT NULL,
    "tradingHours" TEXT NOT NULL,
    "liquidHours" TEXT NOT NULL,
    "longName" TEXT NOT NULL,
    "observedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IbkrContractVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IbkrContractVersion_fingerprint_key" ON "IbkrContractVersion"("fingerprint");
CREATE UNIQUE INDEX "IbkrContractVersion_conId_fingerprint_key" ON "IbkrContractVersion"("conId", "fingerprint");
CREATE INDEX "IbkrContractVersion_conId_observedAt_idx" ON "IbkrContractVersion"("conId", "observedAt");
