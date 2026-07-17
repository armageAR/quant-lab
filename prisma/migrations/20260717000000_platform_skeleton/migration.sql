CREATE TABLE "PlatformEvent" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTime" TIMESTAMPTZ(6),
    "receivedAt" TIMESTAMPTZ(6) NOT NULL,
    "processedAt" TIMESTAMPTZ(6),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformEvent_source_eventType_eventTime_idx"
ON "PlatformEvent"("source", "eventType", "eventTime");
