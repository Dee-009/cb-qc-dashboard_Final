'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type { CbQcLog, CbMrbCase } from '@/types';

const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 },
  cursor: { fill: 'rgba(255,255,255,.04)' },
};

export default function DashboardClient() {
  const [logs, setLogs] = useState<CbQcLog[]>([]);
  const [mrb, setMrb] = useState<CbMrbCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'30' | '90' | 'all'>('30');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let q = supabase.from('cb_qc_logs').select('*').eq('is_sample', false);
      if (range !== 'all') {
        const days = parseInt(range);
        const from = new Date();
        from.setDate(from.getDate() - days);
        q = q.gte('created_date', from.toISOString());
      }
      const [qcRes, mrbRes] = await Promise.all([
        q.order('created_date', { ascending: false }),
        supabase.from('cb_mrb_cases').select('*').order('opened_date', { ascending: false }),
      ]);
      setLogs(qcRes.data ?? []);
      setMrb(mrbRes.data ?? []);
      setLoading(false);
    };
    fetchData();
  }, [range]);

  const total    = logs.length;
  const passed   = logs.filter(l => l.qc_reject === 'Pass').length;
  const failed   = logs.filter(l => l.qc_reject === 'Fail').length;
  const passRate = total ? ((passed / total) * 100).toFixed(1) : '—';
  const mrbOpen  = mrb.filter(m => m.status === 'Open').length;
  const mrbHigh  = mrb.filter(m => m.severity === 'High' && m.status !== 'Closed').length;

  // Reject type chart
  const rejectMap: Record<string, number> = {};
  logs.filter(l => l.qc_reject === 'Fail').forEach(l => {
    const k = l.reject_type ?? 'Unspecified';
    rejectMap[k] = (rejectMap[k] ?? 0) + 1;
  });
  const rejectData = Object.entries(rejectMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8);

  // Pass/Fail pie
  const pieData = [{ name: 'Pass', value: passed }, { name: 'Fail', value: failed }];
  const PIE_COLORS = ['var(--pass)', 'var(--fail)'];

  // Team bar
  const teamMap: Record<string, number> = {};
  logs.forEach(l => { const k = l.team ?? 'Unknown'; teamMap[k] = (teamMap[k] ?? 0) + 1; });
  const teamData = Object.entries(teamMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

  // MRB by severity
  const sevMap: Record<string, number> = {};
  mrb.forEach(m => { sevMap[m.severity] = (sevMap[m.severity] ?? 0) + 1; });
  const sevData = Object.entries(sevMap).map(([name, value]) => ({ name, value }));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-muted)' }}>
      Loading dashboard…
    </div>
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Crown &amp; Bridge QC</h1>
          <p className="page-sub">Quality metrics — {total.toLocaleString()} inspections</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['30', '90', 'all'] as const).map(r => (
            <button key={r} className={`filter-chip${range === r ? ' active' : ''}`} onClick={() => setRange(r)}>
              {r === 'all' ? 'All Time' : `${r}d`}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="stat-grid stat-grid-4" style={{ marginBottom: 20 }}>
        <div className="kpi-tile gold">
          <div className="kpi-label">Total Inspected</div>
          <div className="kpi-value">{total.toLocaleString()}</div>
          <div className="kpi-sub">QC entries logged</div>
        </div>
        <div className="kpi-tile green">
          <div className="kpi-label">Pass Rate</div>
          <div className="kpi-value" style={{ color: 'var(--pass)' }}>{passRate}%</div>
          <div className="kpi-sub">{passed.toLocaleString()} passed</div>
        </div>
        <div className="kpi-tile red">
          <div className="kpi-label">QC Failures</div>
          <div className="kpi-value" style={{ color: 'var(--fail)' }}>{failed.toLocaleString()}</div>
          <div className="kpi-sub">cases rejected</div>
        </div>
        <div className="kpi-tile amber">
          <div className="kpi-label">Open MRB</div>
          <div className="kpi-value" style={{ color: mrbOpen > 0 ? 'var(--warn)' : 'var(--text)' }}>{mrbOpen}</div>
          <div className="kpi-sub">{mrbHigh > 0 ? `${mrbHigh} high severity` : `${mrb.length} total cases`}</div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="chart-card">
          <div className="chart-title">Top Reject Types</div>
          {rejectData.length === 0
            ? <div className="empty-state" style={{ padding: '24px 0' }}>No rejection data yet</div>
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={rejectData} layout="vertical" margin={{ left: 4, right: 12 }}>
                  <XAxis type="number" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="value" fill="var(--fail)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
          }
        </div>
        <div className="chart-card">
          <div className="chart-title">Pass vs Fail</div>
          {total === 0
            ? <div className="empty-state" style={{ padding: '24px 0' }}>No data yet</div>
            : <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} cursor={false} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
          }
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="chart-card">
          <div className="chart-title">Inspections by Team</div>
          {teamData.length === 0
            ? <div className="empty-state" style={{ padding: '24px 0' }}>No team data yet</div>
            : <ResponsiveContainer width="100%" height={180}>
                <BarChart data={teamData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="value" fill="var(--gold)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
          }
        </div>
        <div className="chart-card">
          <div className="chart-title">MRB by Severity</div>
          {sevData.length === 0
            ? <div className="empty-state" style={{ padding: '24px 0' }}>No MRB cases yet</div>
            : <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sevData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {sevData.map((entry, i) => (
                      <Cell key={i} fill={entry.name === 'High' ? 'var(--fail)' : entry.name === 'Medium' ? 'var(--warn)' : 'var(--pass)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </div>
      </div>
    </div>
  );
}
