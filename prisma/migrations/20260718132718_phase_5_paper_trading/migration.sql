-- CreateTable
CREATE TABLE "PaperSession" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "strategyVersion" TEXT NOT NULL,
    "codeCommit" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "startedAt" TIMESTAMPTZ(6),
    "stoppedAt" TIMESTAMPTZ(6),
    "emergencyAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PaperSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperAccount" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "venueId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "available" DECIMAL(38,18) NOT NULL,
    "reserved" DECIMAL(38,18) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PaperAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperOrder" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "opportunityId" UUID,
    "strategyVersion" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestedQuantity" DECIMAL(38,18) NOT NULL,
    "filledQuantity" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "averagePrice" DECIMAL(38,18),
    "expectedProfit" DECIMAL(38,18),
    "simulatedProfit" DECIMAL(38,18),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PaperOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperFill" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "quantity" DECIMAL(38,18) NOT NULL,
    "price" DECIMAL(38,18) NOT NULL,
    "fee" DECIMAL(38,18) NOT NULL,
    "feeAsset" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "evidence" JSONB NOT NULL,

    CONSTRAINT "PaperFill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperLedgerEntry" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "fillId" UUID,
    "groupId" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperAlert" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PaperAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperCampaign" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "minimumDurationHours" INTEGER NOT NULL,
    "minimumSampleCount" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "decision" TEXT,
    "report" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaperSession_status_createdAt_idx" ON "PaperSession"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAccount_sessionId_venueId_asset_key" ON "PaperAccount"("sessionId", "venueId", "asset");

-- CreateIndex
CREATE UNIQUE INDEX "PaperOrder_idempotencyKey_key" ON "PaperOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaperOrder_sessionId_createdAt_idx" ON "PaperOrder"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "PaperOrder_status_createdAt_idx" ON "PaperOrder"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaperFill_idempotencyKey_key" ON "PaperFill"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaperFill_orderId_occurredAt_idx" ON "PaperFill"("orderId", "occurredAt");

-- CreateIndex
CREATE INDEX "PaperLedgerEntry_groupId_idx" ON "PaperLedgerEntry"("groupId");

-- CreateIndex
CREATE INDEX "PaperLedgerEntry_accountId_createdAt_idx" ON "PaperLedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "PaperAlert_sessionId_createdAt_idx" ON "PaperAlert"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "PaperCampaign_sessionId_createdAt_idx" ON "PaperCampaign"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaperAccount" ADD CONSTRAINT "PaperAccount_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PaperSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperOrder" ADD CONSTRAINT "PaperOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PaperSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperFill" ADD CONSTRAINT "PaperFill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaperOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperLedgerEntry" ADD CONSTRAINT "PaperLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperLedgerEntry" ADD CONSTRAINT "PaperLedgerEntry_fillId_fkey" FOREIGN KEY ("fillId") REFERENCES "PaperFill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperAlert" ADD CONSTRAINT "PaperAlert_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PaperSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperCampaign" ADD CONSTRAINT "PaperCampaign_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PaperSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
