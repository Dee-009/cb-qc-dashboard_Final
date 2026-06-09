import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, QCLog } from '@/api/supabaseClient';
import { LogDetailPanel } from '@/components/qc/LogDetailPanel';
import { Download, RotateCcw, Wrench, ClipboardList, TrendingUp, AlertTriangle, ArrowUp, ArrowDown, Minus, Truck, MessageCircleWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend, ComposedChart
} from 'recharts';
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';

function cleanReason(r) {
  if (!r) return 'No reason entered';
  return r.replace(/^\d+\.\s*/, '').trim() || 'No reason entered';
}

function getDateBounds(range) {
  if (range.startsWith('day-')) {
    const n = parseInt(range.replace('day-', ''));
    const d = subDays(new Date(), n);
    return { from: startOfDay(d), to: endOfDay(d), label: n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`, fromStr: format(d, 'yyyy-MM-dd') };
  }
  const days = parseInt(range);
  const from = subDays(new Date(), days);
  return { from, to: new Date(), label: `Last ${days} days`, fromStr: format(from, 'yyyy-MM-dd') };
}

function Trend({ value, inverse }) {
  if (value === null || value === undefined) return null;
  const good = inverse ? value < 0 : value > 0;
  const color = value === 0 ? 'text-muted-foreground' : good ? 'text-emerald-600' : 'text-rose-600';
  const Icon = value === 0 ? Minus : value > 0 ? ArrowUp : ArrowDown;
  return (
    <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${color}`}>
      <Icon className="w-3 h-3" />{Math.abs(value).toFixed(1)}% vs prev period
    </div>
  );
}

function KPI({ label, value, sub, icon: Icon, iconBg, trend, inverse, alert }) {
  return (
    <Card className={alert ? 'border-rose-200' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            <Trend value={trend} inverse={inverse} />
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ml-3 ${iconBg}`}><Icon className="w-5 h-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, sub, color }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${color}`}>
      <Icon className="w-5 h-5 shrink-0" />
      <div>
        <p className="font-bold text-sm">{title}</p>
        {sub && <p className="text-xs opacity-70">{sub}</p>}
      </div>
    </div>
  );
}

const INTERNAL_DEPT_LABELS = {
  NESTMODJIG: 'Nest Model/Jig',
  PRNTVFMOD: 'Print Verification',
  PRNTJIG: 'Print Jig',
  'PRNTMOD&TISSFA': 'Print Model & Tissue',
  'PRINT(AIX)': 'Print (AIX)',
  PRNTCUSTRYFA: 'Print Custom Tray',
};

export default function LeadershipDashboard() {
  const [dateRange, setDateRange] = useState('30');
  const [selectedLog, setSelectedLog] = useState(null);
  const queryClient = useQueryClient();
  const bounds = getDateBounds(dateRange);

  const { data: allLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['qclogs'],
    queryFn: () => QCLog.list('-time_stamp', 1000),
  });
  useEffect(() => {
    const unsub = QCLog.subscribe(() => queryClient.invalidateQueries({ queryKey: ['qclogs'] }));
    return () => unsub();
  }, [queryClient]);

  const { data: remakeRate = [] } = useQuery({
    queryKey: ['remake_rate', bounds.fromStr],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_remake_rate_daily_by_bu').select('report_date, shipped_case_count, remake_case_count, remake_rate_pct').eq('business_unit_l1', 'Crown & Bridge').gte('report_date', bounds.fromStr).order('report_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: externalCases = [] } = useQuery({
    queryKey: ['external_cases', bounds.fromStr],
    queryFn: async () => {
      const { data, error } = await supabase.from('cases_remake').select('case_number, remake_fault, remake_reason, received_date, primary_product').eq('business_unit', 'Crown & Bridge').gte('received_date', bounds.fromStr).order('received_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: internalRaw = [] } = useQuery({
    queryKey: ['internal_mrb', bounds.fromStr],
    queryFn: async () => {
      const { data, error } = await supabase.from('mrb_cb').select('case_number, step_date, dept_name, remake_description, tech_name, step_consolidated').in('business_unit', ['Crown & Bridge - Design Dept (Schedule)', 'Crown & Bridge - Production (Schedule)', 'Shared Services - Crown & Bridge 1', 'Shared Services - Crown & Bridge 3']).gte('step_date', bounds.fromStr + 'T00:00:00Z').order('step_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: otdData = [] } = useQuery({
    queryKey: ['otd', bounds.fromStr],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_otd_daily_by_bu').select('report_date, shipped_case_count, on_time_case_count, otd_pct').eq('business_unit_l1', 'Crown & Bridge').gte('report_date', bounds.fromStr).order('report_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: complaintsRaw = [] } = useQuery({
    queryKey: ['complaints_leadership', bounds.fromStr],
    queryFn: async () => {
      // Columns have spaces — use raw Postgres function via rpc workaround
      // Fetch all complaint notes, filter date + BU entirely in JS
      const { data: caseNotes, error } = await supabase
        .from('Case Notes')
        .select('"Case Number","Subject","Created Date"')
        .ilike('Subject', '%complaint%')
        .order('Created Date', { ascending: false })
        .limit(1000);
      if (error) throw error;
      if (!caseNotes?.length) return [];

      // Filter by date in JS (column names with spaces break PostgREST filters)
      const dated = caseNotes.filter(n => n['Created Date'] >= bounds.fromStr);
      if (!dated.length) return [];

      // Fetch all Crown & Bridge case numbers in one shot — no column-with-space filter
      const caseNums = [...new Set(dated.map(n => n['Case Number']))];
      const { data: cases } = await supabase
        .from('Cases')
        .select('"Case Number","Business Unit","Primary Product"')
        .in('Case Number', caseNums);
      
      // Filter BU in JS
      const validSet = new Set(
        (cases || []).filter(c => c['Business Unit'] === 'Crown & Bridge').map(c => c['Case Number'])
      );
      return dated.filter(n => validSet.has(n['Case Number']));
    },
  });

  const logs = allLogs.filter(l => l.time_stamp && parseISO(l.time_stamp) >= bounds.from && parseISO(l.time_stamp) <= bounds.to);
  const opsLogs = logs.filter(l => ['ASAP(Same day)', 'Repair', 'Next Day'].includes(l.qc_reject));

  const categorizeComplaint = (subject) => {
    const s = (subject || '').toLowerCase();
    if (s.includes('late') || s.includes('shipping') || s.includes('delivery')) return 'Late / Shipping';
    if (s.includes('design') || s.includes('fit') || s.includes('occlusion')) return 'Design Issue';
    if (s.includes('rx') || s.includes('not followed')) return 'Rx Not Followed';
    if (s.includes('wrong') || s.includes('incorrect')) return 'Wrong Delivery';
    if (s.includes('break') || s.includes('crack') || s.includes('fracture')) return 'Breakage';
    return 'Other';
  };
  const complaintsByCategory = complaintsRaw.reduce((acc, c) => {
    const cat = categorizeComplaint(c['Subject']);
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const complaintCategoryData = Object.entries(complaintsByCategory).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  const totalShipped = remakeRate.reduce((s, r) => s + parseInt(r.shipped_case_count || 0), 0);
  const totalExtRemakes = remakeRate.reduce((s, r) => s + parseInt(r.remake_case_count || 0), 0);
  const avgRemakeRate = totalShipped > 0 ? (totalExtRemakes / totalShipped * 100) : 0;
  const labFaultCount = externalCases.filter(c => c.remake_fault === 'Lab Fault').length;
  const noReasonCount = externalCases.filter(c => !c.remake_reason?.trim()).length;

  const extReasonCounts = externalCases.reduce((acc, c) => {
    const r = cleanReason(c.remake_reason);
    if (r !== 'No reason entered') acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});
  const extReasons = Object.entries(extReasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([reason, count]) => ({ reason, count }));

  const extFaultCounts = externalCases.reduce((acc, c) => {
    acc[c.remake_fault || 'Unknown'] = (acc[c.remake_fault || 'Unknown'] || 0) + 1;
    return acc;
  }, {});

  const uniqueInternal = Object.values(internalRaw.reduce((acc, r) => {
    if (!acc[r.case_number]) acc[r.case_number] = r;
    return acc;
  }, {}));

  const intReasonCounts = internalRaw.reduce((acc, r) => {
    const reason = cleanReason(r.remake_description);
    if (reason !== 'No reason entered') acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
  const intReasons = Object.entries(intReasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([reason, count]) => ({ reason, count }));

  const intDeptCounts = internalRaw.reduce((acc, r) => {
    const label = INTERNAL_DEPT_LABELS[r.dept_name] || r.dept_name;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  const intDepts = Object.entries(intDeptCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([dept, count]) => ({ dept, count }));

  const opsByType = opsLogs.reduce((acc, l) => { const t = l.reject_type || 'Other'; acc[t] = (acc[t] || 0) + 1; return acc; }, {});
  const opsTypes = Object.entries(opsByType).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([type, count]) => ({ type: type.length > 22 ? type.slice(0, 22) + '…' : type, count, full: type }));

  const opsByTeam = opsLogs.reduce((acc, l) => { if (l.team) acc[l.team] = (acc[l.team] || 0) + 1; return acc; }, {});
  const opsTeams = Object.entries(opsByTeam).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([team, count]) => ({ team: team.length > 14 ? team.slice(0, 14) + '…' : team, count }));

  const trendDays = Math.min(parseInt(dateRange) || 7, 30);
  const trendData = Array.from({ length: trendDays }, (_, i) => {
    const d = subDays(new Date(), trendDays - 1 - i);
    const dayStr = format(d, 'yyyy-MM-dd');
    const remakeRow = remakeRate.find(r => r.report_date === dayStr);
    const intCount = internalRaw.filter(r => r.step_date?.startsWith(dayStr)).length;
    return {
      date: format(d, 'MMM d'),
      'Ext Remakes': remakeRow ? parseInt(remakeRow.remake_case_count || 0) : 0,
      'Int Remakes': intCount,
      'OTD %': otdData.find(r => r.report_date === dayStr) ? parseFloat((otdData.find(r => r.report_date === dayStr).otd_pct * 100).toFixed(1)) : null,
    };
  }).filter(d => d['Ext Remakes'] > 0 || d['Int Remakes'] > 0 || d['OTD %'] !== null);

  const avgOtd = otdData.length ? (otdData.reduce((s, r) => s + parseFloat(r.otd_pct), 0) / otdData.length * 100).toFixed(1) : '—';

  const exportCSV = () => {
    const headers = ['Case', 'Team', 'Tech', 'QC Reject', 'Reject Type', 'Details', 'Time'];
    const rows = opsLogs.map(l => [l.case_number, l.team, l.technician, l.qc_reject, l.reject_type, l.reject_details || '', l.time_stamp ? format(parseISO(l.time_stamp), 'yyyy-MM-dd HH:mm') : '']);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `leadership-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loadingLogs) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-6 py-6 space-y-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Leadership Overview</h2>
          <p className="text-sm text-muted-foreground">Crown & Bridge · CB · {bounds.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4" /> Export</Button>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day-0">Today</SelectItem>
              <SelectItem value="day-1">Yesterday</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Top KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Ext Remake Rate" value={`${avgRemakeRate.toFixed(1)}%`} sub={`${totalExtRemakes} of ${totalShipped} shipped`} icon={RotateCcw} iconBg={avgRemakeRate > 10 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'} alert={avgRemakeRate > 10} inverse />
        <KPI label="Internal Remakes" value={uniqueInternal.length} sub="Unique cases (ABS)" icon={Wrench} iconBg="bg-violet-50 text-violet-600" />
        <KPI label="QC Reworks" value={opsLogs.length} sub="ASAP + Repair + Next Day" icon={ClipboardList} iconBg="bg-primary/10 text-primary" />
        <KPI label="On-Time Delivery" value={`${avgOtd}%`} sub="Crown & Bridge (ABS)" icon={Truck} iconBg={parseFloat(avgOtd) >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} />
        <KPI label="Complaints" value={complaintsRaw.length} sub="Dr complaints (ABS)" icon={MessageCircleWarning} iconBg="bg-rose-50 text-rose-600" alert={complaintsRaw.length > 5} />
      </div>

      {/* ── Daily trend ── */}
      {trendData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Daily Trend — External & Internal Remakes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214,32%,91%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="Ext Remakes" fill="#E24B4A" radius={[4,4,0,0]} barSize={14} />
                  <Bar yAxisId="left" dataKey="Int Remakes" fill="#534AB7" radius={[4,4,0,0]} barSize={14} />
                  <Line yAxisId="right" type="monotone" dataKey="OTD %" stroke="#1D9E75" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 1 — EXTERNAL REMAKES */}
      <div className="space-y-4">
        <SectionHeader icon={RotateCcw} title="External Remakes" sub="Cases returned by doctors — from ABS" color="bg-rose-50 text-rose-700 border-rose-200" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[{ label: 'Total', value: externalCases.length }, { label: 'Lab Fault', value: labFaultCount }, { label: 'Doctor Fault', value: externalCases.filter(c => c.remake_fault === 'Doctor Fault').length }, { label: 'No Reason', value: noReasonCount, alert: noReasonCount > 5 }].map(({ label, value, alert }) => (
            <Card key={label} className={alert ? 'border-amber-200' : ''}><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Remake Reasons</CardTitle></CardHeader>
            <CardContent><div className="h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={extReasons} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(214,32%,91%)" /><XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} /><YAxis type="category" dataKey="reason" tick={{ fontSize: 10 }} width={120} /><Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} /><Bar dataKey="count" fill="#E24B4A" radius={[0,4,4,0]} barSize={14} /></BarChart></ResponsiveContainer></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fault Split</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-2">
              {Object.entries(extFaultCounts).sort((a, b) => b[1] - a[1]).map(([fault, count]) => {
                const pct = externalCases.length ? Math.round(count / externalCases.length * 100) : 0;
                const color = fault === 'Lab Fault' ? 'bg-rose-500' : fault === 'Doctor Fault' ? 'bg-amber-500' : 'bg-sky-500';
                return (
                  <div key={fault}>
                    <div className="flex justify-between text-xs mb-1"><span className="font-medium">{fault}</span><span className="text-muted-foreground">{count} ({pct}%)</span></div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 2 — INTERNAL REMAKES */}
      <div className="space-y-4">
        <SectionHeader icon={Wrench} title="Internal Remakes" sub="Cases flagged internally before shipping — from ABS" color="bg-violet-50 text-violet-700 border-violet-200" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[{ label: 'Unique Cases', value: uniqueInternal.length }, { label: 'Total Steps', value: internalRaw.length }, { label: 'No Reason', value: internalRaw.filter(r => !r.remake_description?.trim()).length }].map(({ label, value }) => (
            <Card key={label}><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Internal Remake Reasons</CardTitle></CardHeader>
            <CardContent><div className="h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={intReasons} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(214,32%,91%)" /><XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} /><YAxis type="category" dataKey="reason" tick={{ fontSize: 10 }} width={120} /><Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} /><Bar dataKey="count" fill="#534AB7" radius={[0,4,4,0]} barSize={14} /></BarChart></ResponsiveContainer></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By Department Step</CardTitle></CardHeader>
            <CardContent><div className="h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={intDepts} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(214,32%,91%)" /><XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} /><YAxis type="category" dataKey="dept" tick={{ fontSize: 10 }} width={120} /><Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} /><Bar dataKey="count" fill="#8B5CF6" radius={[0,4,4,0]} barSize={14} /></BarChart></ResponsiveContainer></div></CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 3 — QC REWORKS */}
      <div className="space-y-4">
        <SectionHeader icon={ClipboardList} title="QC Reworks — Operations" sub="ASAP, Repair & Next Day reworks done same day" color="bg-amber-50 text-amber-700 border-amber-200" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[{ label: 'ASAP Same Day', value: opsLogs.filter(l => l.qc_reject === 'ASAP(Same day)').length }, { label: 'Repair', value: opsLogs.filter(l => l.qc_reject === 'Repair').length }, { label: 'Next Day', value: opsLogs.filter(l => l.qc_reject === 'Next Day').length }, { label: 'Unique Cases', value: new Set(opsLogs.map(l => l.case_number)).size }].map(({ label, value }) => (
            <Card key={label}><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Rework Types</CardTitle></CardHeader>
            <CardContent><div className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={opsTypes} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(214,32%,91%)" /><XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} /><YAxis type="category" dataKey="type" tick={{ fontSize: 10 }} width={140} /><Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} /><Bar dataKey="count" fill="#EF9F27" radius={[0,4,4,0]} barSize={14} /></BarChart></ResponsiveContainer></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reworks by Team</CardTitle></CardHeader>
            <CardContent><div className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={opsTeams} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(214,32%,91%)" /><XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} /><YAxis type="category" dataKey="team" tick={{ fontSize: 10 }} width={100} /><Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} /><Bar dataKey="count" fill="#378ADD" radius={[0,4,4,0]} barSize={14} /></BarChart></ResponsiveContainer></div></CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent QC Reworks — Click to view details</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Case #</TableHead><TableHead className="font-semibold">Team</TableHead>
                    <TableHead className="font-semibold">Technician</TableHead><TableHead className="font-semibold">QC Rework</TableHead>
                    <TableHead className="font-semibold">Type</TableHead><TableHead className="font-semibold">Details</TableHead>
                    <TableHead className="font-semibold">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opsLogs.slice(0, 15).map((l, i) => (
                    <TableRow key={i} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedLog(l)}>
                      <TableCell className="font-mono text-sm font-medium">{l.case_number}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{l.team}</Badge></TableCell>
                      <TableCell className="text-sm">{l.technician}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{l.qc_reject}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{l.reject_type || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{l.reject_details || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{l.time_stamp ? format(parseISO(l.time_stamp), 'MMM d, h:mm a') : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedLog && <LogDetailPanel log={selectedLog} onClose={() => setSelectedLog(null)} />}

      {/* SECTION 4 — COMPLAINTS */}
      {complaintsRaw.length > 0 && (
        <div className="space-y-4">
          <SectionHeader icon={MessageCircleWarning} title="Customer Complaints" sub="Doctor complaints logged in ABS case notes" color="bg-rose-50 text-rose-700 border-rose-200" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Complaints by Category</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={complaintCategoryData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Complaints</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-[240px] overflow-y-auto">
                  {complaintsRaw.slice(0, 10).map((c, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-semibold text-foreground">{c['Case Number']}</p>
                        <p className="text-xs text-muted-foreground truncate">{c['Subject']}</p>
                      </div>
                      <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-200 shrink-0">
                        {categorizeComplaint(c['Subject'])}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

    </div>
  );
}
