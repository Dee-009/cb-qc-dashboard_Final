import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, RotateCcw, TrendingUp, AlertTriangle, Building2, Wrench, X, UserCheck } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';

// CB-only business units for EXTERNAL remakes filter
const CB_EXTERNAL_BUS = [
  'Crown & Bridge - Stain & Glaze',
  'Crown & Bridge - MiYo/Porcelain',
  'Data Capture - Crown & Bridge 1',
  'Quality Control C&B (Schedule)',
  'Shared Services - Crown & Bridge 1',
  'Shared Services - Crown & Bridge 2',
  'Shared Services - Crown & Bridge 3',
  'Shared Services - Crown & Bridge 4',
  'Shared Services - Crown & Bridge 5',
  'Technical Advisory C&B (Schedule)',
  'Ceramics Finish (Schedule)',
];

// CB business units for INTERNAL remakes (mrb_cb)
const CB_BUSINESS_UNITS = [
  'Crown & Bridge - MiYo/Porcelain',
  'Crown & Bridge - Stain & Glaze',
  'Data Capture - Crown & Bridge 1',
  'Quality Control C&B (Schedule)',
  'Shared Services - Crown & Bridge 1',
  'Shared Services - Crown & Bridge 2',
  'Shared Services - Crown & Bridge 3',
  'Shared Services - Crown & Bridge 4',
  'Shared Services - Crown & Bridge 5',
  'Technical Advisory C&B (Schedule)',
];

const FAULT_STYLES = {
  'Lab Fault':      'bg-rose-50 text-rose-700 border-rose-200',
  'Doctor Fault':   'bg-amber-50 text-amber-700 border-amber-200',
  "Nobody's Fault": 'bg-sky-50 text-sky-700 border-sky-200',
};

function getDateFrom(range) {
  return format(subDays(new Date(), parseInt(range)), 'yyyy-MM-dd');
}

// Detail panel for internal remake
function InternalDetailPanel({ entry, onClose }) {
  if (!entry) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Internal Remake</p>
            <h3 className="text-xl font-bold font-mono">{entry.case_number}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {entry.step_date ? format(parseISO(entry.step_date), 'MMM d, yyyy · h:mm a') : '—'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted ml-4">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Department', entry.dept_name],
              ['Business Unit', entry.business_unit],
              ['Technician', entry.tech_name?.replace('OC-', '')],
              ['Step', entry.step_consolidated || entry.step_name],
            ].map(([label, val]) => (
              <div key={label} className="p-3 rounded-xl border bg-muted/20">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                <p className="text-sm font-medium">{val || '—'}</p>
              </div>
            ))}
          </div>
          {entry.remake_description && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Description</p>
              <p className="text-sm leading-relaxed">{entry.remake_description}</p>
            </div>
          )}
          {entry.internal_remake_reason && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reason</p>
              <p className="text-sm leading-relaxed">{entry.internal_remake_reason}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function Remakes() {
  const [selectedInternal, setSelectedInternal] = useState(null);
  const [tab, setTab]           = useState('external');
  const [dateRange, setDateRange] = useState('30');
  const [search, setSearch]     = useState('');
  const [filterFault, setFilterFault] = useState('all');

  const dateFrom = getDateFrom(dateRange);

  // ── External remakes — cb_dept_remakes ───────────────────────────────────
  const { data: externalCases = [], isLoading: loadingExt } = useQuery({
    queryKey: ['cb_external_remakes', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cb_dept_remakes')
        .select('"Case Number","Invoice Date","Remake Fault","Business Unit","Abs Order Id"')
        .in('"Business Unit"', CB_EXTERNAL_BUS)
        .gte('"Invoice Date"', dateFrom)
        .order('"Invoice Date"', { ascending: false });
      if (error) throw error;
      // Deduplicate by Case Number + Invoice Date (same case appears across multiple BUs)
      const seen = new Set();
      return (data ?? []).filter(r => {
        const key = `${r['Case Number']}-${r['Invoice Date']}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
    },
  });

  // ── Internal remakes — mrb_cb filtered to CB BUs ─────────────────────────
  const { data: internalCases = [], isLoading: loadingInt } = useQuery({
    queryKey: ['cb_internal_remakes', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mrb_cb')
        .select('case_number, step_date, dept_name, step_name, business_unit, tech_name, remake_description, internal_remake_reason, step_consolidated')
        .in('business_unit', CB_BUSINESS_UNITS)
        .gte('step_date', dateFrom + 'T00:00:00Z')
        .order('step_date', { ascending: false });
      if (error) throw error;
      // Deduplicate by case_number
      const seen = new Set();
      return (data ?? []).filter(r => {
        if (seen.has(r.case_number)) return false;
        seen.add(r.case_number); return true;
      });
    },
  });

  const isLoading = loadingExt || loadingInt;

  // Stats
  const labFaultCount = externalCases.filter(c => c['Remake Fault'] === 'Lab Fault').length;

  // Daily remake count from external
  const dailyMap = externalCases.reduce((acc, c) => {
    const d = c['Invoice Date'];
    if (d) acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});
  const dailyData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: format(parseISO(date), 'MMM d'), Remakes: count }));

  // Top remake reasons (fault types for external)
  const faultCounts = externalCases.reduce((acc, c) => {
    const r = c['Remake Fault'] || 'Unknown';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});
  const topReasons = Object.entries(faultCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }));

  // Filtered rows
  const filteredExternal = externalCases.filter(c => {
    const matchSearch = !search ||
      (c['Case Number'] || '').toLowerCase().includes(search.toLowerCase()) ||
      (c['Remake Fault'] || '').toLowerCase().includes(search.toLowerCase()) ||
      (c['Business Unit'] || '').toLowerCase().includes(search.toLowerCase());
    const matchFault = filterFault === 'all' || c['Remake Fault'] === filterFault;
    return matchSearch && matchFault;
  });

  const filteredInternal = internalCases.filter(c =>
    !search ||
    c.case_number.toLowerCase().includes(search.toLowerCase()) ||
    (c.dept_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.tech_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const headers = tab === 'external'
      ? ['Case #', 'Invoice Date', 'Fault', 'Business Unit']
      : ['Case #', 'Date', 'Department', 'Business Unit', 'Step', 'Technician', 'Reason'];
    const rows = tab === 'external'
      ? filteredExternal.map(r => [r['Case Number'], r['Invoice Date'], r['Remake Fault'], r['Business Unit']])
      : filteredInternal.map(r => [r.case_number, r.step_date?.slice(0, 10), r.dept_name, r.business_unit, r.step_consolidated || r.step_name, r.tech_name, r.remake_description || '']);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `cb-remakes-${tab}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Remakes — Crown &amp; Bridge</h2>
          <p className="text-sm text-muted-foreground">External remakes from doctors + Internal remakes flagged in ABS</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
        {[
          { key: 'external', label: 'External (from doctors)', icon: Building2, count: externalCases.length },
          { key: 'internal', label: 'Internal (ABS flagged)',  icon: Wrench,    count: internalCases.length },
        ].map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSearch(''); setFilterFault('all'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
              tab === key ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10'
            }`}>{count.toLocaleString()}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'External Remakes',  value: externalCases.length.toLocaleString(),  icon: RotateCcw,     color: 'text-violet-600 bg-violet-50' },
              { label: 'Internal Remakes',  value: internalCases.length.toLocaleString(),  icon: Wrench,        color: 'text-blue-600 bg-blue-50'    },
              { label: 'Lab Fault',         value: labFaultCount.toLocaleString(),          icon: AlertTriangle, color: 'text-rose-600 bg-rose-50'    },
              { label: 'Date Range',        value: `${dateRange}d`,                         icon: TrendingUp,    color: 'text-emerald-600 bg-emerald-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts — external tab only */}
          {tab === 'external' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Daily Remake Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-52">
                    {dailyData.length === 0
                      ? <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data for selected range</div>
                      : <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dailyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214,32%,91%)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                            <Line dataKey="Remakes" stroke="hsl(0,84%,60%)" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                    }
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Remake Fault Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-52">
                    {topReasons.length === 0
                      ? <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data yet</div>
                      : <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topReasons} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(214,32%,91%)" />
                            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                            <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={120} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                            <Bar dataKey="count" fill="hsl(271,81%,56%)" radius={[0, 4, 4, 0]} barSize={14} />
                          </BarChart>
                        </ResponsiveContainer>
                    }
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {tab === 'external'
                  ? `External Remake Cases — ${filteredExternal.length.toLocaleString()} cases`
                  : `Internal Remake Cases — ${filteredInternal.length.toLocaleString()} unique cases`
                }
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={tab === 'external' ? 'Search case #, fault, BU…' : 'Search case #, dept, tech…'}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {tab === 'external' && (
                  <Select value={filterFault} onValueChange={setFilterFault}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="All Faults" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Faults</SelectItem>
                      <SelectItem value="Lab Fault">Lab Fault</SelectItem>
                      <SelectItem value="Doctor Fault">Doctor Fault</SelectItem>
                      <SelectItem value="Nobody's Fault">Nobody's Fault</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  {tab === 'external' ? (
                    <>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Case #</TableHead>
                          <TableHead className="font-semibold">Invoice Date</TableHead>
                          <TableHead className="font-semibold">Fault</TableHead>
                          <TableHead className="font-semibold">Business Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExternal.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No external remakes found</TableCell></TableRow>
                        )}
                        {filteredExternal.slice(0, 200).map((c, i) => (
                          <TableRow key={i} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-sm font-semibold">{c['Case Number']}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {c['Invoice Date'] ? format(parseISO(c['Invoice Date']), 'MMM d, yyyy') : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={FAULT_STYLES[c['Remake Fault']] || 'bg-slate-50 text-slate-600 border-slate-200'}>
                                {c['Remake Fault'] || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c['Business Unit'] || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </>
                  ) : (
                    <>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Case #</TableHead>
                          <TableHead className="font-semibold">Date</TableHead>
                          <TableHead className="font-semibold">Department</TableHead>
                          <TableHead className="font-semibold">Business Unit</TableHead>
                          <TableHead className="font-semibold">Step</TableHead>
                          <TableHead className="font-semibold">Technician</TableHead>
                          <TableHead className="font-semibold">Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInternal.length === 0 && (
                          <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No internal remakes found</TableCell></TableRow>
                        )}
                        {filteredInternal.slice(0, 200).map((c, i) => (
                          <TableRow key={i} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedInternal(c)}>
                            <TableCell className="font-mono text-sm font-semibold">{c.case_number}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {c.step_date ? format(parseISO(c.step_date), 'MMM d, yyyy') : '—'}
                            </TableCell>
                            <TableCell className="text-sm">{c.dept_name || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{c.business_unit || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.step_consolidated || c.step_name || '—'}</TableCell>
                            <TableCell className="text-sm font-medium">{c.tech_name?.replace('OC-', '') || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {c.remake_description || <span className="italic opacity-40">No reason entered</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedInternal && <InternalDetailPanel entry={selectedInternal} onClose={() => setSelectedInternal(null)} />}
    </div>
  );
}
