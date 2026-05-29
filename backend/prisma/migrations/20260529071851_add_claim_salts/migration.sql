-- Add claim_salts column with a placeholder default for existing rows.
-- Existing credentials issued before this migration lack real salts and
-- will fail proof generation — they should be re-issued. New credentials
-- will always have proper per-field random salts generated at issuance.
ALTER TABLE "credentials" ADD COLUMN "claim_salts" JSONB NOT NULL DEFAULT '{}';

-- Remove the default now so future rows must always supply real salts
ALTER TABLE "credentials" ALTER COLUMN "claim_salts" DROP DEFAULT;
