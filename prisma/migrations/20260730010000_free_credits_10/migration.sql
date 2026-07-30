-- Align the free-tier credit grant with the Clerk dashboard, which advertises
-- 10 generations/month on the free plan. Mirrors PLANS.free.generations in
-- src/lib/constants.ts — the two must stay in sync.
-- Existing rows keep their current balances; this only changes new signups.
ALTER TABLE "User" ALTER COLUMN "credits" SET DEFAULT 10;
