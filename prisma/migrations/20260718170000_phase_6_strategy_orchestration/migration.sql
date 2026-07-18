CREATE TABLE "StrategyParameterSet" (
    "id" UUID NOT NULL,
    "strategyVersionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyParameterSet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StrategyParameterSet_fingerprint_key" ON "StrategyParameterSet"("fingerprint");
CREATE INDEX "StrategyParameterSet_strategyVersionId_createdAt_idx" ON "StrategyParameterSet"("strategyVersionId", "createdAt");

CREATE TABLE "StrategyRun" (
    "id" UUID NOT NULL,
    "strategyVersionId" UUID NOT NULL,
    "parameterSetId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "inputKind" TEXT NOT NULL,
    "inputReference" TEXT NOT NULL,
    "sourceCommit" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "StrategyRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StrategyRun_status_scheduledAt_idx" ON "StrategyRun"("status", "scheduledAt");
CREATE INDEX "StrategyRun_strategyVersionId_createdAt_idx" ON "StrategyRun"("strategyVersionId", "createdAt");

CREATE TABLE "StrategyRunAuditEvent" (
    "id" UUID NOT NULL,
    "strategyRunId" UUID NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyRunAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StrategyRunAuditEvent_strategyRunId_createdAt_idx" ON "StrategyRunAuditEvent"("strategyRunId", "createdAt");

ALTER TABLE "StrategyParameterSet" ADD CONSTRAINT "StrategyParameterSet_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrategyRun" ADD CONSTRAINT "StrategyRun_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrategyRun" ADD CONSTRAINT "StrategyRun_parameterSetId_fkey" FOREIGN KEY ("parameterSetId") REFERENCES "StrategyParameterSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrategyRunAuditEvent" ADD CONSTRAINT "StrategyRunAuditEvent_strategyRunId_fkey" FOREIGN KEY ("strategyRunId") REFERENCES "StrategyRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
