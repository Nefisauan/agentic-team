'use client';

import { useQuery } from '@tanstack/react-query';
import { api, JobLog } from '@/lib/api';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';

const statusIcon: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  started: <Clock className="w-4 h-4 text-blue-400" />,
  retried: <RefreshCw className="w-4 h-4 text-yellow-500" />,
};

const queueColors: Record<string, string> = {
  outreach: 'bg-blue-100 text-blue-700',
  followup: 'bg-violet-100 text-violet-700',
  qualification: 'bg-green-100 text-green-700',
  scheduling: 'bg-orange-100 text-orange-700',
  analytics: 'bg-slate-100 text-slate-600',
};

export default function ActivityPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.metrics.activity(100),
    refetchInterval: 15_000,
  });

  const logs = data?.logs || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activity Log</h1>
          <p className="text-slate-500 text-sm mt-1">All agent job executions — refreshes every 15s</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 text-sm border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>No activity yet.</p>
            <p className="text-sm mt-1">Jobs will appear here once workers are running.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 text-left">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Queue</th>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon[log.status]}
                      <span className="text-xs text-slate-500 capitalize">{log.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${queueColors[log.queue] || 'bg-slate-100 text-slate-600'}`}>
                      {log.queue}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{log.job_name}</td>
                  <td className="px-4 py-3">
                    {log.lead_name ? (
                      <div>
                        <p className="text-slate-700 font-medium">{log.lead_name}</p>
                        <p className="text-slate-400 text-xs">{log.lead_email}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {format(new Date(log.created_at), 'MMM d HH:mm:ss')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Failures */}
      {logs.filter((l) => l.status === 'failed').length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-medium text-red-700 mb-3">Failed Jobs</h3>
          <div className="space-y-2">
            {logs
              .filter((l) => l.status === 'failed')
              .map((log) => (
                <div key={log.id} className="text-sm">
                  <span className="font-mono text-red-600">{log.queue}/{log.job_name}</span>
                  <span className="text-red-500 ml-2">— {log.error}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
