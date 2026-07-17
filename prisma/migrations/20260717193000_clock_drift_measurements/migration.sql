CREATE TABLE "ClockDriftMeasurement" ("id" UUID NOT NULL, "venueId" TEXT NOT NULL, "sampledAt" TIMESTAMPTZ(6) NOT NULL, "serverTime" TIMESTAMPTZ(6) NOT NULL, "driftMicroseconds" BIGINT NOT NULL, "roundTripMicroseconds" BIGINT NOT NULL, CONSTRAINT "ClockDriftMeasurement_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ClockDriftMeasurement_venueId_sampledAt_idx" ON "ClockDriftMeasurement"("venueId", "sampledAt");
ALTER TABLE "ClockDriftMeasurement" ADD CONSTRAINT "ClockDriftMeasurement_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
