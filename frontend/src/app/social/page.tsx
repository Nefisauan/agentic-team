'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, SocialPost } from '@/lib/api';
import { format } from 'date-fns';
import {
  Plus, Loader2, Trash2, Instagram, Linkedin, Eye, Calendar,
  Heart, MessageCircle, Share2, Send, RefreshCw,
} from 'lucide-react';

const platformIcon = {
  instagram: Instagram,
  linkedin: Linkedin,
};

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
};

export default function SocialPage() {
  const queryClient = useQueryClient();
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['social-posts', filterPlatform, filterStatus],
    queryFn: () => api.social.posts({
      platform: filterPlatform || undefined,
      status: filterStatus || undefined,
      limit: 50,
    }),
  });

  const { data: metricsData } = useQuery({
    queryKey: ['social-metrics'],
    queryFn: api.social.metrics,
    refetchInterval: 60_000,
  });

  const { data: dmsData } = useQuery({
    queryKey: ['social-dms'],
    queryFn: () => api.social.dms({ limit: 20 }),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.social.generate({ mode: 'weekly_batch' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-posts'] }),
  });

  const batchDMMutation = useMutation({
    mutationFn: (platform: string) => api.social.batchDM({ platform }),
  });

  const deletePostMutation = useMutation({
    mutationFn: api.social.deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      setSelectedPost(null);
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SocialPost> }) => api.social.updatePost(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-posts'] }),
  });

  // Aggregate metrics
  const igMetrics = metricsData?.posts?.find(p => p.platform === 'instagram');
  const liMetrics = metricsData?.posts?.find(p => p.platform === 'linkedin');
  const igDMs = metricsData?.dms?.find(p => p.platform === 'instagram');
  const liDMs = metricsData?.dms?.find(p => p.platform === 'linkedin');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Social Content</h1>
          <p className="text-slate-500 text-sm mt-1">Instagram & LinkedIn posts and DMs</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => batchDMMutation.mutate('instagram')}
            disabled={batchDMMutation.isPending}
            className="flex items-center gap-2 text-sm border border-pink-200 hover:bg-pink-50 text-pink-700 px-3 py-2 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" /> Batch IG DMs
          </button>
          <button
            onClick={() => batchDMMutation.mutate('linkedin')}
            disabled={batchDMMutation.isPending}
            className="flex items-center gap-2 text-sm border border-blue-200 hover:bg-blue-50 text-blue-700 px-3 py-2 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" /> Batch LI DMs
          </button>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate Weekly Content
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="IG Posts"
          value={igMetrics?.total_posts || '0'}
          sub={`${igMetrics?.published || 0} published`}
          icon={Instagram}
          color="bg-pink-500"
        />
        <MetricCard
          label="LI Posts"
          value={liMetrics?.total_posts || '0'}
          sub={`${liMetrics?.published || 0} published`}
          icon={Linkedin}
          color="bg-blue-600"
        />
        <MetricCard
          label="Total Engagement"
          value={String(
            parseInt(igMetrics?.total_likes || '0') +
            parseInt(liMetrics?.total_likes || '0') +
            parseInt(igMetrics?.total_comments || '0') +
            parseInt(liMetrics?.total_comments || '0')
          )}
          sub="Likes + Comments"
          icon={Heart}
          color="bg-red-500"
        />
        <MetricCard
          label="DMs Sent"
          value={String(parseInt(igDMs?.sent || '0') + parseInt(liDMs?.sent || '0'))}
          sub={`${parseInt(igDMs?.replied || '0') + parseInt(liDMs?.replied || '0')} replied`}
          icon={MessageCircle}
          color="bg-violet-500"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All platforms</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
        </select>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : data?.posts?.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-400">
            No posts yet. Click "Generate Weekly Content" to create your first batch.
          </div>
        ) : (
          data?.posts?.map((post) => {
            const PlatformIcon = platformIcon[post.platform];
            return (
              <div
                key={post.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedPost(post)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PlatformIcon className={`w-4 h-4 ${post.platform === 'instagram' ? 'text-pink-500' : 'text-blue-600'}`} />
                    <span className="text-xs font-medium text-slate-500 uppercase">{post.content_type}</span>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[post.status]}`}>
                    {post.status}
                  </span>
                </div>
                <p className="text-sm text-slate-700 line-clamp-3 mb-3">{post.caption}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {post.hashtags?.slice(0, 4).map((tag) => (
                    <span key={tag} className="text-xs text-blue-500">#{tag}</span>
                  ))}
                  {(post.hashtags?.length || 0) > 4 && (
                    <span className="text-xs text-slate-400">+{post.hashtags.length - 4} more</span>
                  )}
                </div>
                {post.image_prompt && (
                  <p className="text-xs text-slate-400 italic line-clamp-1 mb-2">
                    Photo: {post.image_prompt}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    {post.engagement?.likes != null && (
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.engagement.likes}</span>
                    )}
                    {post.engagement?.comments != null && (
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.engagement.comments}</span>
                    )}
                    {post.engagement?.reach != null && (
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.engagement.reach}</span>
                    )}
                  </div>
                  {post.scheduled_for && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(post.scheduled_for), 'MMM d, HH:mm')}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recent DMs Section */}
      {dmsData?.dms && dmsData.dms.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">Recent DMs</h2>
          <div className="space-y-3">
            {dmsData.dms.slice(0, 10).map((dm) => {
              const PlatformIcon = platformIcon[dm.platform];
              return (
                <div key={dm.id} className="flex items-start gap-3 text-sm">
                  <PlatformIcon className={`w-4 h-4 mt-0.5 ${dm.platform === 'instagram' ? 'text-pink-500' : 'text-blue-600'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-slate-400">{dm.direction === 'outbound' ? 'Sent' : 'Received'}</span>
                      {dm.lead_name && <span className="text-xs font-medium text-slate-600">{dm.lead_name}</span>}
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs ${dm.status === 'replied' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {dm.status}
                      </span>
                    </div>
                    <p className="text-slate-600 line-clamp-2">{dm.message}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">
                    {dm.sent_at ? format(new Date(dm.sent_at), 'MMM d') : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedPost(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {(() => { const Icon = platformIcon[selectedPost.platform]; return <Icon className="w-5 h-5" />; })()}
                <h2 className="text-lg font-semibold text-slate-800 capitalize">{selectedPost.platform} {selectedPost.content_type}</h2>
              </div>
              <button onClick={() => setSelectedPost(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>

            <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4">{selectedPost.caption}</p>

            <div className="flex flex-wrap gap-1 mb-4">
              {selectedPost.hashtags?.map((tag) => (
                <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">#{tag}</span>
              ))}
            </div>

            {selectedPost.image_prompt && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Suggested Photo/Visual</p>
                <p className="text-sm text-slate-600">{selectedPost.image_prompt}</p>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedPost.status]}`}>
                {selectedPost.status}
              </span>
              {selectedPost.scheduled_for && (
                <span className="text-xs text-slate-400">Scheduled: {format(new Date(selectedPost.scheduled_for), 'MMM d, yyyy HH:mm')}</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedPost.status === 'draft' && (
                <button
                  onClick={() => {
                    updatePostMutation.mutate({ id: selectedPost.id, data: { status: 'scheduled' } });
                    setSelectedPost({ ...selectedPost, status: 'scheduled' });
                  }}
                  className="text-xs border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50"
                >
                  Schedule
                </button>
              )}
              {selectedPost.status === 'scheduled' && (
                <button
                  onClick={() => {
                    updatePostMutation.mutate({ id: selectedPost.id, data: { status: 'published' } });
                    setSelectedPost({ ...selectedPost, status: 'published' });
                  }}
                  className="text-xs border border-green-200 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-50"
                >
                  Mark Published
                </button>
              )}
              <button
                onClick={() => deletePostMutation.mutate(selectedPost.id)}
                disabled={deletePostMutation.isPending}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-3 py-1.5"
              >
                <Trash2 className="w-3 h-3" /> Delete
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
