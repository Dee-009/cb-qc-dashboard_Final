import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, Download, AlertTriangle, MessageSquare, X } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

// CB Business Unit in Cases table = 'Restorative'
const CB_BUSINESS_UNIT = 'Restorative';

function classifyComplaint(subject, noteText) {
  const s = (subject || '').toLowerCase();
  const t = (noteText || '').toLowerCase();
  if (s.includes('shipping') || s.includes('delivery') || s.includes('late') || t.includes('fedex') || t.includes('shipped')) return 'Late / Shipping';
  if (s.includes('shade') || t.includes('shade') || t.includes('color') || t.includes('colour')) return 'Shade / Aesthetics';
  if (s.includes('fit') || t.includes('occlusion') || t.includes('fit') || t.includes('seat')) return 'Fit Issue';
  if (s.includes('margin') || t.includes('margin')) return 'Margin Issue';
  if (s.includes('fracture') || t.includes('fracture') || t.includes('broke') || t.includes('chip')) return 'Breakage / Fracture';
  if (s.includes('design') || t.includes('design')) return 'Design Issue';
  if (s.includes('rx') || t.includes('rx not followed') || t.includes('rx wasn')) return 'Rx Not Followed';
  if (s.includes('wrong office') || t.includes('wrong office')) return 'Wrong Delivery';
  if (t.includes('contact') || t.includes('occlusal')) return 'Contacts / Occlusion';
  if (s.includes('not entered') || t.includes('never entered') || t.includes('not put into production')) return 'Not Entered';
  if (t.includes('cement') || t.includes('debond')) return 'Cementation / Debond';
  return 'Other';
}

const CATEGORY_STYLES = {
  'Late / Shipping':      'bg-amber-50 text-amber-700 border-amber-200',
  'Shade / Aesthetics':   'bg-pink-50 text-pink-700 border-pink-200',
  'Fit Issue':            'bg-teal-50 text-teal-700 border-teal-200',
  'Margin Issue':         'bg-orange-50 text-orange-700 border-orange-200',
  'Breakage / Fracture':  'bg-stone-50 text-stone-700 border-stone-200',
  'Design Issue':         'bg-violet-50 text-violet-700 border-violet-200',
  'Rx Not Followed':      'bg-rose-50 text-rose-700 border-rose-200',
  'Wrong Delivery':       'bg-red-50 text-red-700 border-red-200',
  'Contacts / Occlusion': 'bg-sky-50 text-sky-700 border-sky-200',
  'Not Entered':          'bg-red-50 text-red-700 border-red-200',
  'Cementation / Debond': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Other':                'bg-slate-50 text-slate-600 border-slate-200',
};

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ complaint, onClose }) {
  if (!complaint) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Customer Complaint — Crown &amp; Bridge</p>
            <h3 className="text-xl font-bold font-mono">{complaint.case_number}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {complaint.created_date ? format(parseISO(complaint.created_date), 'EEEE, MMM d yyyy · h:mm a') : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted ml-4">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Category</p>
              <Badge variant="outline" className={`text-xs ${CATEGORY_STYLES[complaint.category] || CATEGORY_STYLES['Other']}`}>
                {complaint.category}
              </Badge>
            </div>
            <div className="p-3 rounded-xl border bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Logged By</p>
              <p className="text-sm font-medium">{(complaint.logged_by || '').replace('OC-', '')}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Subject</p>
            <p className="text-sm font-medium">{complaint.subject || '—'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Product</p>
              <p className="text-sm text-muted-foreground">{complaint.product || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Doctor Due</p>
              <p className="text-sm text-muted-foreground">
                {complaint.doctor_due ? format(parseISO(complaint.doctor_due), 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Note</p>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {(complaint.note_text || '').split('==================================================')[0].trim()}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerComplaints() {
  const [dateRange, setDateRange]       = useState('30');
  const [search, setSearch]             = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selected, setSelected]         = useState(null);

  const dateFrom = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');

  // Fetch complaints — get all notes first, then filter by Restorative BU
  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['cb_complaints', dateRange],
    queryFn: async () => {
      // Fetch complaint notes in date range (no BU filter yet)
      const { data: notes, error } = await supabase
        .from('Case Notes')
        .select('"Case Number", "Note User Full Name", "Subject", "Note Text", "Created Date"')
        .ilike('Subject', '%complaint%')
        .gte('Created Date', dateFrom)
        .order('Created Date', { ascending: false })
        .limit(2000);
      if (error) throw error;
      if (!notes?.length) return [];

      // Get unique case numbers from notes
      const caseNums = [...new Set(notes.map(n => n['Case Number']))];

      // Fetch case metadata in batches of 500
      const batchSize = 500;
      const allCases = [];
      for (let i = 0; i < caseNums.length; i += batchSize) {
        const batch = caseNums.slice(i, i + batchSize);
        const { data: batchData } = await supabase
          .from('Cases')
          .select('"Case Number", "Business Unit", "Primary Product", "Doctor Due Date"')
          .in('Case Number', batch)
          .eq('Business Unit', CB_BUSINESS_UNIT);
        if (batchData) allCases.push(...batchData);
      }

      const caseMap = {};
      allCases.forEach(c => { caseMap[c['Case Number']] = c; });

      // Filter to CB only and enrich
      return notes
        .filter(r => caseMap[r['Case Number']])
        .map(r => ({
          case_number:  r['Case Number'],
          logged_by:    r['Note User Full Name'],
          subject:      r['Subject'],
          note_text:    r['Note Text'],
          created_date: r['Created Date'],
          product:      caseMap[r['Case Number']]?.['Primary Product'] || null,
          doctor_due:   caseMap[r['Case Number']]?.['Doctor Due Date'] || null,
          category:     classifyComplaint(r['Subject'], r['Note Text']),
        }));
    },
  });

  // Stats
  const categoryCounts = complaints.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category: category.length > 18 ? category.slice(0, 18) + '…' : category,
      count, full: category,
    }));
  const allCategories = Object.keys(categoryCounts).sort();

  // Filter
  const filtered = complaints.filter(c => {
    const matchSearch = !search ||
      (c.case_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.subject || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.logged_by || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.note_text || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || c.category === filterCategory;
    return matchSearch && matchCat;
  });

  const handleExport = () => {
    const headers = ['Case #', 'Date', 'Category', 'Subject', 'Logged By', 'Product', 'Note'];
    const rows = filtered.map(c => [
      c.case_number, c.created_date?.slice(0, 10), c.category, c.subject,
      (c.logged_by || '').replace('OC-', ''), c.product || '',
      (c.note_text || '').split('===')[0].trim().replace(/\n/g, ' '),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `complaints-cb-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Customer Complaints — Crown &amp; Bridge</h2>
          <p className="text-sm text-muted-foreground">Complaints logged in ABS case notes · Restorative BU</p>
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
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>
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
              { label: 'Total Complaints',    value: complaints.length,                         color: 'text-rose-600 bg-rose-50'     },
              { label: 'Shade / Aesthetics',  value: categoryCounts['Shade / Aesthetics'] || 0, color: 'text-pink-600 bg-pink-50'     },
              { label: 'Fit Issues',          value: categoryCounts['Fit Issue'] || 0,           color: 'text-teal-600 bg-teal-50'     },
              { label: 'Rx Not Followed',     value: categoryCounts['Rx Not Followed'] || 0,    color: 'text-rose-700 bg-rose-100'    },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${color}`}><AlertTriangle className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Complaints by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                {chartData.length === 0
                  ? <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No complaints in this period</div>
                  : <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(214,32%,91%)" />
                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={130} />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                          formatter={(v, n, p) => [v, p.payload.full || n]}
                        />
                        <Bar dataKey="count" fill="#E24B4A" radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                }
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                All Complaints — {complaints.length} total · Click to view full note
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search case, subject, note…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Case #</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Category</TableHead>
                      <TableHead className="font-semibold">Subject</TableHead>
                      <TableHead className="font-semibold">Logged By</TableHead>
                      <TableHead className="font-semibold">Product</TableHead>
                      <TableHead className="font-semibold">Note Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          No complaints found
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((c, i) => (
                      <TableRow key={i} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                        <TableCell className="font-mono text-sm font-semibold">{c.case_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {c.created_date ? format(parseISO(c.created_date), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${CATEGORY_STYLES[c.category] || CATEGORY_STYLES['Other']}`}>
                            {c.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{c.subject || '—'}</TableCell>
                        <TableCell className="text-sm">{(c.logged_by || '').replace('OC-', '')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{c.product || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                          {(c.note_text || '').split('===')[0].trim().slice(0, 100)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selected && <DetailPanel complaint={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
