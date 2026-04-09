'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  RefreshCw, Loader2, Instagram, Linkedin, Mail, Calendar,
  Users, MessageCircle, TrendingUp, Search,
} from 'lucide-react';

export default function ReportsPage() {
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard-report'],
    queryFn: api.reports.dashboard,
    refetchInterval: 60_000,
  });

  const { data: weeklyData, isLoading: weeklyLoading } = useQuery({
    queryKey: ['weekly-reports'],
    queryFn: () => api.reports.weekly(8),
  });

  const generateMutation = useMutation({
    mutationFn: api.reports.generateWeekly,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-report'] });
    },
  });

  const d = dashboardData;
  const reports = weeklyData?.reports || [];

  const isLoading = dashLoading || weeklyLoading;

  // Chart data from weekly reports
  const chartData = reports.slice().reverse().map((r) => ({
    week: format(new Date(r.week_start), 'MMM d'),
    'IG Posts': r.ig_posts_created,
    'LI Posts': r.li_posts_created,
    'DMs Sent': r.ig_dms_sent + r.li_dms_sent,
    'Emails': r.emails_sent,
    'Qualified': r.leads_qualified,
    'Booked': r.meetings_scheduled,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Weekly Reports</h1>
          <p className="text-slate-500 text-sm mt-1">Cross-channel performance dashboard</p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 text-sm border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
        >
          {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Generate Report
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          {d && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <OverviewCard
                label="Total Prospects"
                value={d.prospects?.count || '0'}
                sub={`${d.prospects?.converted || 0} converted to leads`}
                icon={Search}
                color="bg-cyan-500"
              />
              <OverviewCard
                label="Social Posts"
                value={d.posts?.total || '0'}
                sub={`${d.posts?.published || 0} published`}
                icon={Instagram}
                color="bg-pink-500"
              />
              <OverviewCard
                label="DMs Sent"
                value={d.dms?.sent || '0'}
                sub={`${d.dms?.replied || 0} replied`}
                icon={MessageCircle}
                color="bg-violet-500"
              />
              <OverviewCard
                label="Meetings Booked"
                value={d.leads?.booked || '0'}
                sub={`${d.leads?.qualified || 0} qualified leads`}
                icon={Calendar}
                color="bg-orange-500"
              />
            </div>
          )}

          {/* Weekly Trend Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-700 mb-4">Weekly Activity Trends</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="IG Posts" fill="#ec4899" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="LI Posts" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="DMs Sent" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Emails" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Booked" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weekly Report Cards */}
          {reports.length > 0 ? (
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-700">Report History</h2>
              {reports.map((report) => (
                <div key={report.id} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-slate-800">
                      Week of {format(new Date(report.week_start), 'MMM d')} — {format(new Date(report.week_end), 'MMM d, yyyy')}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    {/* Instagram */}
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 font-medium text-pink-600"><Instagram className="w-3 h-3" /> Instagram</p>
                      <p className="text-slate-500">{report.ig_posts_created} posts created</p>
                      <p className="text-slate-500">{report.ig_total_likes} likes, {report.ig_total_comments} comments</p>
                      <p className="text-slate-500">{report.ig_total_reach.toLocaleString()} reach</p>
                      <p className="text-slate-500">{report.ig_dms_sent} DMs sent, {report.ig_dms_replied} replied</p>
                    </div>
                    {/* LinkedIn */}
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 font-medium text-blue-600"><Linkedin className="w-3 h-3" /> LinkedIn</p>
                      <p className="text-slate-500">{report.li_posts_created} posts created</p>
                      <p className="text-slate-500">{report.li_total_likes} likes, {report.li_total_comments} comments</p>
                      <p className="text-slate-500">{report.li_total_impressions.toLocaleString()} impressions</p>
                      <p className="text-slate-500">{report.li_dms_sent} DMs sent, {report.li_dms_replied} replied</p>
                    </div>
                    {/* Email */}
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 font-medium text-amber-600"><Mail className="w-3 h-3" /> Email</p>
                      <p className="text-slate-500">{report.emails_sent} emails sent</p>
                      <p className="text-slate-500">{report.emails_replied} replies received</p>
                      <p className="text-slate-500">{report.leads_qualified} qualified</p>
                    </div>
                    {/* Pipeline */}
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 font-medium text-green-600"><TrendingUp className="w-3 h-3" /> Pipeline</p>
                      <p className="text-slate-500">{report.prospects_found} prospects found</p>
                      <p className="text-slate-500">{report.prospects_converted} converted</p>
                      <p className="text-slate-500">{report.meetings_scheduled} meetings booked</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p>No weekly reports yet.</p>
              <p className="text-sm mt-1">Click "Generate Report" to create your first weekly snapshot.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OverviewCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
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
