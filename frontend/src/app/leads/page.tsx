'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Lead, LeadStatus } from '@/lib/api';
import { Plus, Search, Loader2, Trash2, ChevronRight, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_OPTIONS: LeadStatus[] = ['new', 'contacted', 'replied', 'qualified', 'booked', 'disqualified'];

const statusColors: Record<string, string> = {
  new: 'bg-slate-100 text-slate-600',
  contacted: 'bg-blue-100 text-blue-700',
  replied: 'bg-violet-100 text-violet-700',
  qualified: 'bg-green-100 text-green-700',
  booked: 'bg-orange-100 text-orange-700',
  disqualified: 'bg-red-100 text-red-600',
};

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', filterStatus, search],
    queryFn: () =>
      api.leads.list({
        status: filterStatus || undefined,
        search: search || undefined,
        limit: 100,
      }),
  });

  const createMutation = useMutation({
    mutationFn: api.leads.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.leads.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedLead(null);
    },
  });

  const triggerMutation = useMutation({
    mutationFn: api.events.trigger,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leads</h1>
          <p className="text-slate-500 text-sm mt-1">{data?.total ?? 0} total leads</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads..."
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
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
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
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Last Contact</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{lead.name}</td>
                  <td className="px-4 py-3 text-slate-500">{lead.email}</td>
                  <td className="px-4 py-3 text-slate-500">{lead.company || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[lead.status]}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {lead.score != null ? (
                      <span className={`font-medium ${lead.score >= 60 ? 'text-green-600' : 'text-slate-400'}`}>
                        {lead.score}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {lead.last_contacted_at
                      ? format(new Date(lead.last_contacted_at), 'MMM d, yyyy')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </td>
                </tr>
              ))}
              {data?.leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No leads found. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Lead Modal */}
      {showForm && (
        <Modal title="Add New Lead" onClose={() => setShowForm(false)}>
          <AddLeadForm
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
            error={createMutation.error?.message}
          />
        </Modal>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <Modal title={selectedLead.name} onClose={() => setSelectedLead(null)}>
          <LeadDetail
            lead={selectedLead}
            onDelete={() => deleteMutation.mutate(selectedLead.id)}
            onTrigger={(type) =>
              triggerMutation.mutate({ type, lead_id: selectedLead.id })
            }
            isDeleting={deleteMutation.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddLeadForm({
  onSubmit,
  isLoading,
  error,
}: {
  onSubmit: (data: any) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', notes: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {[
        { name: 'name', label: 'Name *', type: 'text', required: true },
        { name: 'email', label: 'Email *', type: 'email', required: true },
        { name: 'company', label: 'Company', type: 'text' },
        { name: 'phone', label: 'Phone', type: 'tel' },
      ].map((f) => (
        <div key={f.name}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
          <input
            type={f.type}
            required={f.required}
            value={(form as any)[f.name]}
            onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        Add Lead & Start Outreach
      </button>
    </form>
  );
}

function LeadDetail({
  lead,
  onDelete,
  onTrigger,
  isDeleting,
}: {
  lead: Lead;
  onDelete: () => void;
  onTrigger: (type: string) => void;
  isDeleting: boolean;
}) {
  const { data } = useQuery({
    queryKey: ['lead', lead.id],
    queryFn: () => api.leads.get(lead.id),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-slate-400">Email:</span> <span className="text-slate-700">{lead.email}</span></div>
        <div><span className="text-slate-400">Company:</span> <span className="text-slate-700">{lead.company || '—'}</span></div>
        <div><span className="text-slate-400">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[lead.status]}`}>{lead.status}</span></div>
        <div><span className="text-slate-400">Score:</span> <span className="text-slate-700">{lead.score ?? '—'}</span></div>
      </div>

      {data?.messages && data.messages.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Messages ({data.messages.length})</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {data.messages.map((msg) => (
              <div key={msg.id} className={`text-xs p-2 rounded-lg ${msg.direction === 'inbound' ? 'bg-violet-50 border border-violet-100' : 'bg-slate-50 border border-slate-100'}`}>
                <div className="flex justify-between text-slate-400 mb-0.5">
                  <span>{msg.type} · {msg.direction}</span>
                  <span>{format(new Date(msg.sent_at), 'MMM d HH:mm')}</span>
                </div>
                <p className="text-slate-600 line-clamp-2">{msg.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual triggers */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Manual Triggers</p>
        <div className="flex flex-wrap gap-2">
          {[
            { type: 'new_lead', label: 'Resend Outreach' },
            { type: 'follow_up_due', label: 'Send Follow-up' },
            { type: 'lead_replied', label: 'Simulate Reply' },
            { type: 'lead_qualified', label: 'Trigger Scheduling' },
          ].map(({ type, label }) => (
            <button
              key={type}
              onClick={() => onTrigger(type)}
              className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
      >
        <Trash2 className="w-4 h-4" /> Delete Lead
      </button>
    </div>
  );
}
