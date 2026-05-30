import axios, { AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach JWT token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('trustpass_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('trustpass_token');
        localStorage.removeItem('trustpass_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ── API Functions ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Credential {
  id: string;
  credentialType: string;
  credentialLabel: string;
  issuerName: string;
  merkleRoot: string;
  issuedAt: string;
  availableFields: string[];
  shareCount: number;
}

export interface CredentialDetail extends Credential {
  claims: Record<string, unknown>;
  issuerPublicKey: string;
  shares: ShareRecord[];
}

export interface ShareRecord {
  id: string;
  disclosedFields: string[];
  expiresAt: string;
  createdAt: string;
  accessCount: number;
}

export interface GlobalShareRecord extends ShareRecord {
  credentialId: string;
  credentialLabel: string;
  credentialType: string;
}

export interface ShareResult {
  shareId: string;
  presentationToken: string;
  shareUrl: string;
  qrCodeDataUrl: string;
  disclosedFields: string[];
  expiresAt: string;
}

export interface ShareLookupResult {
  presentationToken: string;
}

export interface FieldVerificationResult {
  field: string;
  value: unknown;
  merkleProofValid: boolean;
  status: 'verified' | 'invalid' | 'tampered';
}

export interface VerificationResult {
  verified: boolean;
  credentialId: string;
  issuerName: string;
  issuedAt: string;
  expiresAt: string;
  disclosedClaims: Record<string, unknown>;
  merkleRoot: string;
  issuerPublicKey: string;
  issuerSignature: string;
  fieldResults: FieldVerificationResult[];
  checks: {
    jwtSignatureValid: boolean;
    notExpired: boolean;
    merkleProofsValid: boolean;
    issuerSignatureValid: boolean;
  };
  failureReason?: string;
}

function extractError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || 'Request failed';
  }
  return 'An unexpected error occurred';
}

// Auth
export const authApi = {
  register: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/register', { name, email, password });
    return data.data;
  },
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data.data;
  },
  me: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data.data;
  },
};

// Credentials
export const credentialsApi = {
  issue: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/credentials/issue', payload);
    return data.data;
  },
  list: async (): Promise<Credential[]> => {
    const { data } = await api.get('/credentials');
    return data.data;
  },
  get: async (id: string): Promise<CredentialDetail> => {
    const { data } = await api.get(`/credentials/${id}`);
    return data.data;
  },
  share: async (
    credentialId: string,
    disclosedFields: string[],
    expiresIn: string,
  ): Promise<ShareResult> => {
    const { data } = await api.post('/credentials/share', {
      credentialId,
      disclosedFields,
      expiresIn,
    });
    return data.data;
  },
  verify: async (presentationToken: string): Promise<VerificationResult> => {
    const { data } = await api.post('/credentials/verify', { presentationToken });
    return data.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/credentials/${id}`);
  },
  getAllShares: async (): Promise<GlobalShareRecord[]> => {
    const { data } = await api.get('/credentials/shares/all');
    return data.data;
  },
  getShare: async (shareId: string): Promise<ShareLookupResult> => {
    const { data } = await api.get(`/credentials/share/${shareId}`);
    return data.data;
  },
};

export { extractError };
