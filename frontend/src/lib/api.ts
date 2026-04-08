const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'qualified'
  | 'booked'
  | 'disqualified';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: LeadStatus;
  score: number | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  type: 'outreach' | 'follow_up' | 'reply' | 'scheduling' | 'system';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  content: string;
  sent_at: string;
}

export interface Event {
  id: string;
  type: string;
  lead_id: string | null;
  lead_name?: string;
  lead_email?: string;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}

export interface JobLog {
  id: string;
  queue: string;
  job_id: string;
  job_name: string;
  status: 'started' | 'completed' | 'failed' | 'retried';
  lead_id: string | null;
  lead_name?: string;
  lead_email?: string;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface AnalyticsSnapshot {
  id: string;
  snapshot_date: string;
  total_leads: number;
  contacted: number;
  replied: number;
  qualified: number;
  booked: number;
  response_rate: number;
  qualification_rate: number;
  booking_rate: number;
}

export interface Metrics {
  snapshots: AnalyticsSnapshot[];
  funnel: { status: string; count: string }[];
  leadsByDay: { day: string; count: string }[];
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  leads: {
    list: (params?: { status?: string; search?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return apiFetch<{ leads: Lead[]; total: number }>(`/leads${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) =>
      apiFetch<{ lead: Lead; messages: Message[] }>(`/leads/${id}`),
    create: (data: { name: string; email: string; phone?: string; company?: string; notes?: string }) =>
      apiFetch<{ lead: Lead; jobId: string }>('/leads', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Pick<Lead, 'status' | 'notes' | 'score'>>) =>
      apiFetch<{ lead: Lead }>(`/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/leads/${id}`, { method: 'DELETE' }),
  },

  events: {
    list: (params?: { lead_id?: string; type?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return apiFetch<{ events: Event[] }>(`/events${qs ? `?${qs}` : ''}`);
    },
    trigger: (data: { type: string; lead_id: string; payload?: Record<string, unknown> }) =>
      apiFetch<{ success: boolean; jobId: string | null }>('/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  metrics: {
    get: () => apiFetch<Metrics>('/metrics'),
    refresh: () => apiFetch<{ success: boolean; snapshot: AnalyticsSnapshot }>('/metrics/refresh', { method: 'POST' }),
    activity: (limit?: number) =>
      apiFetch<{ logs: JobLog[] }>(`/metrics/activity${limit ? `?limit=${limit}` : ''}`),
  },
};
