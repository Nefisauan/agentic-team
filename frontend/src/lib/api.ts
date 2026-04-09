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

// ── Social Types ─────────────────────────────────────────────────────────────

export interface SocialPost {
  id: string;
  platform: 'instagram' | 'linkedin';
  content_type: string;
  caption: string;
  hashtags: string[];
  image_prompt: string | null;
  image_url: string | null;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_for: string | null;
  published_at: string | null;
  engagement: Record<string, number>;
  created_at: string;
}

export interface SocialDM {
  id: string;
  lead_id: string | null;
  platform: 'instagram' | 'linkedin';
  direction: 'inbound' | 'outbound';
  message: string;
  status: string;
  metadata: Record<string, unknown>;
  sent_at: string | null;
  created_at: string;
  lead_name?: string;
  lead_company?: string;
}

export interface Prospect {
  id: string;
  company_name: string;
  contact_name: string;
  contact_role: string;
  email: string;
  phone: string | null;
  website: string | null;
  instagram_handle: string | null;
  linkedin_url: string | null;
  industry: string;
  location: string;
  employee_count: string;
  notes: string | null;
  source: string;
  score: number | null;
  status: 'new' | 'approved' | 'converted' | 'rejected';
  lead_id: string | null;
  created_at: string;
}

export interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  ig_posts_created: number;
  ig_total_likes: number;
  ig_total_comments: number;
  ig_total_reach: number;
  li_posts_created: number;
  li_total_likes: number;
  li_total_comments: number;
  li_total_impressions: number;
  ig_dms_sent: number;
  ig_dms_replied: number;
  li_dms_sent: number;
  li_dms_replied: number;
  emails_sent: number;
  emails_replied: number;
  leads_qualified: number;
  meetings_scheduled: number;
  prospects_found: number;
  prospects_converted: number;
}

export interface SocialMetrics {
  posts: Array<{
    platform: string;
    total_posts: string;
    published: string;
    scheduled: string;
    drafts: string;
    total_likes: string;
    total_comments: string;
    total_reach: string;
  }>;
  dms: Array<{
    platform: string;
    total_dms: string;
    sent: string;
    received: string;
    replied: string;
  }>;
  postsByDay: Array<{ day: string; platform: string; count: string }>;
}

export interface DashboardReport {
  prospects: { count: string; converted: string };
  posts: { total: string; published: string; total_engagement: string };
  dms: { total: string; sent: string; replied: string };
  leads: { total: string; booked: string; qualified: string };
  funnel: Array<{ status: string; count: string }>;
  recentActivity: Array<{ type: string; count: string; latest: string }>;
}

export interface AgencyPartner {
  id: string;
  agency_name: string;
  contact_name: string;
  contact_role: string;
  email: string;
  phone: string | null;
  website: string | null;
  instagram_handle: string | null;
  linkedin_url: string | null;
  agency_type: string;
  services_offered: string[];
  client_industries: string[];
  location: string;
  employee_count: string;
  notes: string | null;
  source: string;
  partnership_pitch: string | null;
  partnership_type: string;
  score: number | null;
  status: 'new' | 'researched' | 'pitched' | 'interested' | 'negotiating' | 'partner' | 'declined';
  last_contacted_at: string | null;
  created_at: string;
}

export interface AgencyMessage {
  id: string;
  agency_id: string;
  channel: 'email' | 'instagram' | 'linkedin';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  content: string;
  status: string;
  sent_at: string;
  created_at: string;
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

  social: {
    posts: (params?: { platform?: string; status?: string; limit?: number }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return apiFetch<{ posts: SocialPost[]; total: number }>(`/social/posts${qs ? `?${qs}` : ''}`);
    },
    getPost: (id: string) => apiFetch<{ post: SocialPost }>(`/social/posts/${id}`),
    updatePost: (id: string, data: Partial<SocialPost>) =>
      apiFetch<{ post: SocialPost }>(`/social/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePost: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/social/posts/${id}`, { method: 'DELETE' }),
    generate: (data?: { mode?: string; options?: Record<string, unknown> }) =>
      apiFetch<{ success: boolean; jobId: string }>('/social/generate', { method: 'POST', body: JSON.stringify(data || {}) }),
    dms: (params?: { platform?: string; limit?: number }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return apiFetch<{ dms: SocialDM[] }>(`/social/dms${qs ? `?${qs}` : ''}`);
    },
    sendDM: (data: { mode?: string; leadId?: string; prospectId?: string; platform: string }) =>
      apiFetch<{ success: boolean; jobId: string }>('/social/dm', { method: 'POST', body: JSON.stringify(data) }),
    batchDM: (data: { platform: string }) =>
      apiFetch<{ success: boolean; jobId: string }>('/social/dm/batch', { method: 'POST', body: JSON.stringify(data) }),
    metrics: () => apiFetch<SocialMetrics>('/social/metrics'),
  },

  prospects: {
    list: (params?: { status?: string; industry?: string; search?: string; limit?: number }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return apiFetch<{ prospects: Prospect[]; total: number }>(`/prospects${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => apiFetch<{ prospect: Prospect; dms: SocialDM[] }>(`/prospects/${id}`),
    update: (id: string, data: Partial<Pick<Prospect, 'status' | 'notes' | 'score'>>) =>
      apiFetch<{ prospect: Prospect }>(`/prospects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    convert: (id: string) =>
      apiFetch<{ success: boolean; lead: Lead }>(`/prospects/${id}/convert`, { method: 'POST' }),
    sendDM: (id: string, data: { platform: string }) =>
      apiFetch<{ success: boolean; jobId: string }>(`/prospects/${id}/dm`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/prospects/${id}`, { method: 'DELETE' }),
    research: (data?: { industries?: string[]; location?: string; count?: number; autoConvert?: boolean; autoDM?: boolean }) =>
      apiFetch<{ success: boolean; jobId: string }>('/prospects/research', { method: 'POST', body: JSON.stringify(data || {}) }),
  },

  reports: {
    weekly: (weeks?: number) =>
      apiFetch<{ reports: WeeklyReport[] }>(`/reports/weekly${weeks ? `?weeks=${weeks}` : ''}`),
    generateWeekly: () =>
      apiFetch<{ success: boolean; report: WeeklyReport }>('/reports/weekly/generate', { method: 'POST' }),
    dashboard: () => apiFetch<DashboardReport>('/reports/dashboard'),
  },

  agencies: {
    list: (params?: { status?: string; agency_type?: string; search?: string; limit?: number }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return apiFetch<{ agencies: AgencyPartner[]; total: number }>(`/agencies${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) =>
      apiFetch<{ agency: AgencyPartner; messages: AgencyMessage[] }>(`/agencies/${id}`),
    update: (id: string, data: Partial<Pick<AgencyPartner, 'status' | 'notes' | 'score' | 'partnership_type'>>) =>
      apiFetch<{ agency: AgencyPartner }>(`/agencies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/agencies/${id}`, { method: 'DELETE' }),
    pitch: (id: string, data: { channel: string; platform?: string }) =>
      apiFetch<{ success: boolean; jobId: string }>(`/agencies/${id}/pitch`, { method: 'POST', body: JSON.stringify(data) }),
    research: (data?: { agencyTypes?: string[]; location?: string; count?: number }) =>
      apiFetch<{ success: boolean; jobId: string }>('/agencies/research', { method: 'POST', body: JSON.stringify(data || {}) }),
    batchPitch: (data?: Record<string, unknown>) =>
      apiFetch<{ success: boolean; jobId: string }>('/agencies/batch-pitch', { method: 'POST', body: JSON.stringify(data || {}) }),
    followup: () =>
      apiFetch<{ success: boolean; jobId: string }>('/agencies/followup', { method: 'POST' }),
    metrics: () =>
      apiFetch<{ pipeline: Array<{ status: string; count: string }>; messages: Array<{ channel: string; direction: string; count: string }>; byType: Array<{ agency_type: string; count: string }> }>('/agencies/metrics/summary'),
  },
};
