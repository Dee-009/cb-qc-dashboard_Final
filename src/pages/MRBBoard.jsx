import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, X, CheckCircle, Clock, AlertTriangle, ClipboardList, ChevronDown, ChevronUp, Save, Trash2, UserCheck, Bell } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { InternalRemakeDashboard } from '@/components/mrb/InternalRemakeDashboard';

const SEVERITIES = ['Critical', 'Major', 'Minor'];
const STATUSES = ['Open', 'Under Review', 'Disposition Set', 'Closed'];
const DISPOSITIONS = ['Pending', 'Rework', 'Remake', 'Scrap', 'Use As-Is', 'Return to Vendor'];

const SEVERITY_STYLES = {
  Critical: 'bg-rose-50 text-rose-700 border-rose-300',
  Major:    'bg-amber-50 text-amber-700 border-amber-300',
  Minor:    'bg-sky-50 text-sky-700 border-sky-200',
};
const STATUS_STYLES = {
  'Open':            'bg-rose-50 text-rose-700 border-rose-200',
  'Under Review':    'bg-amber-50 text-amber-700 border-amber-200',
  'Disposition Set': 'bg-blue-50 text-blue-700 border-blue-200',
  'Closed':          'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const DISPOSITION_STYLES = {
  'Rework':           'bg-sky-50 text-sky-700 border-sky-200',
  'Remake':           'bg-violet-50 text-violet-700 border-violet-200',
  'Scrap':            'bg-rose-50 text-rose-700 border-rose-200',
  'Use As-Is':        'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Return to Vendor': 'bg-amber-50 text-amber-700 border-amber-200',
  'Pending':          'bg-slate-50 text-slate-600 border-slate-200',
};

const EMPTY_FORM = {
  case_number: '', source: 'external', business_unit: 'Crown & Bridge',
  product: '', team: '', technician: '', defect_description: '',
  reject_type: '', fault: 'Lab Fault', severity: 'Major',
  reviewed_by: '', root_cause: '', corrective_action: '',
  disposition: 'Pending', disposition_notes: '',
  opened_date: format(new Date(), 'yyyy-MM-dd'),
};

// ── EXPERTS (all 3) ───────────────────────────────────────────────────────────
const EXPERTS = [
  { name: 'Jeannette Rubio', email: 'jeannette.rubio@skdla.com', specialty: 'Implantology / All Depts' },
  { name: 'Ryan Okon',       email: 'ryan.okon@skdla.com',       specialty: 'Tech Expert' },
  { name: 'Deepak Polemoni', email: 'deepak.polemoni@skdla.com', specialty: 'Engineering' },
];

const SUPABASE_URL = 'https://asdunkqodixbhbohxtuq.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZHVua3FvZGl4Ymhib2h4dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDUwNTcsImV4cCI6MjA5MDgyMTA1N30.lStrSSEpwFFk5GuXl2qzh2tr6bLZFY4_x9u6q4FcVeo';

// ── Stable helper components (outside all other components) ───────────────────
function urgencyBadge(drDueDate) {
  if (!drDueDate) return null;
  const days = differenceInDays(parseISO(drDueDate), new Date());
  if (days < 0)   return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs">Overdue</Badge>;
  if (days === 0) return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs">Due Today</Badge>;
  if (days <= 2)  return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Due in {days}d</Badge>;
  return null;
}

function sourceBadge(source) {
  const cls = { external:'bg-blue-50 text-blue-700 border-blue-200', internal:'bg-violet-50 text-violet-700 border-violet-200', doctor_complaint:'bg-rose-50 text-rose-700 border-rose-200' };
  const lbl = { external:'External', internal:'Internal', doctor_complaint:'Dr Complaint' };
  return <Badge variant="outline" className={`text-xs ${cls[source]||'bg-slate-50 text-slate-600 border-slate-200'}`}>{lbl[source]||'QC Log'}</Badge>;
}

function ModalField({ label, children }) {
  return <div><label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>{children}</div>;
}

function PanelField({ label, children }) {
  return <div><label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>{children}</div>;
}

function EditableSelect({ value, options, styleMap, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  if (!editing) return <Badge variant="outline" className={`cursor-pointer ${styleMap[value]||'bg-slate-50 text-slate-600 border-slate-200'}`} onClick={() => setEditing(true)}>{value||'—'}</Badge>;
  return <select autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={() => { setEditing(false); onSave(val); }} className="text-xs border rounded px-1 py-0.5 bg-white">{options.map(o=><option key={o} value={o}>{o}</option>)}</select>;
}

function EditableText({ value, onSave, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value||'');
  if (!editing) return <span className="cursor-pointer text-sm text-muted-foreground hover:text-foreground truncate max-w-[180px] block" onClick={() => setEditing(true)} title={value||placeholder}>{value||<span className="italic opacity-40">{placeholder}</span>}</span>;
  return <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={() => { setEditing(false); onSave(val); }} onKeyDown={e => e.key==='Enter' && (setEditing(false), onSave(val))} className="text-sm border rounded px-2 py-0.5 w-full bg-white" />;
}

// ── Add Case Modal ────────────────────────────────────────────────────────────
function AddCaseModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const inputCls = "w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20";
  const selCls = "w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none";
  const handleSave = async () => {
    if (!form.case_number.trim()) { setError('Case number is required'); return; }
    setSaving(true); setError(null);
    try {
      const { error: err } = await supabase.from('cb_mrb_cases').insert([{...form, status:'Open', created_date: new Date().toISOString(), updated_date: new Date().toISOString()}]);
      if (err) throw err;
      onSaved(); onClose();
    } catch(e) { setError(e.message); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div><h3 className="font-bold text-lg">Open MRB Case</h3><p className="text-xs text-muted-foreground">Log a nonconformance for review</p></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-2 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Case Number *"><input className={inputCls} value={form.case_number} onChange={e=>set('case_number',e.target.value)} placeholder="2026-XXXXX" /></ModalField>
            <ModalField label="Source"><select className={selCls} value={form.source} onChange={e=>set('source',e.target.value)}><option value="external">External (ABS)</option><option value="internal">Internal (QC App)</option><option value="doctor_complaint">Doctor Complaint</option><option value="qc_log">QC Log</option></select></ModalField>
            <ModalField label="Severity"><select className={selCls} value={form.severity} onChange={e=>set('severity',e.target.value)}>{SEVERITIES.map(s=><option key={s}>{s}</option>)}</select></ModalField>
            <ModalField label="Fault"><select className={selCls} value={form.fault} onChange={e=>set('fault',e.target.value)}><option>Lab Fault</option><option>Doctor Fault</option><option>Nobody's Fault</option></select></ModalField>
            <ModalField label="Team / Department"><input className={inputCls} value={form.team} onChange={e=>set('team',e.target.value)} placeholder="e.g. Design, Zirconia" /></ModalField>
            <ModalField label="Technician"><input className={inputCls} value={form.technician} onChange={e=>set('technician',e.target.value)} placeholder="Technician name" /></ModalField>
            <ModalField label="Product"><input className={inputCls} value={form.product} onChange={e=>set('product',e.target.value)} placeholder="e.g. Final Zirconia" /></ModalField>
            <ModalField label="Opened Date"><input type="date" className={inputCls} value={form.opened_date} onChange={e=>set('opened_date',e.target.value)} /></ModalField>
          </div>
          <ModalField label="Defect Description"><textarea className={inputCls} rows={3} value={form.defect_description} onChange={e=>set('defect_description',e.target.value)} placeholder="Describe the defect or nonconformance…" /></ModalField>
          <ModalField label="Root Cause"><textarea className={inputCls} rows={2} value={form.root_cause} onChange={e=>set('root_cause',e.target.value)} placeholder="Why did this happen?" /></ModalField>
          <ModalField label="Initial Disposition"><select className={selCls} value={form.disposition} onChange={e=>set('disposition',e.target.value)}>{DISPOSITIONS.map(d=><option key={d}>{d}</option>)}</select></ModalField>
          <ModalField label="Reviewed By"><input className={inputCls} value={form.reviewed_by} onChange={e=>set('reviewed_by',e.target.value)} placeholder="Reviewer name" /></ModalField>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2"><Save className="w-4 h-4" />{saving?'Saving…':'Open MRB Case'}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Stage Modal ───────────────────────────────────────────────────────────────
function StageModal({ caseNumber, onClose, onSaved }) {
  const [form, setForm] = useState({ dr_due_date: '', department: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const inputCls = "w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20";
  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const { error: dbErr } = await supabase.from('cb_staged_cases').insert([{
        case_number: caseNumber, dr_due_date: form.dr_due_date||null, department: form.department||null,
        assigned_expert: null, assigned_expert_email: null, status: 'Pending',
        staged_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }]);
      if (dbErr) throw dbErr;
      EXPERTS.forEach(ex => {
        fetch(`${SUPABASE_URL}/functions/v1/notify-expert-staged`, {
          method:'POST', headers:{'Content-Type':'application/json','apikey':ANON_KEY,'Authorization':`Bearer ${ANON_KEY}`},
          body: JSON.stringify({ case_number: caseNumber, dr_due_date: form.dr_due_date, department: form.department, assigned_expert: ex.name, assigned_expert_email: ex.email }),
        }).catch(()=>{});
      });
      onSaved(); onClose();
    } catch(e) { setError(e.message); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div><h3 className="font-bold">Stage for Expert Review</h3><p className="text-xs text-muted-foreground font-mono">{caseNumber}</p></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-xs">{error}</div>}
          <div><label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Doctor Due Date</label><input type="date" className={inputCls} value={form.dr_due_date} onChange={e=>set('dr_due_date',e.target.value)} /></div>
          <div><label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Department</label><input className={inputCls} value={form.department} onChange={e=>set('department',e.target.value)} placeholder="e.g. Design, Zirconia" /></div>
          <p className="text-xs text-muted-foreground">All 3 tech experts will be notified. They self-assign by claiming the case.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5"><Bell className="w-3.5 h-3.5" />{saving?'Staging…':'Notify Experts'}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Case Detail Panel ─────────────────────────────────────────────────────────
function CaseDetailPanel({ c, onClose, onUpdate }) {
  const isClosed = c.status === 'Closed';
  const [form, setForm] = useState({
    case_number: c.case_number||'', source: c.source||'external', severity: c.severity||'Major',
    fault: c.fault||'Lab Fault', team: c.team||'', technician: c.technician||'',
    product: c.product||'', opened_date: c.opened_date||format(new Date(),'yyyy-MM-dd'),
    defect_description: c.defect_description||'', root_cause: c.root_cause||'',
    corrective_action: c.corrective_action||'', disposition: c.disposition||'Pending',
    disposition_notes: c.disposition_notes||'', status: c.status||'Open',
    reviewed_by: c.reviewed_by||'', dr_notes: c.dr_notes||'', source_step: c.source_step||'',
    interim_fix: c.interim_fix||'',
    reroute_step: c.reroute_step||'', reroute_days: c.reroute_days||'',
    date_reschedule: c.date_reschedule||false, reschedule_days: c.reschedule_days||'',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [absInfo, setAbsInfo] = useState(null);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const [caseSteps, setCaseSteps] = useState([]);

  // Auto-fetch ABS case details + step history when panel opens
  useEffect(() => {
    if (!c.case_number) return;
    Promise.all([
      supabase.from('Cases')
        .select('"Case Number","Business Unit","Primary Product","Doctor Due Date","Ship Date","Received Date","Hold Flag","Hold Reason"')
        .eq('Case Number', c.case_number)
        .maybeSingle(),
      supabase.from('wip_cases')
        .select('current_step_name, current_step_business_unit')
        .eq('case_number', c.case_number)
        .maybeSingle(),
      supabase.from('case_steps_dept_aox')
        .select('step, step_consolidated, start_date, finish_date, status')
        .eq('case_number', c.case_number)
        .order('start_date', { ascending: true }),
    ]).then(async ([caseRes, wfRes, stepsRes]) => {
      if (caseRes.data) {
        const absData = {
          ...caseRes.data,
          current_step: wfRes.data?.current_step_name || null,
          dept: wfRes.data?.current_step_business_unit || null,
        };
        setAbsInfo(absData);

        // Build this case's completed step map
        const completedMap = {};
        (stepsRes.data || []).forEach(s => {
          const key = s.step_consolidated || s.step;
          let days = 1;
          if (s.start_date && s.finish_date) {
            const diff = (new Date(s.finish_date) - new Date(s.start_date)) / 86400000;
            days = Math.max(1, Math.round(diff)) || 1;
          }
          completedMap[key] = { consolidated: key, days, done: true };
        });

        // Fetch avg inter-step durations for this product type using LEAD calculation
        const product = caseRes.data['Primary Product'];
        const buFilter = caseRes.data['Business Unit'] || 'Crown & Bridge';
        if (product) {
          // Get all steps for similar product, compute avg hours between steps
          const { data: allSteps } = await supabase
            .from('case_steps_dept_aox')
            .select('case_number, step_consolidated, start_date')
            .order('case_number')
            .order('start_date', { ascending: true })
            .limit(3000);

          if (allSteps?.length) {
            // Group by case, compute inter-step hours, then avg per step
            const caseGroups = {};
            allSteps.forEach(s => {
              if (!caseGroups[s.case_number]) caseGroups[s.case_number] = [];
              caseGroups[s.case_number].push(s);
            });

            const stepHours = {}; // step → [hours]
            const stepOrder = {}; // step → earliest position seen
            let pos = 0;
            Object.values(caseGroups).forEach(steps => {
              for (let i = 0; i < steps.length - 1; i++) {
                const key = steps[i].step_consolidated;
                const hrs = (new Date(steps[i+1].start_date) - new Date(steps[i].start_date)) / 3600000;
                if (hrs > 0 && hrs < 336) { // exclude outliers > 14 days
                  if (!stepHours[key]) { stepHours[key] = []; stepOrder[key] = pos++; }
                  stepHours[key].push(hrs);
                }
              }
              // Track last step
              if (steps.length > 0) {
                const lastKey = steps[steps.length-1].step_consolidated;
                if (!stepOrder[lastKey]) stepOrder[lastKey] = pos++;
              }
            });

            // Build ordered step list with avg hours
            const orderedSteps = Object.keys(stepOrder)
              .sort((a,b) => stepOrder[a] - stepOrder[b])
              .map(key => {
                const hrs = stepHours[key] || [];
                const avgHrs = hrs.length ? hrs.reduce((a,b)=>a+b,0)/hrs.length : 8;
                const days = parseFloat(Math.max(0.5, avgHrs/24).toFixed(1));
                return {
                  consolidated: key,
                  hours: parseFloat(avgHrs.toFixed(1)),
                  days,
                  done: !!completedMap[key],
                };
              });

            // For completed steps, use actual hours from THIS case
            const merged = orderedSteps.map(s => ({
              ...s,
              days: completedMap[s.consolidated]?.days || s.days,
              done: !!completedMap[s.consolidated],
            }));

            if (merged.length > 0) {
              setCaseSteps(merged);
              return;
            }
          }
        }

        // Fallback: just use this case's own completed steps
        setCaseSteps(Object.values(completedMap));
      }
    }).catch(() => {});
  }, [c.case_number]);
  const inputCls = `w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 ${isClosed?'opacity-60 cursor-not-allowed':''}`;
  const selCls = `w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none ${isClosed?'opacity-60 cursor-not-allowed':''}`;
  const TEAMS_WEBHOOK = 'https://thedentalalliance.webhook.office.com/webhookb2/742d5b0d-5130-416e-ae9c-0b92f50c6c78@9eeb8be1-6508-41b3-a532-3825109ed502/IncomingWebhook/4edbd68bddfa456fb1326d7c6a2b0271/6ec45b25-de49-4660-af7b-cf136938d7cd/V2rckMY8aPFc4tzd9OK0qKY36y1dvIPhzSEeRbHHY6z7E1';

  const sendTeamsNotification = async (formData) => {
    if (!formData.date_reschedule || !TEAMS_WEBHOOK || TEAMS_WEBHOOK.includes('PASTE')) return;
    const newDue = absInfo?.['Doctor Due Date']
      ? new Date(new Date(absInfo['Doctor Due Date']).getTime() + formData.reschedule_days * 86400000)
          .toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})
      : `+${formData.reschedule_days} days`;
    const payload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": "534AB7",
      "summary": `MRB Date Reschedule — ${c.case_number}`,
      "sections": [{
        "activityTitle": `📅 Date Reschedule Request — ${c.case_number}`,
        "activitySubtitle": `MRB Board · ${formData.team || '—'} · ${formData.reviewed_by || '—'}`,
        "facts": [
          { "name": "Case Number", "value": c.case_number },
          { "name": "Department", "value": formData.team || '—' },
          { "name": "Technician", "value": formData.technician || '—' },
          { "name": "Reschedule Days", "value": `${formData.reschedule_days} days` },
          { "name": "New Est. Due Date", "value": newDue },
          { "name": "Source Step", "value": formData.source_step || '—' },
          { "name": "Defect", "value": formData.defect_description || '—' },
          { "name": "Reviewed By", "value": formData.reviewed_by || '—' },
          ...(formData.reroute_step ? [
            { "name": "Reroute to Step", "value": formData.reroute_step },
            { "name": "Days for Step", "value": `${formData.reroute_days} days` },
          ] : []),
        ],
        "markdown": true
      }]
    };
    try {
      await fetch('https://asdunkqodixbhbohxtuq.supabase.co/functions/v1/notify-teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZHVua3FvZGl4Ymhib2h4dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDUwNTcsImV4cCI6MjA5MDgyMTA1N30.lStrSSEpwFFk5GuXl2qzh2tr6bLZFY4_x9u6q4FcVeo',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZHVua3FvZGl4Ymhib2h4dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDUwNTcsImV4cCI6MjA5MDgyMTA1N30.lStrSSEpwFFk5GuXl2qzh2tr6bLZFY4_x9u6q4FcVeo`,
        },
        body: JSON.stringify(payload),
      });
    } catch(e) { console.error('Teams notify failed:', e); }
  };

  const handleSave = async () => {
    if (form.date_reschedule && !form.reschedule_days) return;
    setSaving(true);
    await onUpdate(c.id,{...form, updated_date: new Date().toISOString()});
    await sendTeamsNotification(form);
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000);
  };
  const handleClose = async () => {
    await onUpdate(c.id,{...form, status:'Closed', closed_date: format(new Date(),'yyyy-MM-dd'), updated_date: new Date().toISOString()});
    onClose();
  };
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">MRB Case</p>
            <h3 className="text-xl font-bold font-mono">{c.case_number}</h3>
            <p className="text-xs text-muted-foreground mt-1">Opened {c.opened_date?format(parseISO(c.opened_date),'MMM d, yyyy'):'—'}</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {isClosed && <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">Closed — read only</Badge>}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ABS Case Info Card */}
          {absInfo && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Case Details from ABS</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {[
                  ['Product', absInfo['Primary Product']],
                  ['Business Unit', absInfo['Business Unit']],
                  ['Doctor Due', absInfo['Doctor Due Date'] ? new Date(absInfo['Doctor Due Date']).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'],
                  ['Ship Date', absInfo['Ship Date'] ? new Date(absInfo['Ship Date']).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'],
                  ['Current Step', absInfo.current_step],
                  ['Department', absInfo.dept],
                  ['Received', absInfo['Received Date'] ? new Date(absInfo['Received Date']).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'],
                ].filter(([,v]) => v).map(([label, value]) => (
                  <div key={label}>
                    <span className="text-blue-500 text-xs">{label}: </span>
                    <span className="font-semibold text-blue-900 text-xs">{value}</span>
                  </div>
                ))}
                {absInfo['Hold Flag'] ? (
                  <div className="col-span-2">
                    <span className="text-xs font-semibold text-rose-600">Hold: {absInfo['Hold Reason'] || 'On Hold'}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <PanelField label="Case Number"><input className={inputCls} value={form.case_number} onChange={e=>set('case_number',e.target.value)} disabled={isClosed} /></PanelField>
            <PanelField label="Source"><select className={selCls} value={form.source} onChange={e=>set('source',e.target.value)} disabled={isClosed}><option value="external">External (ABS)</option><option value="internal">Internal (QC App)</option><option value="doctor_complaint">Doctor Complaint</option><option value="qc_log">QC Log</option></select></PanelField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PanelField label="Severity"><select className={selCls} value={form.severity} onChange={e=>set('severity',e.target.value)} disabled={isClosed}>{['Critical','Major','Minor'].map(s=><option key={s}>{s}</option>)}</select></PanelField>
            <PanelField label="Fault"><select className={selCls} value={form.fault} onChange={e=>set('fault',e.target.value)} disabled={isClosed}><option>Lab Fault</option><option>Doctor Fault</option><option>Nobody's Fault</option></select></PanelField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PanelField label="Team / Department"><input className={inputCls} value={form.team} onChange={e=>set('team',e.target.value)} placeholder="e.g. Design, Zirconia" disabled={isClosed} /></PanelField>
            <PanelField label="Technician"><input className={inputCls} value={form.technician} onChange={e=>set('technician',e.target.value)} placeholder="Technician name" disabled={isClosed} /></PanelField>
          </div>
          <PanelField label="Source Step — where issue was identified">
            <input className={inputCls} value={form.source_step} onChange={e=>set('source_step',e.target.value)} placeholder="e.g. Milling, Design, Zirconia" disabled={isClosed} />
          </PanelField>

          {/* Reroute Step */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">↩️</span>
              <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                Reroute — Step Case Must Go Back To
                {caseSteps.length > 0 && <span className="normal-case font-normal text-indigo-500 ml-1">({caseSteps.length} steps in recipe)</span>}
              </label>
            </div>

            {/* Step selector */}
            <div style={{position:'relative'}}>
              <select
                value={form.reroute_step}
                onChange={e => {
                  const found = caseSteps.find(s => s.consolidated === e.target.value);
                  set('reroute_step', e.target.value);
                  if (found) set('reroute_days', found.days);
                }}
                disabled={isClosed}
                className={selCls}
                style={{appearance:'none', WebkitAppearance:'none', paddingRight:32,
                  color: form.reroute_step ? '#111' : '#999',
                  borderColor:'#a5b4fc',
                  background: form.reroute_step ? '#eef2ff' : '#fff'}}
              >
                <option value="">{caseSteps.length === 0 ? 'Loading case recipe…' : 'Select step to reroute back to'}</option>
                {caseSteps.map(s => (
                  <option key={s.consolidated} value={s.consolidated}>
                    {s.consolidated} · {s.days}d {s.status === 'C' ? '✓' : ''}
                  </option>
                ))}
              </select>
              <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'#818cf8',fontSize:11}}>▾</span>
            </div>

            {/* Step progression from reroute point onwards */}
            {form.reroute_step && (() => {
              const fromIdx = caseSteps.findIndex(s => s.consolidated === form.reroute_step);
              const remaining = fromIdx >= 0 ? caseSteps.slice(fromIdx) : [];
              const totalHours = remaining.filter(s => !s.done || remaining.indexOf(s) === 0).reduce((sum, s) => sum + (s.hours || s.days*24 || 24), 0);
              const futureHours = remaining.filter(s => !s.done).reduce((sum, s) => sum + (s.hours || s.days*24 || 24), 0);
              const futureDays = parseFloat((futureHours/24).toFixed(1));
              return remaining.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    Steps from reroute point · {remaining.length} steps · {futureDays}d remaining
                  </p>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {remaining.map((s, i) => {
                      const isStart = i === 0;
                      const isFuture = !s.done;
                      return (
                        <div key={s.consolidated} className="flex items-center gap-2">
                          {/* Timeline dot + line */}
                          <div className="flex flex-col items-center shrink-0" style={{width:18}}>
                            <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                              isStart ? 'bg-indigo-600 border-indigo-600' :
                              s.done ? 'bg-emerald-400 border-emerald-400' :
                              'bg-white border-indigo-300'
                            }`}/>
                            {i < remaining.length - 1 && (
                              <div className={`w-0.5 flex-1 ${s.done ? 'bg-emerald-200' : 'bg-indigo-200'}`} style={{minHeight:12}}/>
                            )}
                          </div>
                          {/* Step row */}
                          <div className={`flex-1 flex items-center justify-between rounded-lg px-3 py-1.5 text-xs border ${
                            isStart ? 'bg-indigo-100 border-indigo-300 font-semibold text-indigo-800' :
                            s.done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                            'bg-white border-indigo-100 text-slate-600'
                          }`}>
                            <div className="flex items-center gap-1.5">
                              {s.done && !isStart && <span className="text-emerald-500">✓</span>}
                              {!s.done && <span className="text-slate-400">○</span>}
                              <span>{s.consolidated}</span>
                              {isFuture && <span className="text-indigo-400 text-xs italic ml-1">(upcoming)</span>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <input
                                type="number"
                                min="1"
                                max="30"
                                value={s.days}
                                disabled={isClosed || s.done}
                                onChange={e => {
                                  const val = parseInt(e.target.value)||1;
                                  setCaseSteps(prev => prev.map(p => p.consolidated === s.consolidated ? {...p, days: val} : p));
                                  if (s.consolidated === form.reroute_step) set('reroute_days', val);
                                }}
                                className={`w-10 text-center border rounded px-1 py-0.5 text-xs focus:outline-none ${
                                  s.done ? 'bg-emerald-50 border-emerald-200 text-emerald-600 cursor-not-allowed' :
                                  'bg-white border-indigo-200'
                                }`}
                              />
                              <span className={s.done ? 'text-emerald-400' : 'text-indigo-400'}>d</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Total summary */}
                  <div className="flex items-center justify-between bg-indigo-100 border border-indigo-300 rounded-lg px-3 py-2 text-xs font-semibold text-indigo-800">
                    <div>
                      <span>📅 Est. days remaining to ship</span>
                      <span className="ml-2 font-normal text-indigo-500 text-xs">({remaining.filter(s=>!s.done).length} steps left)</span>
                    </div>
<span className="text-sm font-bold">{futureHours.toFixed(0)}h ({futureDays}d)</span>
                  </div>
                  {absInfo?.['Doctor Due Date'] && (
                    <div className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                      New est. completion: <strong>
                        {new Date(new Date().getTime() + futureDays * 86400000)
                          .toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
                      </strong>
                      {' '}· Original due: <strong>
                        {new Date(absInfo['Doctor Due Date'])
                          .toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
                      </strong>
                    </div>
                  )}
                </div>
              ) : null;
            })()}
          </div>

          {/* Date Reschedule */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Date Reschedule</p>
            <div className="grid grid-cols-2 gap-3">
              {[{val:false,label:'No',sub:'Keep original date'},{val:true,label:'Yes',sub:'Reschedule required'}].map(({val,label,sub})=>{
                const active = form.date_reschedule === val;
                return (
                  <button key={String(val)} onClick={()=>!isClosed&&set('date_reschedule',val)}
                    disabled={isClosed}
                    style={{background: active?(val?'#FEF3C7':'#F0FDF4'):undefined, border: active?(val?'2px solid #F59E0B':'2px solid #10B981'):'1.5px solid #e2e2e2', borderRadius:12, padding:'12px', textAlign:'center', cursor:isClosed?'not-allowed':'pointer', opacity:isClosed?0.6:1, transition:'all 0.15s'}}>
                    <p style={{margin:'0 0 2px', fontSize:18, fontWeight:700, color:active?(val?'#92400E':'#065F46'):'#444'}}>{label}</p>
                    <p style={{margin:0, fontSize:11, color:active?(val?'#92400E':'#065F46'):'#888'}}>{sub}</p>
                  </button>
                );
              })}
            </div>
            {form.date_reschedule && (
              <div>
                <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1.5">
                  Number of Days to Reschedule <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={form.reschedule_days}
                    onChange={e=>set('reschedule_days', e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="e.g. 3"
                    disabled={isClosed}
                    className={`${inputCls} border-amber-300`}
                    style={{maxWidth:120}}
                  />
                  <span className="text-sm text-amber-700 font-medium">days</span>
                  {absInfo?.['Doctor Due Date'] && form.reschedule_days && (
                    <span className="text-xs text-amber-600 bg-amber-100 border border-amber-200 rounded-lg px-2 py-1">
                      New est. due: <strong>{new Date(new Date(absInfo['Doctor Due Date']).getTime() + form.reschedule_days * 86400000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</strong>
                    </span>
                  )}
                </div>
                {form.date_reschedule && !form.reschedule_days && (
                  <p className="text-xs text-rose-600 mt-1">⚠ Number of days is required when rescheduling</p>
                )}
                <p className="text-xs text-amber-600 mt-1.5">💬 A notification will be sent to Teams when you save.</p>
              </div>
            )}
          </div>
          {form.source === 'internal' && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
              <PanelField label="Notes for Dr Communication">
                <textarea className={`${inputCls} border-violet-200`} rows={3} value={form.dr_notes} onChange={e=>set('dr_notes',e.target.value)} placeholder="Notes to communicate to the doctor about this internal remake…" disabled={isClosed} />
              </PanelField>
            </div>
          )}
          <PanelField label="Defect Description"><textarea className={inputCls} rows={3} value={form.defect_description} onChange={e=>set('defect_description',e.target.value)} placeholder="Describe the defect or nonconformance…" disabled={isClosed} /></PanelField>
          <PanelField label="Root Cause"><textarea className={inputCls} rows={2} value={form.root_cause} onChange={e=>set('root_cause',e.target.value)} placeholder="Why did this happen?" disabled={isClosed} /></PanelField>
          <PanelField label="Corrective Action"><textarea className={inputCls} rows={2} value={form.corrective_action} onChange={e=>set('corrective_action',e.target.value)} placeholder="What will be done to prevent recurrence?" disabled={isClosed} /></PanelField>

          {/* Interim Fix */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🔧</span>
              <label className="block text-xs font-semibold text-sky-700 uppercase tracking-wider">Interim Fix — Direction to Move Case Now</label>
            </div>
            <p className="text-xs text-sky-600 mb-2">While root cause is under investigation, what should the team do to keep this case moving through production?</p>
            <textarea
              className={`${inputCls} border-sky-200`}
              rows={3}
              value={form.interim_fix}
              onChange={e=>set('interim_fix',e.target.value)}
              placeholder="e.g. Proceed with current zirconia — use manual shimming at placement. Flag for Final QC inspection before ship. Do not wait for full corrective action."
              disabled={isClosed}
            />
          </div>
          <PanelField label="Status">
            <select className={selCls} value={form.status} onChange={e=>set('status',e.target.value)} disabled={isClosed}>
              {['Open','Under Review','Closed'].map(s=><option key={s}>{s}</option>)}
            </select>
          </PanelField>
          <PanelField label="Reviewed By"><input className={inputCls} value={form.reviewed_by} onChange={e=>set('reviewed_by',e.target.value)} placeholder="Reviewer name" disabled={isClosed} /></PanelField>
          {c.closed_date && <div className="border-t pt-4"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Closed Date</p><p className="text-sm text-muted-foreground">{format(parseISO(c.closed_date),'MMM d, yyyy')}</p></div>}
        </div>
        {!isClosed && (
          <div className="px-6 py-4 border-t flex gap-2">
            <Button variant="outline" onClick={handleClose} className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"><CheckCircle className="w-4 h-4" /> Close Case</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2"><Save className="w-4 h-4" />{saving?'Notifying…':saved?'✓ Saved & Notified':'Save Changes'}</Button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Staged Row ────────────────────────────────────────────────────────────────
function StagedRow({ row, onClaimed }) {
  const [expert, setExpert] = useState(EXPERTS[0].name);
  const [claiming, setClaiming] = useState(false);
  const handleClaim = async () => {
    setClaiming(true);
    try {
      const { error: mrbErr } = await supabase.from('cb_mrb_cases').insert([{
        case_number: row.case_number, source:'internal', business_unit:'Crown & Bridge',
        team: row.department, reviewed_by: expert, severity:'Major', status:'Open',
        disposition:'Pending', fault:'Lab Fault', defect_description: row.issue_summary||'',
        opened_date: format(new Date(),'yyyy-MM-dd'), created_date: new Date().toISOString(), updated_date: new Date().toISOString(),
      }]);
      if (mrbErr) throw mrbErr;
      await supabase.from('cb_staged_cases').update({ status:'Closed', assigned_expert: expert, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', row.id);
      onClaimed();
    } catch(e) { alert('Error claiming case: '+e.message); } finally { setClaiming(false); }
  };
  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="font-mono text-sm font-bold">{row.case_number}</TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{row.dr_due_date?format(parseISO(row.dr_due_date),'MMM d, yyyy'):'—'}</TableCell>
      <TableCell>{urgencyBadge(row.dr_due_date)}</TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{row.ship_date?format(parseISO(row.ship_date),'MMM d, yyyy'):'—'}</TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{row.issue_summary||'—'}</TableCell>
      <TableCell className="text-sm">{row.department||'—'}</TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{row.staged_at?format(parseISO(row.staged_at),'MMM d, h:mm a'):'—'}</TableCell>
      <TableCell>
        <select value={expert} onChange={e=>setExpert(e.target.value)} onClick={e=>e.stopPropagation()} className="text-xs border rounded-lg px-2 py-1.5 bg-background">
          {EXPERTS.map(ex=><option key={ex.name} value={ex.name}>{ex.name}</option>)}
        </select>
      </TableCell>
      <TableCell>
        <button onClick={handleClaim} disabled={claiming} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-xs font-semibold hover:bg-violet-100 transition-colors disabled:opacity-50">
          <UserCheck className="w-3.5 h-3.5" />{claiming?'Claiming…':'Claim & Open MRB'}
        </button>
      </TableCell>
    </TableRow>
  );
}

// ── Main MRB Board ────────────────────────────────────────────────────────────
export default function MRBBoard() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [detailCase, setDetailCase] = useState(null);
  const [stageCase, setStageCase] = useState(null);
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const queryClient = useQueryClient();

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['mrb_cases'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cb_mrb_cases').select('*').order('opened_date',{ascending:false});
      if (error) throw error;
      return data??[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({queryKey:['mrb_cases']});

  const { data: stagedCases = [] } = useQuery({
    queryKey: ['staged_cases'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cb_staged_cases').select('*').neq('status','Closed').order('dr_due_date',{ascending:true,nullsFirst:false});
      if (error) throw error;
      return data??[];
    },
  });
  const refreshStaged = () => queryClient.invalidateQueries({queryKey:['staged_cases']});

  const updateCase = async (id, updates) => {
    await supabase.from('cb_mrb_cases').update({...updates, updated_date: new Date().toISOString()}).eq('id',id);
    refresh();
  };
  const closeCase = async (id) => updateCase(id,{status:'Closed', closed_date:format(new Date(),'yyyy-MM-dd')});
  const deleteCase = async (id) => {
    if (!confirm('Delete this MRB case?')) return;
    await supabase.from('cb_mrb_cases').delete().eq('id',id);
    refresh();
  };

  const open = cases.filter(c=>c.status==='Open').length;
  const underReview = cases.filter(c=>c.status==='Under Review'||c.status==='Disposition Set').length;
  const critical = cases.filter(c=>c.severity==='Critical'&&c.status!=='Closed').length;
  const closed = cases.filter(c=>c.status==='Closed').length;
  const totalActive = cases.filter(c=>c.status!=='Closed').length;

  // Analysis data
  const bySource = ['internal','external','doctor_complaint','qc_log'].map(s=>({
    label:{internal:'Internal',external:'External',doctor_complaint:'Dr Complaint',qc_log:'QC Log'}[s],
    count: cases.filter(c=>c.source===s).length,
    cls:{internal:'bg-violet-500',external:'bg-blue-500',doctor_complaint:'bg-rose-500',qc_log:'bg-slate-400'}[s],
  })).filter(s=>s.count>0);

  const bySeverity = ['Critical','Major','Minor'].map(s=>({
    label:s, count:cases.filter(c=>c.severity===s&&c.status!=='Closed').length,
    cls:{Critical:'bg-rose-500',Major:'bg-amber-500',Minor:'bg-sky-400'}[s],
  })).filter(s=>s.count>0);

  const byDisposition = DISPOSITIONS.map(d=>({
    label:d, count:cases.filter(c=>c.disposition===d).length,
    cls:{Remake:'bg-violet-500',Rework:'bg-sky-500',Scrap:'bg-rose-500','Use As-Is':'bg-emerald-500'}[d]||'bg-slate-400',
  })).filter(d=>d.count>0);

  const ANALYSIS = {
    open:     {title:'Open Cases',        cases:cases.filter(c=>c.status==='Open')},
    review:   {title:'Under Review',      cases:cases.filter(c=>c.status==='Under Review'||c.status==='Disposition Set')},
    critical: {title:'Critical (Active)', cases:cases.filter(c=>c.severity==='Critical'&&c.status!=='Closed')},
    closed:   {title:'Closed Cases',      cases:cases.filter(c=>c.status==='Closed')},
    queue:    {title:'Awaiting Expert Claim', cases:stagedCases},
  };

  const filtered = cases.filter(c => {
    const matchSearch = !search||(c.case_number||'').toLowerCase().includes(search.toLowerCase())||(c.technician||'').toLowerCase().includes(search.toLowerCase())||(c.defect_description||'').toLowerCase().includes(search.toLowerCase())||(c.team||'').toLowerCase().includes(search.toLowerCase());
    return matchSearch && (filterStatus==='all'||c.status===filterStatus) && (filterSeverity==='all'||c.severity===filterSeverity) && (filterSource==='all'||c.source===filterSource);
  });

  const TILES = [
    {key:'open',     label:'Open',           value:open,        icon:AlertTriangle, color:'text-rose-600 bg-rose-50',       active:'border-2 border-rose-400'},
    {key:'review',   label:'Under Review',   value:underReview, icon:Clock,         color:'text-amber-600 bg-amber-50',     active:'border-2 border-amber-400'},
    {key:'queue',    label:'Awaiting Claim',  value:stagedCases.length, icon:UserCheck, color:'text-violet-600 bg-violet-50', active:'border-2 border-violet-400'},
    {key:'closed',   label:'Closed',          value:closed,     icon:CheckCircle,   color:'text-emerald-600 bg-emerald-50', active:'border-2 border-emerald-400'},
  ];
  // Migrate old 'Disposition Set' status to 'Under Review' in display

  return (
    <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">MRB Board</h2>
          <p className="text-sm text-muted-foreground">Material Review Board — Nonconformance tracking & disposition</p>
        </div>
        <Button onClick={()=>setShowAdd(true)} className="gap-2"><Plus className="w-4 h-4" /> Open MRB Case</Button>
      </div>

      {/* ── Clickable stat tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {TILES.map(({key,label,value,icon:Icon,color,active})=>(
          <Card key={key} className={`hover:shadow-md transition-all cursor-pointer ${activeAnalysis===key?active:''}`} onClick={()=>setActiveAnalysis(activeAnalysis===key?null:key)}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click to analyze</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Analysis drill-down ── */}
      {activeAnalysis && ANALYSIS[activeAnalysis] && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> {ANALYSIS[activeAnalysis].title}
                <Badge variant="outline" className="ml-1">{ANALYSIS[activeAnalysis].cases.length} cases</Badge>
              </CardTitle>
              <button onClick={()=>setActiveAnalysis(null)} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            {/* Mini breakdown charts */}
            <div className="grid grid-cols-3 gap-4 mt-3">
              {[{title:'By Source',data:bySource},{title:'By Severity',data:bySeverity},{title:'By Disposition',data:byDisposition}].map(({title,data})=>(
                <div key={title} className="bg-white rounded-xl p-3 border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
                  {data.map(d=>(
                    <div key={d.label} className="flex items-center gap-2 mb-1.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${d.cls}`} />
                      <span className="text-xs flex-1 truncate">{d.label}</span>
                      <span className="text-xs font-bold">{d.count}</span>
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${d.cls}`} style={{width:`${(d.count/Math.max(cases.length,1))*100}%`}} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardHeader>
          {/* Case tiles */}
          <CardContent className="px-4 pb-4">
            {ANALYSIS[activeAnalysis].cases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No cases in this group</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {ANALYSIS[activeAnalysis].cases.map(c=>(
                  <div key={c.id} onClick={()=>setDetailCase(c)} className={`bg-white rounded-xl border-2 p-4 cursor-pointer hover:shadow-md transition-all space-y-3 ${c.severity==='Critical'?'border-l-4 border-rose-400':'border-muted'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-foreground">{c.case_number}</span>
                      {sourceBadge(c.source)}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={`text-xs ${SEVERITY_STYLES[c.severity]||''}`}>{c.severity}</Badge>
                      <Badge variant="outline" className={`text-xs ${STATUS_STYLES[c.status]||''}`}>{c.status}</Badge>
                      <Badge variant="outline" className={`text-xs ${DISPOSITION_STYLES[c.disposition||'Pending']||''}`}>{c.disposition||'Pending'}</Badge>
                    </div>
                    {c.defect_description && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{c.defect_description}</p>}
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                      <span className="font-medium text-foreground truncate max-w-[100px]">{c.team||'—'}</span>
                      <span className="truncate max-w-[100px] text-right">{c.technician||'—'}</span>
                    </div>
                    {c.reviewed_by && <p className="text-xs text-muted-foreground">Reviewed by <span className="font-medium text-foreground">{c.reviewed_by}</span></p>}
                    {c.opened_date && <p className="text-xs text-muted-foreground">{format(parseISO(c.opened_date),'MMM d, yyyy')}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── All MRB Cases — Card Grid ── */}
      <div>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search case, tech, description…" value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Statuses</SelectItem>{STATUSES.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Severities" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Severities</SelectItem>{SEVERITIES.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="external">External (ABS)</SelectItem>
              <SelectItem value="internal">Internal (QC App)</SelectItem>
              <SelectItem value="doctor_complaint">Doctor Complaint</SelectItem>
              <SelectItem value="qc_log">QC Log</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No MRB cases yet</p>
            <p className="text-xs mt-1">Click "Open MRB Case" to log a nonconformance</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(c => (
              <div
                key={c.id}
                className={`bg-card rounded-2xl border-2 p-5 cursor-pointer hover:shadow-lg transition-all flex flex-col gap-3 ${c.severity==='Critical'&&c.status!=='Closed'?'border-l-4 border-rose-400 border-t-rose-100':'border-muted'}`}
                onClick={() => setDetailCase(c)}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-sm font-bold">{c.case_number}</span>
                  {sourceBadge(c.source)}
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className={`text-xs ${SEVERITY_STYLES[c.severity]||''}`}>{c.severity}</Badge>
                  <Badge variant="outline" className={`text-xs ${STATUS_STYLES[c.status]||''}`}>{c.status}</Badge>
                  <Badge variant="outline" className={`text-xs ${DISPOSITION_STYLES[c.disposition||'Pending']||''}`}>{c.disposition||'Pending'}</Badge>
                </div>

                {/* Defect description */}
                {c.defect_description && (
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed flex-1">{c.defect_description}</p>
                )}

                {/* Team + Tech */}
                <div className="flex items-center justify-between text-xs border-t pt-2">
                  <span className="font-medium truncate max-w-[45%]">{c.team||'—'}</span>
                  <span className="text-muted-foreground truncate max-w-[45%] text-right">{c.technician||'—'}</span>
                </div>

                {/* Reviewed by + date */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {c.reviewed_by ? <span>By <span className="font-medium text-foreground">{c.reviewed_by}</span></span> : <span />}
                  <span>{c.opened_date?format(parseISO(c.opened_date),'MMM d'):'—'}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 border-t pt-2" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>setStageCase(c)} title="Stage for expert review" className="p-1.5 rounded hover:bg-violet-50 text-muted-foreground hover:text-violet-600"><UserCheck className="w-3.5 h-3.5" /></button>
                  {c.status!=='Closed'&&<button onClick={()=>closeCase(c.id)} title="Close case" className="p-1.5 rounded hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /></button>}
                  <button onClick={()=>deleteCase(c.id)} title="Delete" className="p-1.5 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <InternalRemakeDashboard />

      {stagedCases.length>0&&(
        <Card className="border-violet-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-violet-600" /> Expert Review Queue
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs ml-1">{stagedCases.length} awaiting claim</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Tech experts — select your name and click Claim to take ownership and open an MRB case</p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Case #</TableHead><TableHead className="font-semibold">Doctor Due</TableHead>
                  <TableHead className="font-semibold">Urgency</TableHead><TableHead className="font-semibold">Ship Date</TableHead>
                  <TableHead className="font-semibold">Description</TableHead><TableHead className="font-semibold">Department</TableHead>
                  <TableHead className="font-semibold">Staged At</TableHead><TableHead className="font-semibold">Claim as</TableHead>
                  <TableHead className="font-semibold w-36">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagedCases.map(s=><StagedRow key={s.id} row={s} onClaimed={()=>{refresh();refreshStaged();}} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showAdd&&<AddCaseModal onClose={()=>setShowAdd(false)} onSaved={refresh} />}
      {detailCase&&<CaseDetailPanel c={detailCase} onClose={()=>setDetailCase(null)} onUpdate={updateCase} />}
      {stageCase&&<StageModal caseNumber={stageCase.case_number} onClose={()=>setStageCase(null)} onSaved={()=>{refreshStaged();setStageCase(null);}} />}
    </div>
  );
}
