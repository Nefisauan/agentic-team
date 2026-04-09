'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, AgencyPartner } from '@/lib/api';
import { format } from 'date-fns';
import {
  Search, Loader2, Trash2, ChevronRight, Send, Mail,
  Instagram, Linkedin, Globe, MapPin, Building2, Handshake,
  RefreshCw, Users, Zap,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  new: 'bg-slate-100 text-slate-600',
  researched: 'bg-blue-100 text-blue-700',
  pitched: 'bg-violet-100 text-violet-700',
  interested: 'bg-green-100 text-green-700',
  negotiating: 'bg-amber-100 text-amber-700',
  partner: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-red-100 text-red-600',
};

const typeLabels: Record<string, string> = {
  ad_agency: 'Ad Agency',
  marketing_agency: 'Marketing',
  digital_agency: 'Digital',
  seo_agency: 'SEO',
  social_media_agency: 'Social Media',
  web_design: 'Web Design',
  branding: 'Branding',
};

export default function AgenciesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedAgency, setSelectedAgency] = useState<AgencyPartner | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['agencies', filterStatus, search],
    queryFn: () => api.agencies.list({
      status: filterStatus || undefined,
      search: search || undefined,
      limit: 100,
    }),
  });

  const { data: metricsData } = useQuery({
    queryKey: ['agency-metrics'],
    queryFn: api.agencies.metrics,
    refetchInterval: 60_000,
  });

  const researchMutation = useMutation({
    mutationFn: () => api.agencies.research({ count: 15 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agencies'] }),
  });

  const batchPitchMutation = useMutation({
    mutationFn: () => api.agencies.batchPitch(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agencies'] }),
  });

  const followupMutation = useMutation({
    mutationFn: api.agencies.followup,
  });

  const pitchMutation = useMutation({
    mutationFn: ({ id, channel, platform }: { id: string; channel: string; platform?: string }) =>
      api.agencies.pitch(id, { channel, platform }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AgencyPartner> }) =>
      api.agencies.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agencies'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.agencies.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      setSelectedAgency(null);
    },
  });

  // Metrics
  const pipeline = metricsData?.pipeline || [];
  const pipelineMap = Object.fromEntries(pipeline.map(p => [p.status, parseInt(p.count)]));
  const totalAgencies = pipeline.reduce((sum, p) => sum + parseInt(p.count), 0);
  const totalPitched = (pipelineMap.pitched || 0) + (pipelineMap.interested || 0) + (pipelineMap.negotiating || 0) + (pipelineMap.partner || 0);
  const totalPartners = pipelineMap.partner || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agency Partners</h1>
          <p className="text-slate-500 text-sm mt-1">{data?.total ?? 0} agencies in pipeline</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => followupMutation.mutate()}
            disabled={followupMutation.isPending}
            className="flex items-center gap-2 text-sm border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${followupMutation.isPending ? 'animate-spin' : ''}`} /> Follow-ups
          </button>
          <button
            onClick={() => batchPitchMutation.mutate()}
            disabled={batchPitchMutation.isPending}
            className="flex items-center gap-2 text-sm border border-amber-200 hover:bg-amber-50 text-amber-700 px-3 py-2 rounded-lg transition-colors"
          >
            {batchPitchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Research + Pitch All
          </button>
          <button
            onClick={() => researchMutation.mutate()}
            disabled={researchMutation.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {researchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Find Agencies
          </button>
        </div>
      </div>

      {(researchMutation.isSuccess || batchPitchMutation.isSuccess) && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
          Job queued! Results will appear shortly.
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Agencies" value={totalAgencies} icon={Building2} color="bg-blue-500" />
        <MetricCard label="Pitched" value={totalPitched} icon={Send} color="bg-violet-500" />
        <MetricCard label="Interested" value={pipelineMap.interested || 0} icon={Handshake} color="bg-green-500" sub={`${pipelineMap.negotiating || 0} negotiating`} />
        <MetricCard label="Partners" value={totalPartners} icon={Users} color="bg-emerald-600" />
      </div>

      {/* Pipeline Funnel */}
      {pipeline.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-700 mb-3 text-sm">Partnership Pipeline</h2>
          <div className="flex gap-2">
            {['researched', 'pitched', 'interested', 'negotiating', 'partner'].map((status) => {
              const count = pipelineMap[status] || 0;
              return (
                <div key={status} className="flex-1 text-center">
                  <p className="text-lg font-bold text-slate-800">{count}</p>
                  <p className="text-xs text-slate-500 capitalize">{status}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search agencies..."
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
          {['new', 'researched', 'pitched', 'interested', 'negotiating', 'partner', 'declined'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 text-left">
                <th className="px-4 py-3 font-medium">Agency</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Partnership</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.agencies?.map((agency) => (
                <tr key={agency.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedAgency(agency)}>
                  <td className="px-4 py-3 font-medium text-slate-800">{agency.agency_name}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-slate-600">{agency.contact_name}</p>
                      <p className="text-xs text-slate-400">{agency.contact_role}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{typeLabels[agency.agency_type] || agency.agency_type}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{agency.location}</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${(agency.score || 0) >= 80 ? 'text-green-600' : (agency.score || 0) >= 60 ? 'text-blue-600' : 'text-slate-400'}`}>
                      {agency.score ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[agency.status]}`}>
                      {agency.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs capitalize">{agency.partnership_type}</td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-slate-300" /></td>
                </tr>
              ))}
              {data?.agencies?.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No agencies found. Click "Find Agencies" or "Research + Pitch All" to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Agency Detail Modal */}
      {selectedAgency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedAgency(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">{selectedAgency.agency_name}</h2>
              <button onClick={() => setSelectedAgency(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-slate-400">Contact:</span> <span className="text-slate-700">{selectedAgency.contact_name} ({selectedAgency.contact_role})</span></div>
              <div><span className="text-slate-400">Email:</span> <span className="text-slate-700">{selectedAgency.email}</span></div>
              <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> <span className="text-slate-700">{selectedAgency.location}</span></div>
              <div><span className="text-slate-400">Size:</span> <span className="text-slate-700">{selectedAgency.employee_count} employees</span></div>
              <div><span className="text-slate-400">Type:</span> <span className="text-slate-700">{typeLabels[selectedAgency.agency_type] || selectedAgency.agency_type}</span></div>
              <div><span className="text-slate-400">Score:</span> <span className="text-slate-700 font-medium">{selectedAgency.score ?? '—'}</span></div>
            </div>

            {/* Services */}
            {selectedAgency.services_offered?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-500 mb-1">Services</p>
                <div className="flex flex-wrap gap-1">
                  {selectedAgency.services_offered.map(s => (
                    <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Client industries */}
            {selectedAgency.client_industries?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-500 mb-1">Client Industries</p>
                <div className="flex flex-wrap gap-1">
                  {selectedAgency.client_industries.map(s => (
                    <span key={s} className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Social links */}
            <div className="flex gap-3 mb-3">
              {selectedAgency.instagram_handle && (
                <span className="flex items-center gap-1 text-xs text-pink-600"><Instagram className="w-3 h-3" /> {selectedAgency.instagram_handle}</span>
              )}
              {selectedAgency.linkedin_url && (
                <span className="flex items-center gap-1 text-xs text-blue-600"><Linkedin className="w-3 h-3" /> LinkedIn</span>
              )}
              {selectedAgency.website && (
                <span className="flex items-center gap-1 text-xs text-slate-500"><Globe className="w-3 h-3" /> {selectedAgency.website}</span>
              )}
            </div>

            {selectedAgency.notes && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Research Notes</p>
                <p className="text-sm text-slate-600">{selectedAgency.notes}</p>
              </div>
            )}

            {selectedAgency.partnership_pitch && (
              <div className="bg-violet-50 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-violet-500 mb-1">Partnership Pitch Sent</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedAgency.partnership_pitch}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Actions</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => pitchMutation.mutate({ id: selectedAgency.id, channel: 'email' })}
                  disabled={pitchMutation.isPending}
                  className="flex items-center gap-1 text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg"
                >
                  <Mail className="w-3 h-3" /> Pitch Email
                </button>
                {selectedAgency.instagram_handle && (
                  <button
                    onClick={() => pitchMutation.mutate({ id: selectedAgency.id, channel: 'instagram', platform: 'instagram' })}
                    disabled={pitchMutation.isPending}
                    className="flex items-center gap-1 text-xs border border-pink-200 text-pink-600 px-3 py-1.5 rounded-lg hover:bg-pink-50"
                  >
                    <Instagram className="w-3 h-3" /> IG DM
                  </button>
                )}
                {selectedAgency.linkedin_url && (
                  <button
                    onClick={() => pitchMutation.mutate({ id: selectedAgency.id, channel: 'linkedin', platform: 'linkedin' })}
                    disabled={pitchMutation.isPending}
                    className="flex items-center gap-1 text-xs border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50"
                  >
                    <Linkedin className="w-3 h-3" /> LI DM
                  </button>
                )}

                {/* Status updates */}
                {selectedAgency.status !== 'partner' && selectedAgency.status !== 'declined' && (
                  <>
                    {selectedAgency.status === 'pitched' && (
                      <button
                        onClick={() => { updateMutation.mutate({ id: selectedAgency.id, data: { status: 'interested' } }); setSelectedAgency({ ...selectedAgency, status: 'interested' }); }}
                        className="text-xs border border-green-200 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-50"
                      >
                        Mark Interested
                      </button>
                    )}
                    {selectedAgency.status === 'interested' && (
                      <button
                        onClick={() => { updateMutation.mutate({ id: selectedAgency.id, data: { status: 'negotiating' } }); setSelectedAgency({ ...selectedAgency, status: 'negotiating' }); }}
                        className="text-xs border border-amber-200 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-50"
                      >
                        Negotiating
                      </button>
                    )}
                    {(selectedAgency.status === 'interested' || selectedAgency.status === 'negotiating') && (
                      <button
                        onClick={() => { updateMutation.mutate({ id: selectedAgency.id, data: { status: 'partner' } }); setSelectedAgency({ ...selectedAgency, status: 'partner' }); }}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg"
                      >
                        Mark as Partner
                      </button>
                    )}
                    <button
                      onClick={() => { updateMutation.mutate({ id: selectedAgency.id, data: { status: 'declined' } }); setSelectedAgency({ ...selectedAgency, status: 'declined' }); }}
                      className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50"
                    >
                      Declined
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => deleteMutation.mutate(selectedAgency.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm"
              >
                <Trash2 className="w-4 h-4" /> Delete Agency
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: number; sub?: string; icon: React.ElementType; color: string;
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
