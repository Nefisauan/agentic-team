'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Activity, BarChart3, Zap, Instagram, MessageCircle, Search, FileText, Handshake } from 'lucide-react';
import clsx from 'clsx';

const nav = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/social', label: 'Social Content', icon: Instagram },
  { href: '/prospects', label: 'Prospects', icon: Search },
  { href: '/agencies', label: 'Agency Partners', icon: Handshake },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/metrics', label: 'Metrics', icon: BarChart3 },
  { href: '/reports', label: 'Reports', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="px-5 py-6 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-sm tracking-wide">AutoReach</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Multi-agent outreach + social</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">v2.1.0 — Social + Agency</p>
      </div>
    </aside>
  );
}
