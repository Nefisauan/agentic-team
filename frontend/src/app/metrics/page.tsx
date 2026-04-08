'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { RefreshCw, Loader2 } from 'lucide-react';

export default function MetricsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: api.metrics.get,
    refetchInterval: 60_000,
  });

  const refreshMutation = useMutation({
    mutationFn: api.metrics.refresh,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['metrics'] }),
  });

  const snapshots = (data?.snapshots || []).slice().reverse();
  const funnel = data?.funnel || [];
  const leadsByDay = (data?.leadsByDay || []).map((d) => ({
    day: format(new Date(d.day), 'MMM d'),
    count: parseInt(d.count, 10),
  }));

  const latest = snapshots[snapshots.length - 1];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Metrics</h1>
          <p className="text-slate-500 text-sm mt-1">Analytics and conversion funnel</p>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 text-sm border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh Analytics
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Rate Cards */}
          {latest && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Response Rate', value: `${latest.response_rate}%`, desc: 'Replied / Contacted' },
                { label: 'Qualification Rate', value: `${latest.qualification_rate}%`, desc: 'Qualified / Replied' },
                { label: 'Booking Rate', value: `${latest.booking_rate}%`, desc: 'Booked / Qualified' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-3xl font-bold text-slate-800">{card.value}</p>
                  <p className="text-sm font-medium text-slate-600 mt-1">{card.label}</p>
                  <p className="text-xs text-slate-400">{card.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Funnel Bar Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-700 mb-4">Pipeline Funnel</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={funnel.map((f) => ({
                  status: f.status,
                  count: parseInt(f.count, 10),
                }))}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="status" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* New Leads per Day */}
          {leadsByDay.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-700 mb-4">New Leads (Last 30 Days)</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={leadsByDay} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rate Trends */}
          {snapshots.length > 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-700 mb-4">Rate Trends</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={snapshots.map((s) => ({
                    date: format(new Date(s.snapshot_date), 'MMM d'),
                    response: s.response_rate,
                    qualification: s.qualification_rate,
                    booking: s.booking_rate,
                  }))}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis unit="%" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => `${v}%`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="response" name="Response Rate" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="qualification" name="Qual. Rate" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="booking" name="Booking Rate" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {snapshots.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p>No analytics data yet.</p>
              <p className="text-sm mt-1">Click "Refresh Analytics" to generate a snapshot, or wait for the scheduled job.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
