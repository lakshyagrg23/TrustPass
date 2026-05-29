-- AlterTable
ALTER TABLE "credentials" ADD COLUMN     "credential_label" TEXT NOT NULL DEFAULT 'Custom Credential',
ADD COLUMN     "credential_type" TEXT NOT NULL DEFAULT 'custom',
ALTER COLUMN "issuer_name" SET DEFAULT 'TrustPass';
