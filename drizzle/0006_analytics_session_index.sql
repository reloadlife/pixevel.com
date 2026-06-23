-- Additive: composite index for journey/session grouping on AnalyticsEvent.
-- db:push-safe, no column changes. IF NOT EXISTS so it is idempotent against a
-- database that already has it from a prior push.
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_sessionId_createdAt_idx" ON "AnalyticsEvent" USING btree ("sessionId","createdAt");
