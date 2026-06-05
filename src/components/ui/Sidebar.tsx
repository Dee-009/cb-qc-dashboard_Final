'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardCheck, AlertTriangle, Users } from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/qc-log',    label: 'QC Log',      icon: ClipboardCheck  },
  { href: '/mrb',       label: 'MRB Cases',   icon: AlertTriangle   },
  { href: '/employees', label: 'Employees',   icon: Users           },
];

export default function Sidebar() {
  const p = usePathname();
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>SKDLA</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>Crown &amp; Bridge</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>QC Dashboard</div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', padding: '6px 8px 8px' }}>Menu</div>
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`nav-item${p.startsWith(href) ? ' active' : ''}`}>
            <Icon size={15} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-dim)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Crown &amp; Bridge · SKDLA</div>
      </div>
    </aside>
  );
}
