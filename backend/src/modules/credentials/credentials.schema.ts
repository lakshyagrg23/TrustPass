import { z } from 'zod';

// ── Slugify helper ─────────────────────────────────────────────────────────────
// "Full Name" → "fullName", "Date of Birth" → "dateOfBirth"
export function slugifyKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')          // strip special chars
    .replace(/\s+(.)/g, (_, c: string) => c.toUpperCase()) // camelCase
    .replace(/\s+/g, '')                  // remove remaining spaces
    || 'field';
}

// ── Credential type registry ───────────────────────────────────────────────────
export const CREDENTIAL_TYPES = [
  'academic',
  'identity',
  'license',
  'passport',
  'professional',
  'address',
  'custom',
] as const;

export type CredentialType = typeof CREDENTIAL_TYPES[number];

// ── Issue schema ───────────────────────────────────────────────────────────────
// Claims are an open key-value map; min 2 fields required.
const claimValue = z.union([z.string(), z.number(), z.boolean()]);

export const issueCredentialSchema = z.object({
  credentialType: z.string().min(1).max(50).default('custom'),
  credentialLabel: z.string().min(1, 'Credential name is required').max(100).trim(),
  claims: z
    .record(
      z.string()
        .min(1, 'Field key cannot be empty')
        .max(60)
        .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, 'Field key must be camelCase alphanumeric'),
      claimValue,
    )
    .refine(
      (c) => Object.keys(c).length >= 2,
      { message: 'At least 2 fields are required' },
    )
    .refine(
      (c) => Object.keys(c).length <= 30,
      { message: 'Maximum 30 fields allowed' },
    ),
});

export const shareCredentialSchema = z.object({
  credentialId: z.string().uuid(),
  disclosedFields: z
    .array(z.string().min(1))
    .min(1, 'Select at least one field to disclose'),
  expiresIn: z
    .enum(['1h', '24h', '7d', '30d'])
    .default('24h'),
});

export const verifyCredentialSchema = z.object({
  presentationToken: z.string().min(1),
});

export type IssueCredentialDto = z.infer<typeof issueCredentialSchema>;
export type ShareCredentialDto = z.infer<typeof shareCredentialSchema>;
export type VerifyCredentialDto = z.infer<typeof verifyCredentialSchema>;

export const EXPIRY_MAP: Record<string, number> = {
  '1h': 3600,
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
};
