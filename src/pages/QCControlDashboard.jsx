import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QCLog, supabase } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LogDetailPanel } from '@/components/qc/LogDetailPanel';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ComposedChart, Line, Cell, LineChart, Legend
} from 'recharts';
import { format, parseISO, subDays, isAfter } from 'date-fns';
import { AlertTriangle, CheckCircle, TrendingUp, Users, RotateCcw, Wrench, ClipboardList, Target } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function filterByRange(logs, range) {
  if (range === 'all') return logs;
  if (range.startsWith('day-')) {
    const n = parseInt(range.replace('day-', ''));
    const s = subDays(new Date(), n); s.setHours(0,0,0,0);
    const e = subDays(new Date(), n); e.setHours(23,59,59,999);
    return logs.filter(l => l.time_stamp && parseISO(l.time_stamp) >= s && parseISO(l.time_stamp) <= e);
  }
  const cutoff = subDays(new Date(), parseInt(range));
  return logs.filter(l => l.time_stamp && isAfter(parseISO(l.time_stamp), cutoff));
}

const TEAM_COLORS = {
  PMMA: '#6366f1', Zirconia: '#06b6d4', Bars: '#f59e0b',
  Design: '#8b5cf6', Milling: '#10b981', Printing: '#f43f5e',
  Scanning: '#3b82f6', 'Place Parts': '#ec4899', 'Case Entry': '#84cc16',
  'Case Review': '#14b8a6', 'Design QC': '#a855f7', 'Design Adjustments': '#f97316',
  'Case Coordination': '#64748b', 'Shape and Colorize': '#d946ef',
};
const URGENCY_COLOR = { 'ASAP(Same day)': '#ef4444', 'Repair': '#f59e0b', 'Next Day': '#3b82f6', 'Remake': '#8b5cf6', 'Internal Remake': '#6366f1' };

const DATE_OPTIONS = [
  { label: 'Today', value: 'day-0' }, { label: 'Yesterday', value: 'day-1' },
  { label: 'Last 7 days', value: '7' }, { label: 'Last 14 days', value: '14' },
  { label: 'Last 30 days', value: '30' }, { label: 'Last 90 days', value: '90' },
  { label: 'All time', value: 'all' },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function QCControlDashboard() {
  const [dateRange, setDateRange] = useState('30');
  const [teamFilter, setTeamFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const queryClient = useQueryClient();

  const { data: allLogs = [], isLoading } = useQuery({
    queryKey: ['qclogs'],
    queryFn: () => QCLog.list('-time_stamp', 5000),
  });
  useEffect(() => {
    const unsub = QCLog.subscribe(() => queryClient.invalidateQueries({ queryKey: ['qclogs'] }));
    return () => unsub();
  }, [queryClient]);

  const { data: mrbCases = [] } = useQuery({
    queryKey: ['mrb_cases_qc'],
    queryFn: async () => {
      const { data } = await supabase.from('cb_mrb_cases').select('case_number, severity, status, team, defect_description, opened_date').neq('status', 'Closed');
      return data ?? [];
    },
  });

  const { data: externalRemakes = [] } = useQuery({
    queryKey: ['ext_remakes_qc', dateRange],
    queryFn: async () => {
      const cutoff = dateRange === 'all' ? '2000-01-01' : format(subDays(new Date(), parseInt(dateRange.replace('day-','0'))||30), 'yyyy-MM-dd');
      const { data } = await supabase.from('cases_remake').select('case_number, remake_fault, remake_reason, received_date').eq('business_unit','Crown & Bridge').gte('received_date', cutoff);
      return data ?? [];
    },
  });

  // Filtered logs
  const dated = filterByRange(allLogs, dateRange);
  const logs = teamFilter === 'all' ? dated : dated.filter(l => l.team === teamFilter);

  const teams = [...new Set(allLogs.map(l => l.team).filter(Boolean))].sort();

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalReworks = logs.length;
  const asapCount = logs.filter(l => l.qc_reject === 'ASAP(Same day)').length;
  const remakeCount = logs.filter(l => l.qc_reject === 'Remake' || l.qc_reject === 'Internal Remake').length;
  const uniqueCases = new Set(logs.map(l => l.case_number)).size;
  const repeatCaseMap = logs.reduce((acc, l) => { if (l.case_number) acc[l.case_number] = (acc[l.case_number]||0)+1; return acc; }, {});
  const repeatCases = Object.entries(repeatCaseMap).filter(([,c])=>c>1).sort((a,b)=>b[1]-a[1]);
  const criticalMrb = mrbCases.filter(c => c.severity === 'Critical').length;

  // ── Team breakdown ─────────────────────────────────────────────────────────
  const teamStats = teams.map(team => {
    const t = logs.filter(l => l.team === team);
    return {
      team: team.length > 14 ? team.slice(0,14)+'…' : team,
      fullTeam: team,
      total: t.length,
      asap: t.filter(l => l.qc_reject === 'ASAP(Same day)').length,
      repair: t.filter(l => l.qc_reject === 'Repair').length,
      nextDay: t.filter(l => l.qc_reject === 'Next Day').length,
      remake: t.filter(l => l.qc_reject === 'Remake' || l.qc_reject === 'Internal Remake').length,
    };
  }).filter(t => t.total > 0).sort((a,b) => b.total - a.total);

  // ── Defect type breakdown ──────────────────────────────────────────────────
  const defectMap = logs.reduce((acc, l) => {
    const key = l.reject_type || 'Unknown';
    acc[key] = (acc[key]||0)+1;
    return acc;
  }, {});
  const defectData = Object.entries(defectMap).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,count])=>({ name: name.length>28?name.slice(0,28)+'…':name, full: name, count }));
  const totalDefects = defectData.reduce((s,d)=>s+d.count,0);
  let cumulative = 0;
  const paretoData = defectData.map(d => {
    cumulative += d.count;
    return { ...d, cumPct: Math.round(cumulative/totalDefects*100) };
  });

  // ── Technician hotspot ─────────────────────────────────────────────────────
  const techMap = logs.reduce((acc, l) => {
    if (!l.technician) return acc;
    if (!acc[l.technician]) acc[l.technician] = { name: l.technician, team: l.team, total: 0, asap: 0, remake: 0, types: {} };
    acc[l.technician].total++;
    if (l.qc_reject === 'ASAP(Same day)') acc[l.technician].asap++;
    if (l.qc_reject === 'Remake' || l.qc_reject === 'Internal Remake') acc[l.technician].remake++;
    const type = l.reject_type || 'Unknown';
    acc[l.technician].types[type] = (acc[l.technician].types[type]||0)+1;
    return acc;
  }, {});
  const techData = Object.values(techMap).sort((a,b)=>b.total-a.total).slice(0,10);

  // ── Daily trend (last 14 days) ─────────────────────────────────────────────
  const trendData = Array.from({length:14},(_,i)=>{
    const d = subDays(new Date(),13-i);
    const label = format(d,'MMM d');
    const dayLogs = allLogs.filter(l => l.time_stamp && format(parseISO(l.time_stamp),'MMM d')===label && (teamFilter==='all'||l.team===teamFilter));
    return {
      date: label,
      ASAP: dayLogs.filter(l=>l.qc_reject==='ASAP(Same day)').length,
      Repair: dayLogs.filter(l=>l.qc_reject==='Repair').length,
      'Next Day': dayLogs.filter(l=>l.qc_reject==='Next Day').length,
      Remake: dayLogs.filter(l=>l.qc_reject==='Remake'||l.qc_reject==='Internal Remake').length,
    };
  });

  // ── Cross-reference: rework cases that escalated to MRB ───────────────────
  const reworkCaseNums = new Set(logs.map(l => l.case_number));
  const escalated = mrbCases.filter(c => reworkCaseNums.has(c.case_number));

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/></div>;

  return (
    <>
    <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">QC Control</h2>
          <p className="text-sm text-muted-foreground">Quality analysis — rework trends, defect patterns & escalations</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Teams"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36"><SelectValue/></SelectTrigger>
            <SelectContent>{DATE_OPTIONS.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"/>Live
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total Reworks', value:totalReworks, icon:ClipboardList, color:'bg-primary/10 text-primary', sub:`${uniqueCases} unique cases` },
          { label:'ASAP Same Day', value:asapCount, icon:AlertTriangle, color:'bg-rose-50 text-rose-600', sub:`${totalReworks?Math.round(asapCount/totalReworks*100):0}% of reworks` },
          { label:'Remakes', value:remakeCount, icon:RotateCcw, color:'bg-violet-50 text-violet-600', sub:'Remake + Internal' },
          { label:'Active MRB Cases', value:mrbCases.length, icon:Target, color:criticalMrb>0?'bg-rose-50 text-rose-600':'bg-amber-50 text-amber-600', sub:`${criticalMrb} critical` },
        ].map(({label,value,icon:Icon,color,sub})=>(
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl shrink-0 ${color}`}><Icon className="w-5 h-5"/></div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Team Performance ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4"/> Reworks by Team — Urgency Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teamStats.length === 0 ? <p className="text-center text-muted-foreground py-8">No data for this period</p> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamStats} margin={{top:5,right:20,bottom:5,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214,32%,91%)"/>
                  <XAxis dataKey="team" tick={{fontSize:11}}/>
                  <YAxis tick={{fontSize:11}} allowDecimals={false}/>
                  <Tooltip contentStyle={{borderRadius:12,border:'none',boxShadow:'0 4px 20px rgba(0,0,0,0.08)'}}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11}}/>
                  <Bar dataKey="asap" name="ASAP" stackId="a" fill="#ef4444" radius={[0,0,0,0]}/>
                  <Bar dataKey="repair" name="Repair" stackId="a" fill="#f59e0b"/>
                  <Bar dataKey="nextDay" name="Next Day" stackId="a" fill="#3b82f6"/>
                  <Bar dataKey="remake" name="Remake" stackId="a" fill="#8b5cf6" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Team summary table */}
          {teamStats.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Team</TableHead>
                    <TableHead className="font-semibold text-right">Total</TableHead>
                    <TableHead className="font-semibold text-right">ASAP</TableHead>
                    <TableHead className="font-semibold text-right">Repair</TableHead>
                    <TableHead className="font-semibold text-right">Next Day</TableHead>
                    <TableHead className="font-semibold text-right">Remake</TableHead>
                    <TableHead className="font-semibold">Urgency Mix</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamStats.map(t=>(
                    <TableRow key={t.fullTeam} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{t.fullTeam}</TableCell>
                      <TableCell className="text-right font-bold">{t.total}</TableCell>
                      <TableCell className="text-right"><span className="text-rose-600 font-medium">{t.asap}</span></TableCell>
                      <TableCell className="text-right"><span className="text-amber-600 font-medium">{t.repair}</span></TableCell>
                      <TableCell className="text-right"><span className="text-blue-600 font-medium">{t.nextDay}</span></TableCell>
                      <TableCell className="text-right"><span className="text-violet-600 font-medium">{t.remake}</span></TableCell>
                      <TableCell>
                        <div className="flex h-2 rounded-full overflow-hidden w-24 bg-muted">
                          {t.asap>0&&<div className="bg-rose-500" style={{width:`${t.asap/t.total*100}%`}}/>}
                          {t.repair>0&&<div className="bg-amber-500" style={{width:`${t.repair/t.total*100}%`}}/>}
                          {t.nextDay>0&&<div className="bg-blue-500" style={{width:`${t.nextDay/t.total*100}%`}}/>}
                          {t.remake>0&&<div className="bg-violet-500" style={{width:`${t.remake/t.total*100}%`}}/>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Defect Pareto + Daily Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pareto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top Defect Types — Pareto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData} margin={{top:5,right:30,bottom:40,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214,32%,91%)"/>
                  <XAxis dataKey="name" tick={{fontSize:9}} angle={-35} textAnchor="end" interval={0} height={60}/>
                  <YAxis yAxisId="left" tick={{fontSize:11}} allowDecimals={false}/>
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize:11}} unit="%" domain={[0,100]}/>
                  <Tooltip contentStyle={{borderRadius:12,border:'none',boxShadow:'0 4px 20px rgba(0,0,0,0.08)'}} formatter={(val,name)=>name==='Cumulative %'?`${val}%`:val}/>
                  <Bar yAxisId="left" dataKey="count" name="Count" fill="#6366f1" radius={[4,4,0,0]} barSize={18}/>
                  <Line yAxisId="right" type="monotone" dataKey="cumPct" name="Cumulative %" stroke="#ef4444" strokeWidth={2} dot={{r:3}}/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* 80% rule callout */}
            {paretoData.length > 0 && (
              <div className="mt-3 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚡ Top {paretoData.findIndex(d=>d.cumPct>=80)+1} defect type(s) account for 80%+ of reworks — focus corrective action here first.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4"/> Daily Rework Trend — Last 14 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{top:5,right:10,bottom:5,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214,32%,91%)"/>
                  <XAxis dataKey="date" tick={{fontSize:10}} angle={-30} textAnchor="end" height={40}/>
                  <YAxis tick={{fontSize:11}} allowDecimals={false}/>
                  <Tooltip contentStyle={{borderRadius:12,border:'none',boxShadow:'0 4px 20px rgba(0,0,0,0.08)'}}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11}}/>
                  <Bar dataKey="ASAP" stackId="a" fill="#ef4444"/>
                  <Bar dataKey="Repair" stackId="a" fill="#f59e0b"/>
                  <Bar dataKey="Next Day" stackId="a" fill="#3b82f6"/>
                  <Bar dataKey="Remake" stackId="a" fill="#8b5cf6" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Technician Hotspot + Repeat Cases ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Technician table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4"/> Technician Rework Hotspot
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Technician</TableHead>
                  <TableHead className="font-semibold">Team</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold text-right">ASAP</TableHead>
                  <TableHead className="font-semibold text-right">Remake</TableHead>
                  <TableHead className="font-semibold">Top Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {techData.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>}
                {techData.map(t=>{
                  const topType = Object.entries(t.types).sort((a,b)=>b[1]-a[1])[0];
                  return (
                    <TableRow key={t.name} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">{t.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs" style={{borderColor:TEAM_COLORS[t.team]+'40',color:TEAM_COLORS[t.team]}}>{t.team}</Badge></TableCell>
                      <TableCell className="text-right font-bold">{t.total}</TableCell>
                      <TableCell className="text-right text-rose-600 font-medium">{t.asap}</TableCell>
                      <TableCell className="text-right text-violet-600 font-medium">{t.remake}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{topType?`${topType[0]} (${topType[1]})`:'—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Repeat cases */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <RotateCcw className="w-4 h-4"/> Repeat Rework Cases
            </CardTitle>
            <p className="text-xs text-muted-foreground">Cases logged more than once — may need escalation to MRB</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-72 overflow-y-auto">
              {repeatCases.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400"/>
                  <p className="text-sm font-medium">No repeat cases</p>
                  <p className="text-xs">All cases logged once in this period</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Case #</TableHead>
                      <TableHead className="font-semibold">Times</TableHead>
                      <TableHead className="font-semibold">Team</TableHead>
                      <TableHead className="font-semibold">In MRB?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repeatCases.slice(0,10).map(([caseNum, count])=>{
                      const log = logs.find(l=>l.case_number===caseNum);
                      const inMrb = mrbCases.some(m=>m.case_number===caseNum);
                      return (
                        <TableRow key={caseNum} className="hover:bg-muted/30 cursor-pointer" onClick={()=>setSelectedLog(log)}>
                          <TableCell className="font-mono text-sm font-bold">{caseNum}</TableCell>
                          <TableCell><Badge variant="outline" className={count>=3?'bg-rose-50 text-rose-700 border-rose-200':'bg-amber-50 text-amber-700 border-amber-200'}>{count}×</Badge></TableCell>
                          <TableCell className="text-sm">{log?.team||'—'}</TableCell>
                          <TableCell>
                            {inMrb ? <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">In MRB</Badge>
                            : <span className="text-xs text-muted-foreground">No</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Escalation Watchlist: Reworks → MRB ── */}
      {escalated.length > 0 && (
        <Card className="border-rose-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600"/> Escalation Watchlist — Cases in Both Rework Log & MRB
            </CardTitle>
            <p className="text-xs text-muted-foreground">These cases were reworked AND escalated to the MRB Board — high priority for corrective action</p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-rose-50/50">
                  <TableHead className="font-semibold">Case #</TableHead>
                  <TableHead className="font-semibold">Severity</TableHead>
                  <TableHead className="font-semibold">MRB Status</TableHead>
                  <TableHead className="font-semibold">Team</TableHead>
                  <TableHead className="font-semibold">Defect</TableHead>
                  <TableHead className="font-semibold">Rework Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalated.map(c=>(
                  <TableRow key={c.case_number} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm font-bold">{c.case_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={c.severity==='Critical'?'bg-rose-50 text-rose-700 border-rose-300':c.severity==='Major'?'bg-amber-50 text-amber-700 border-amber-300':'bg-sky-50 text-sky-700 border-sky-200'}>{c.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={c.status==='Open'?'bg-rose-50 text-rose-700 border-rose-200':'bg-amber-50 text-amber-700 border-amber-200'}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.team||'—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.defect_description||'—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">{repeatCaseMap[c.case_number]||1}×</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── External Remake Cross-Reference ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Wrench className="w-4 h-4"/> External Remakes — Lab Fault Analysis
          </CardTitle>
          <p className="text-xs text-muted-foreground">Cases returned by doctors — Crown & Bridge (from ABS)</p>
        </CardHeader>
        <CardContent>
          {externalRemakes.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No external remakes in this period</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fault split */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fault Split</p>
                {(() => {
                  const faults = externalRemakes.reduce((acc,c)=>{ acc[c.remake_fault||'Unknown']=(acc[c.remake_fault||'Unknown']||0)+1; return acc; },{});
                  const total = externalRemakes.length;
                  const colors = {'Lab Fault':'#ef4444','Doctor Fault':'#f59e0b','Nobody\'s Fault':'#3b82f6','Unknown':'#94a3b8'};
                  return Object.entries(faults).sort((a,b)=>b[1]-a[1]).map(([fault,count])=>(
                    <div key={fault} className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{fault}</span>
                        <span className="text-muted-foreground">{count} ({Math.round(count/total*100)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${count/total*100}%`,background:colors[fault]||'#94a3b8'}}/>
                      </div>
                    </div>
                  ));
                })()}
              </div>
              {/* Top reasons */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Remake Reasons</p>
                {(() => {
                  const reasons = externalRemakes.reduce((acc,c)=>{ const r=(c.remake_reason||'No reason').trim()||'No reason'; acc[r]=(acc[r]||0)+1; return acc; },{});
                  return Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([reason,count])=>(
                    <div key={reason} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">{reason}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{count}</Badge>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
    {selectedLog && <LogDetailPanel log={selectedLog} onClose={()=>setSelectedLog(null)}/>}
    </>
  );
}
