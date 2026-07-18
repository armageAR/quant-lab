CREATE TABLE "BacktestExperiment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "BacktestExperiment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BacktestRun" (
    "id" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "datasetId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "codeCommit" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "modelVersions" JSONB NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalEvents" INTEGER NOT NULL DEFAULT 0,
    "pauseRequested" BOOLEAN NOT NULL DEFAULT false,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "outputHash" TEXT,
    "metrics" JSONB,
    "results" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BacktestExperiment_createdAt_idx" ON "BacktestExperiment"("createdAt");
CREATE INDEX "BacktestRun_status_createdAt_idx" ON "BacktestRun"("status", "createdAt");
CREATE INDEX "BacktestRun_experimentId_createdAt_idx" ON "BacktestRun"("experimentId", "createdAt");
CREATE INDEX "BacktestRun_datasetId_createdAt_idx" ON "BacktestRun"("datasetId", "createdAt");

ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_experimentId_fkey"
FOREIGN KEY ("experimentId") REFERENCES "BacktestExperiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_datasetId_fkey"
FOREIGN KEY ("datasetId") REFERENCES "DatasetManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
