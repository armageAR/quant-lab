CREATE TABLE "StrategyDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategyVersion" (
    "id" UUID NOT NULL,
    "strategyId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "configurationSchema" JSONB NOT NULL,
    "requirements" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StrategyVersion_strategyId_version_key"
ON "StrategyVersion"("strategyId", "version");
CREATE INDEX "StrategyVersion_strategyId_createdAt_idx"
ON "StrategyVersion"("strategyId", "createdAt");

ALTER TABLE "StrategyVersion" ADD CONSTRAINT "StrategyVersion_strategyId_fkey"
FOREIGN KEY ("strategyId") REFERENCES "StrategyDefinition"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
