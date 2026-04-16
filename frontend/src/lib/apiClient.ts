// =============================================================================
// SentinX — API Client
// Typed fetch wrapper with auth headers and error handling
// =============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers });
  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new APIError(res.status, data.error || 'Request failed');
  }

  return data.data;
}

// ─── Auth token helper ─────────────────────────────────────────────────────────
// Call this from React components with useAuth().getToken()
export function createAPIClient(getToken: () => Promise<string | null>) {
  const withAuth = async (path: string, options: RequestInit = {}) => {
    const token = await getToken();
    return apiFetch(path, { ...options, token: token || undefined });
  };

  return {
    // Portfolio
    getPortfolio: () => withAuth('/api/portfolio'),
    getHolding: (id: string) => withAuth(`/api/portfolio/${id}`),
    createHolding: (data: any) =>
      withAuth('/api/portfolio', { method: 'POST', body: JSON.stringify(data) }),
    updateHolding: (id: string, data: any) =>
      withAuth(`/api/portfolio/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteHolding: (id: string) =>
      withAuth(`/api/portfolio/${id}`, { method: 'DELETE' }),
    generateReport: (id: string) =>
      withAuth(`/api/portfolio/${id}/generate-report`, { method: 'POST' }),

    // Stocks
    getQuote: (ticker: string) => withAuth(`/api/stocks/${ticker}/quote`),
    getHistory: (ticker: string, from?: string, to?: string) =>
      withAuth(`/api/stocks/${ticker}/history?${from ? `from=${from}&` : ''}${to ? `to=${to}` : ''}`),
    getOverview: (ticker: string) => withAuth(`/api/stocks/${ticker}/overview`),

    // Signals
    getSignals: (ticker: string, params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return withAuth(`/api/signals/${ticker}${q}`);
    },

    // Reports
    getReports: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return withAuth(`/api/reports${q}`);
    },
    getReport: (id: string) => withAuth(`/api/reports/${id}`),

    // Alerts
    updateAlert: (holdingId: string, data: any) =>
      withAuth(`/api/alerts/${holdingId}`, { method: 'PATCH', body: JSON.stringify(data) }),

    // Admin
    getAdminKeys: () => withAuth('/api/admin/keys'),
    upsertAdminKey: (slotNumber: number, data: any) =>
      withAuth(`/api/admin/keys/${slotNumber}`, { method: 'PUT', body: JSON.stringify(data) }),
    deactivateKey: (slotNumber: number) =>
      withAuth(`/api/admin/keys/${slotNumber}`, { method: 'DELETE' }),
    resetQuotas: () => withAuth('/api/admin/keys/reset-quotas', { method: 'POST' }),
    getPipeline: () => withAuth('/api/admin/pipeline'),
    getAnalytics: () => withAuth('/api/admin/analytics'),
  };
}
