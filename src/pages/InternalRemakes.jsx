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

const FAULT_STYLES = {
  'Lab Fault':      'bg-rose-50 text-rose-700 border-rose-200',
  'Doctor Fault':   'bg-amber-50 text-amber-700 border-amber-200',
  "Nobody's Fault": 'bg-sky-50 text-sky-700 border-sky-200',
};

function getDateFrom(range) {
  return format(subDays(new Date(), parseInt(range)), 'yyyy-MM-dd');
}

// ── Detail panel for internal remake entries ──────────────────────────────────
function InternalRemakePanel({ entry, onClose }) {
  if (!entry) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Internal Remake Log</p>
            <h3 className="text-xl font-bold font-mono">{entry.case_number}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {entry.time_stamp ? format(parseISO(entry.time_stamp), 'MMM d, yyyy · h:mm a') : '—'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted ml-4">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Department', entry.department],
              ['Logged By', entry.logged_by],
              ['Ship Date', entry.ship_date ? format(parseISO(entry.ship_date), 'MMM d, yyyy') : '—'],
              ['Doctor Due', entry.dr_due_date ? format(parseISO(entry.dr_due_date), 'MMM d, yyyy') : '—'],
            ].map(([label, val]) => (
              <div key={label} className="p-3 rounded-xl border bg-muted/20">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                <p className="text-sm font-medium">{val || '—'}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Expert Needed</p>
            <Badge variant="outline" className={entry.needs_expert ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-50 text-slate-600 border-slate-200'}>
              {entry.needs_expert ? 'Yes — Staged for Expert Review' : 'No — Final QC Review'}
            </Badge>
          </div>
          {entry.description && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Description</p>
              <p className="text-sm leading-relaxed">{entry.description}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function Remakes() {
  const [selectedInternal, setSelectedInternal] = useState(null);
  const [tab, setTab] = useState('external');
  const [dateRange, setDateRange] = useState('30');
  const [search, setSearch] = useState('');
  const [filterFault, setFilterFault] = useState('all');

  const dateFrom = getDateFrom(dateRange);

  // ── Daily rate — from cb_cases_remake ─────────────────────────────────────
  const { data: dailyRate = [], isLoading: loadingRate } = useQuery({
    queryKey: ['cb_remake_rate_daily', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cb_cases_remake')
        .select('received_date')
        .gte('received_date', dateFrom)
        .order('received_date', { ascending: true });
      if (error) throw error;
      // Group by date
      const grouped = (data ?? []).reduce((acc, r) => {
        const d = r.received_date;
        acc[d] = (acc[d] || 0) + 1;
        return acc;
      }, {});
      return Object.entries(grouped).map(([date, count]) => ({
        date: format(parseISO(date), 'MMM d'),
        Remakes: count,
        'Rate %': count,
      }));
    },
  });

  // ── External remakes — cb_cases_remake ────────────────────────────────────
  const { data: externalCases = [], isLoading: loadingExt } = useQuery({
    queryKey: ['cb_external_remakes', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cb_cases_remake')
        .select('case_number, remake_fault, remake_reason, received_date, primary_product, business_unit')
        .gte('received_date', dateFrom)
        .order('received_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Internal remakes — cb_internal_remake_log ─────────────────────────────
  const { data: internalCases = [], isLoading: loadingInt } = useQuery({
    queryKey: ['cb_internal_remakes', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cb_internal_remake_log')
        .select('*')
        .gte('created_date', dateFrom + 'T00:00:00Z')
        .order('created_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = loadingRate || loadingExt || loadingInt;

  // Stats
  const labFaultCount = externalCases.filter(c => c.remake_fault === 'Lab Fault').length;
  const expertNeeded  = internalCases.filter(l => l.needs_expert).length;

  // Top reasons
  const reasonCounts = externalCases.reduce((acc, c) => {
    const r = (c.remake_reason?.trim() || 'No reason entered').replace(/^\d+\.\s*/, '');
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([reason, count]) => ({ reason, count }));

  // Filtered rows
  const filteredExternal = externalCases.filter(c => {
    const matchSearch = !search || `${c.case_number} ${c.remake_reason} ${c.primary_product}`.toLowerCase().includes(search.toLowerCase());
    const matchFault = filterFault === 'all' || c.remake_fault === filterFault;
    return matchSearch && matchFault;
  });

  const filteredInternal = internalCases.filter(l =>
    !search || `${l.case_number} ${l.department} ${l.logged_by} ${l.description}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const headers = tab === 'external'
      ? ['Case #', 'Date', 'Fault', 'Reason', 'Product', 'Business Unit']
      : ['Case #', 'Date', 'Department', 'Logged By', 'Ship Date', 'Dr Due', 'Expert?', 'Description'];
    const rows = tab === 'external'
      ? filteredExternal.map(r => [r.case_number, r.received_date, r.remake_fault, r.remake_reason?.replace(/^\d+\.\s*/, '') || '', r.primary_product || '', r.business_unit || ''])
      : filteredInternal.map(r => [r.case_number, r.created_date?.slice(0, 10), r.department, r.logged_by, r.ship_date, r.dr_due_date, r.needs_expert ? 'Yes' : 'No', r.description || '']);
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
            }`}>{count}</span>
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
              { label: 'External Remakes',  value: externalCases.length,  icon: RotateCcw,    color: 'text-violet-600 bg-violet-50' },
              { label: 'Internal Remakes',  value: internalCases.length,  icon: Wrench,       color: 'text-blue-600 bg-blue-50'    },
              { label: 'Expert Needed',     value: expertNeeded,          icon: UserCheck,    color: 'text-amber-600 bg-amber-50'  },
              { label: 'Lab Fault',         value: labFaultCount,         icon: AlertTriangle, color: 'text-rose-600 bg-rose-50'   },
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
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyRate} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214,32%,91%)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                        <Line dataKey="Remakes" stroke="hsl(0,84%,60%)" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top Remake Reasons</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-52">
                    {topReasons.length === 0
                      ? <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data yet</div>
                      : <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topReasons} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(214,32%,91%)" />
                            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                            <YAxis type="category" dataKey="reason" tick={{ fontSize: 10 }} width={120} />
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
                  ? `External Remake Cases — ${filteredExternal.length} cases`
                  : `Internal Remake Cases — ${filteredInternal.length} cases`
                }
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={tab === 'external' ? 'Search case, reason, product…' : 'Search case, dept, logged by…'}
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
                          <TableHead className="font-semibold">Date</TableHead>
                          <TableHead className="font-semibold">Fault</TableHead>
                          <TableHead className="font-semibold">Reason</TableHead>
                          <TableHead className="font-semibold">Product</TableHead>
                          <TableHead className="font-semibold">Business Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExternal.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No external remakes found</TableCell></TableRow>
                        )}
                        {filteredExternal.slice(0, 200).map((c, i) => (
                          <TableRow key={i} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-sm font-semibold">{c.case_number}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {c.received_date ? format(parseISO(c.received_date), 'MMM d, yyyy') : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={FAULT_STYLES[c.remake_fault] || 'bg-slate-50 text-slate-600 border-slate-200'}>
                                {c.remake_fault || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[280px] truncate">
                              {c.remake_reason?.replace(/^\d+\.\s*/, '') || <span className="italic opacity-40">No reason entered</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.primary_product || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.business_unit || 'Crown & Bridge'}</TableCell>
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
                          <TableHead className="font-semibold">Logged By</TableHead>
                          <TableHead className="font-semibold">Ship Date</TableHead>
                          <TableHead className="font-semibold">Dr Due</TableHead>
                          <TableHead className="font-semibold">Expert?</TableHead>
                          <TableHead className="font-semibold">Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInternal.length === 0 && (
                          <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No internal remakes found</TableCell></TableRow>
                        )}
                        {filteredInternal.slice(0, 200).map((l, i) => (
                          <TableRow key={i} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedInternal(l)}>
                            <TableCell className="font-mono text-sm font-semibold">{l.case_number}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {l.created_date ? format(parseISO(l.created_date), 'MMM d, yyyy') : '—'}
                            </TableCell>
                            <TableCell className="text-sm">{l.department || '—'}</TableCell>
                            <TableCell className="text-sm font-medium">{l.logged_by || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {l.ship_date ? format(parseISO(l.ship_date), 'MMM d') : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {l.dr_due_date ? format(parseISO(l.dr_due_date), 'MMM d') : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={l.needs_expert
                                ? 'bg-violet-50 text-violet-700 border-violet-200 text-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 text-xs'
                              }>
                                {l.needs_expert ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {l.description || '—'}
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

      {selectedInternal && <InternalRemakePanel entry={selectedInternal} onClose={() => setSelectedInternal(null)} />}
    </div>
  );
}
