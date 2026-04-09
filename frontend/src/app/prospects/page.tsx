'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Prospect } from '@/lib/api';
import { format } from 'date-fns';
import {
  Search, Loader2, Trash2, ChevronRight, UserPlus, Send,
  Instagram, Linkedin, Globe, MapPin, Building2, RefreshCw,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  new: 'bg-slate-100 text-slate-600',
  approved: 'bg-blue-100 text-blue-700',
  converted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};

const scoreColor = (score: number | null) => {
  if (score == null) return 'text-slate-400';
  if (score >= 80) return 'text-green-600 font-bold';
  if (score >= 60) return 'text-blue-600 font-medium';
  return 'text-slate-500';
};

export default function ProspectsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['prospects', filterStatus, search],
    queryFn: () => api.prospects.list({
      status: filterStatus || undefined,
      search: search || undefined,
      limit: 100,
    }),
  });

  const researchMutation = useMutation({
    mutationFn: () => api.prospects.research({
      industries: ['HVAC', 'roofing', 'plumbing', 'electrical', 'landscaping', 'cleaning', 'auto detailing'],
      location: 'Utah',
      count: 15,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prospects'] }),
  });

  const convertMutation = useMutation({
    mutationFn: api.prospects.convert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedProspect(null);
    },
  });

  const dmMutation = useMutation({
    mutationFn: ({ id, platform }: { id: string; platform: string }) => api.prospects.sendDM(id, { platform }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.prospects.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      setSelectedProspect(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Prospect, 'status' | 'notes' | 'score'>> }) =>
      api.prospects.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prospects'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Prospects</h1>
          <p className="text-slate-500 text-sm mt-1">{data?.total ?? 0} potential leads found</p>
        </div>
        <button
          onClick={() => researchMutation.mutate()}
          disabled={researchMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {researchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Find New Prospects
        </button>
      </div>

      {researchMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
          Research job queued! New prospects will appear shortly.
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search prospects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="approved">Approved</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 text-left">
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Industry</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.prospects?.map((prospect) => (
                <tr
                  key={prospect.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedProspect(prospect)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{prospect.contact_name}</p>
                      <p className="text-xs text-slate-400">{prospect.contact_role}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{prospect.company_name}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{prospect.industry}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{prospect.location}</td>
                  <td className="px-4 py-3">
                    <span className={scoreColor(prospect.score)}>{prospect.score ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[prospect.status]}`}>
                      {prospect.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{prospect.source}</td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-slate-300" /></td>
                </tr>
              ))}
              {data?.prospects?.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No prospects found. Click "Find New Prospects" to start researching.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Prospect Detail Modal */}
      {selectedProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedProspect(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">{selectedProspect.contact_name}</h2>
              <button onClick={() => setSelectedProspect(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">{selectedProspect.company_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">{selectedProspect.location}</span>
              </div>
              <div><span className="text-slate-400">Role:</span> <span className="text-slate-700">{selectedProspect.contact_role}</span></div>
              <div><span className="text-slate-400">Industry:</span> <span className="text-slate-700 capitalize">{selectedProspect.industry}</span></div>
              <div><span className="text-slate-400">Email:</span> <span className="text-slate-700">{selectedProspect.email}</span></div>
              <div><span className="text-slate-400">Phone:</span> <span className="text-slate-700">{selectedProspect.phone || '—'}</span></div>
              <div><span className="text-slate-400">Employees:</span> <span className="text-slate-700">{selectedProspect.employee_count}</span></div>
              <div><span className="text-slate-400">Score:</span> <span className={scoreColor(selectedProspect.score)}>{selectedProspect.score ?? '—'}</span></div>
            </div>

            {/* Social links */}
            <div className="flex gap-3 mb-4">
              {selectedProspect.instagram_handle && (
                <span className="flex items-center gap-1 text-xs text-pink-600">
                  <Instagram className="w-3 h-3" /> {selectedProspect.instagram_handle}
                </span>
              )}
              {selectedProspect.linkedin_url && (
                <span className="flex items-center gap-1 text-xs text-blue-600">
                  <Linkedin className="w-3 h-3" /> LinkedIn
                </span>
              )}
              {selectedProspect.website && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Globe className="w-3 h-3" /> {selectedProspect.website}
                </span>
              )}
            </div>

            {selectedProspect.notes && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Research Notes</p>
                <p className="text-sm text-slate-600">{selectedProspect.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Actions</p>
              <div className="flex flex-wrap gap-2">
                {selectedProspect.status !== 'converted' && (
                  <button
                    onClick={() => convertMutation.mutate(selectedProspect.id)}
                    disabled={convertMutation.isPending}
                    className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg"
                  >
                    <UserPlus className="w-3 h-3" /> Convert to Lead
                  </button>
                )}
                {selectedProspect.instagram_handle && (
                  <button
                    onClick={() => dmMutation.mutate({ id: selectedProspect.id, platform: 'instagram' })}
                    disabled={dmMutation.isPending}
                    className="flex items-center gap-1 text-xs border border-pink-200 text-pink-600 px-3 py-1.5 rounded-lg hover:bg-pink-50"
                  >
                    <Send className="w-3 h-3" /> IG DM
                  </button>
                )}
                {selectedProspect.linkedin_url && (
                  <button
                    onClick={() => dmMutation.mutate({ id: selectedProspect.id, platform: 'linkedin' })}
                    disabled={dmMutation.isPending}
                    className="flex items-center gap-1 text-xs border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50"
                  >
                    <Send className="w-3 h-3" /> LI DM
                  </button>
                )}
                {selectedProspect.status === 'new' && (
                  <button
                    onClick={() => {
                      updateMutation.mutate({ id: selectedProspect.id, data: { status: 'approved' } });
                      setSelectedProspect({ ...selectedProspect, status: 'approved' });
                    }}
                    className="text-xs border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50"
                  >
                    Approve
                  </button>
                )}
                {selectedProspect.status === 'new' && (
                  <button
                    onClick={() => {
                      updateMutation.mutate({ id: selectedProspect.id, data: { status: 'rejected' } });
                      setSelectedProspect({ ...selectedProspect, status: 'rejected' });
                    }}
                    className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    Reject
                  </button>
                )}
              </div>

              <button
                onClick={() => deleteMutation.mutate(selectedProspect.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm"
              >
                <Trash2 className="w-4 h-4" /> Delete Prospect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
