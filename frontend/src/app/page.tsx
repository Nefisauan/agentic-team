'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Users, Mail, CheckCircle, Calendar, TrendingUp, AlertCircle, Instagram, MessageCircle, Search } from 'lucide-react';

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['metrics'],
    queryFn: api.metrics.get,
    refetchInterval: 60_000,
  });

  const { data: leadsData } = useQuery({
    queryKey: ['leads', 'all'],
    queryFn: () => api.leads.list({ limit: 5, sort: 'created_at', order: 'desc' } as any),
  });

  const { data: dashReport } = useQuery({
    queryKey: ['dashboard-report'],
    queryFn: api.reports.dashboard,
    refetchInterval: 60_000,
  });

  const latest = metrics?.snapshots?.[0];
  const funnel = metrics?.funnel || [];

  const funnelMap = Object.fromEntries(funnel.map((f) => [f.status, parseInt(f.count, 10)]));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Live pipeline overview</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          Failed to load metrics. Is the backend running?
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Leads"
          value={latest?.total_leads ?? (funnelMap.new || 0) + (funnelMap.contacted || 0) + (funnelMap.replied || 0) + (funnelMap.qualified || 0) + (funnelMap.booked || 0)}
          icon={Users}
          color="bg-blue-500"
        />
        <StatCard
          label="Replied"
          value={funnelMap.replied || 0}
          icon={Mail}
          color="bg-violet-500"
          sub={`${latest?.response_rate ?? 0}% response rate`}
        />
        <StatCard
          label="Qualified"
          value={funnelMap.qualified || 0}
          icon={CheckCircle}
          color="bg-green-500"
          sub={`${latest?.qualification_rate ?? 0}% of replies`}
        />
        <StatCard
          label="Booked"
          value={funnelMap.booked || 0}
          icon={Calendar}
          color="bg-orange-500"
          sub={`${latest?.booking_rate ?? 0}% booking rate`}
        />
      </div>

      {/* Social & Outreach Overview */}
      {dashReport && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Prospects Found"
            value={parseInt(dashReport.prospects?.count || '0')}
            icon={Search}
            color="bg-cyan-500"
            sub={`${dashReport.prospects?.converted || 0} converted`}
          />
          <StatCard
            label="Social Posts"
            value={parseInt(dashReport.posts?.total || '0')}
            icon={Instagram}
            color="bg-pink-500"
            sub={`${dashReport.posts?.published || 0} published`}
          />
          <StatCard
            label="DMs Sent"
            value={parseInt(dashReport.dms?.sent || '0')}
            icon={MessageCircle}
            color="bg-purple-500"
            sub={`${dashReport.dms?.replied || 0} replied`}
          />
        </div>
      )}

      {/* Pipeline Funnel */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-700 mb-4">Pipeline Funnel</h2>
        <div className="space-y-3">
          {[
            { status: 'new', label: 'New', color: 'bg-slate-400' },
            { status: 'contacted', label: 'Contacted', color: 'bg-blue-400' },
            { status: 'replied', label: 'Replied', color: 'bg-violet-400' },
            { status: 'qualified', label: 'Qualified', color: 'bg-green-400' },
            { status: 'booked', label: 'Booked', color: 'bg-orange-400' },
          ].map(({ status, label, color }) => {
            const count = funnelMap[status] || 0;
            const total = Object.values(funnelMap).reduce((a, b) => a + b, 0) || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={status} className="flex items-center gap-3">
                <span className="w-20 text-sm text-slate-600 text-right">{label}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-sm text-slate-500 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">Recent Leads</h2>
          <a href="/leads" className="text-sm text-blue-600 hover:underline">View all</a>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-left border-b border-slate-100">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Company</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {leadsData?.leads.map((lead) => (
              <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2 font-medium text-slate-800">{lead.name}</td>
                <td className="py-2 text-slate-500">{lead.company || '—'}</td>
                <td className="py-2">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="py-2 text-slate-500">{lead.score ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: 'bg-slate-100 text-slate-600',
    contacted: 'bg-blue-100 text-blue-700',
    replied: 'bg-violet-100 text-violet-700',
    qualified: 'bg-green-100 text-green-700',
    booked: 'bg-orange-100 text-orange-700',
    disqualified: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}
