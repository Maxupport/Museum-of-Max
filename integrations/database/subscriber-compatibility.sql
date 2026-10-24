-- Manual, additive repair for the VERIFIED production database only.
-- Do not run against a guessed/local database and do not use prisma db push.
-- Preflight: inspect Subscriber columns, record count, and existing indexes;
-- back up any existing rows before applying. This does not backfill tokens.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
ALTER TABLE public."Subscriber"
  ADD COLUMN IF NOT EXISTS "sourceChapter" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastNotifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_unsubscribeToken_key"
  ON public."Subscriber" ("unsubscribeToken");
COMMIT;
-- Recheck /api/subscribe/summary and the admin list after applying.
-- If existing rows have null tokens, prepare a separate secure-token backfill
-- before enabling mail; never invent or expose unsubscribe tokens in a report.
