import React, { useState, useRef, useEffect } from 'react';
import { QCLog } from '@/api/supabaseClient';
import { supabase } from '@/api/supabaseClient';
import { TEAMS, TECHNICIANS_BY_TEAM } from '@/lib/teamsData';
import { CheckCircle, ChevronDown, AlertCircle, RotateCcw, UserCheck, Bell, SkipForward, Layers, ClipboardList, Wrench } from 'lucide-react';

// ── Reject type catalog ──────────────────────────────────────────────────────
const REJECT_TYPES_BY_TEAM = {
  Design: ['ASC Dimples Not Designed','Design — Files Not Placed for Milling','Design — Massive Overjet / Occlusion Issue','Design — Missing Model / Soft Tissue','Design — Not Millable','Design Error','Fracture caused due to design error','Incorrect screw design','No Clearance Around MUA','No upper arch design','Open Implants Not Used','Rx not followed','TRI Matrix Info Incorrect — Screws, Platforms','Wrong design','Other'],
  PMMA: ['Acrylic / Cement Gap Fill','Debris in Interface','Debonded Ti','Excess Glaze','Finish-Dull, Rough spots','Finish-Scratches, Gouges, Embedded Debris','Finish-Symmetry','Gum Shade','Incomplete Cleaning / Residual Material','Incorrect Cementing','Intaglio Polish','Internal Glaze Contamination','LFX Housing','Missing glaze','Missing Product','Missing Tissue','MUA Interface Damage','No Clearance Around MUA','Rx not followed','Scanning Issue','Screw Access','Screw channel-Fitted, Dirty','Seating issues on model','Surface Porosity / Bubbles','Ti Base not Cemented','Tooth Shade','Other'],
  Zirconia: ['Combo Case — Denture Seating Issue','Debris in Interface','Finish-Dull, Rough spots','Finish-Scratches, Gouges, Embedded Debris','Finish-Symmetry','Gum Shade','Incomplete Cleaning / Residual Material','Incorrect Cementing','Intaglio Polish','Internal Glaze Contamination','Missing Product','Missing Tissue','MUA Interface Damage','No Clearance Around MUA','Rx not followed','Scanning Issue','Screw Access','Structure Separation','Surface Porosity / Bubbles','Ti Base not Cemented','TRI Matrix Info Incorrect — Screws, Platforms','Tooth Shade','Other'],
  Bars: ['Acrylic / Cement Gap Fill','Design Error','Finish-Scratches, Gouges, Embedded Debris','Incorrect Cementing','Intaglio Polish','LFX Housing','Missing Documentation','Missing Product','Other','Seating issues on model','Shade Adjustment'],
  Milling: ['Bad Print','Finish-Scratches, Gouges, Embedded Debris','MUA Interface Damage','Other','Scanning Issue'],
  Printing: ['Bad Print','Seating issues on model','Other'],
  'Case Entry': ['Case Entry Error — Wrong Account','Rx not followed','Other'],
  'Case Review': ['Missing Product','Rx not followed','Other'],
  'Case Coordination': ['Other'],
  'Place Parts': ['Missing Screws','Missing Product','Finish-Scratches, Gouges, Embedded Debris','Other'],
  Scanning: ['Scanning Issue','Other'],
  'Shape and Colorize': ['Gum Shade','Tooth Shade','Scanning Issue','Other'],
  'Design QC': ['Finish-Scratches, Gouges, Embedded Debris','Rx not followed','Other'],
  'Design Adjustments': ['Design Error','Other'],
};
const DEFAULT_REJECT_TYPES = ['Finish-Scratches, Gouges, Embedded Debris','Finish-Dull, Rough spots','Screw Access','Incorrect Cementing','Missing Product','Rx not followed','Other'];
const QC_REJECT_OPTIONS = [
  { value: 'Repair',         color: '#3B6D11', bg: '#EAF3DE', border: '#97C459' },
  { value: 'ASAP(Same day)', color: '#854F0B', bg: '#FAEEDA', border: '#EF9F27' },
  { value: 'Next Day',       color: '#185FA5', bg: '#E6F1FB', border: '#85B7EB' },
  { value: 'Remake',         color: '#A32D2D', bg: '#FCEBEB', border: '#F09595' },
  { value: 'Internal Remake',color: '#534AB7', bg: '#EEEDFE', border: '#AFA9EC' },
];

const DEPARTMENTS = ['PMMA','Zirconia','Bars','Design','Design QC','Design Adjustments','Milling','Printing','Scanning','Shape and Colorize','Place Parts','Case Entry','Case Review','Case Coordination'];
const SUPABASE_URL = 'https://asdunkqodixbhbohxtuq.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZHVua3FvZGl4Ymhib2h4dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDUwNTcsImV4cCI6MjA5MDgyMTA1N30.lStrSSEpwFFk5GuXl2qzh2tr6bLZFY4_x9u6q4FcVeo';
const EXPERTS = [
  { name: 'Jeannette Rubio', email: 'jeannette.rubio@skdla.com' },
  { name: 'Ryan Okon',       email: 'ryan.okon@skdla.com' },
];

const inputSt = { width:'100%', boxSizing:'border-box', border:'1.5px solid #e2e2e2', borderRadius:12, padding:'14px 16px', fontSize:15, background:'#fff', color:'#111', outline:'none', fontFamily:'inherit' };
const labelSt = { display:'block', fontSize:13, fontWeight:600, color:'#555', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' };

const EMPTY = { case_number:'', team:'', technician:'', qc_reject:'ASAP(Same day)', reject_type:'', reject_details:'', ship_date:'' };
const EMPTY_IR = { case_number:'', department:'', logged_by:'', ship_date:'', dr_due_date:'', description:'' };

// ── QC Reject Form (3 steps) ─────────────────────────────────────────────────
function QCRejectForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [drDueDate, setDrDueDate] = useState('');
  const [stagingDone, setStagingDone] = useState(false);
  const [staging, setStaging] = useState(false);
  const caseRef = useRef(null);
  useEffect(() => { if (step === 1) caseRef.current?.focus(); }, [step]);

  const set = (k, v) => {
    if (k === 'team') setForm(p => ({ ...p, team: v, technician: '', reject_type: '' }));
    else setForm(p => ({ ...p, [k]: v }));
  };
  const techs = TECHNICIANS_BY_TEAM[form.team] || [];
  const rejectTypes = REJECT_TYPES_BY_TEAM[form.team] || DEFAULT_REJECT_TYPES;
  const canNext = form.case_number.trim() && form.team && form.technician;
  const canSubmit = canNext && form.reject_type;
  const selectedReject = QC_REJECT_OPTIONS.find(o => o.value === form.qc_reject) || QC_REJECT_OPTIONS[0];

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
      await QCLog.create({ case_number: form.case_number.trim(), team: form.team, technician: form.technician, qc_reject: form.qc_reject, reject_type: form.reject_type, reject_details: form.reject_details || null, ship_date:form.ship_date || null, time_stamp: new Date().toISOString() });
      setStep(3);
    } catch (e) { setError(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleStage = async () => {
    setStaging(true);
    try {
      await supabase.from('staged_cases').insert([{ case_number: form.case_number.trim(), dr_due_date: drDueDate || null, department: form.team, assigned_expert: null, assigned_expert_email: null, status: 'Pending', staged_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      EXPERTS.forEach(ex => {
        fetch(`${SUPABASE_URL}/functions/v1/notify-expert-staged`, { method:'POST', headers:{'Content-Type':'application/json','apikey':ANON_KEY}, body: JSON.stringify({ case_number: form.case_number.trim(), dr_due_date: drDueDate, department: form.team, assigned_expert: ex.name, assigned_expert_email: ex.email }) }).catch(() => {});
      });
      setStagingDone(true);
    } catch (e) {}
    finally { setStaging(false); }
  };

  const reset = () => { setForm(EMPTY); setStep(1); setDone(false); setError(null); setDrDueDate(''); setStagingDone(false); };

  // Step 3
  if (step === 3) {
    return (
      <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
        <div style={{ flex:1, padding:'28px 0 120px', maxWidth:480, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>
          {!stagingDone ? (
            <>
              <div style={{ textAlign:'center', marginBottom:28 }}>
                <div style={{ width:60, height:60, borderRadius:'50%', background:'#EEEDFE', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                  <UserCheck size={28} color="#534AB7" />
                </div>
                <h2 style={{ margin:'0 0 4px', fontSize:18, fontWeight:700 }}>QC Reject Logged ✓</h2>
                <p style={{ margin:'0 0 4px', fontSize:14, color:'#555' }}><strong>{form.case_number}</strong> · {form.team} · {form.qc_reject}</p>
                <p style={{ margin:'0 0 20px', fontSize:14, color:'#888' }}>Stage for Expert Review? (optional)</p>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={labelSt}>Doctor Due Date <span style={{ fontWeight:400, color:'#aaa', textTransform:'none' }}>(optional)</span></label>
                <input type="date" value={drDueDate} onChange={e => setDrDueDate(e.target.value)} style={inputSt} />
              </div>
              <p style={{ fontSize:12, color:'#999', textAlign:'center' }}>Jeannette Rubio & Ryan Okon will both be notified</p>
            </>
          ) : (
            <div style={{ textAlign:'center', paddingTop:40 }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'#EEEDFE', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <Bell size={28} color="#534AB7" />
              </div>
              <h2 style={{ margin:'0 0 8px', fontSize:22, fontWeight:700, color:'#534AB7' }}>Experts Notified!</h2>
              <p style={{ margin:0, fontSize:14, color:'#555' }}>Jeannette & Ryan have been emailed about <strong>{form.case_number}</strong>.</p>
            </div>
          )}
        </div>
        <div style={{ position:'sticky', bottom:0, background:'#fff', borderTop:'1px solid #eee', padding:'16px 0' }}>
          <div style={{ maxWidth:480, margin:'0 auto', display:'flex', gap:12 }}>
            {!stagingDone && <button onClick={reset} style={{ flex:'0 0 auto', background:'#f5f5f5', color:'#666', border:'none', borderRadius:14, padding:'14px 16px', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}><SkipForward size={16} /> Skip</button>}
            <button onClick={stagingDone ? reset : handleStage} disabled={staging} style={{ flex:1, border:'none', borderRadius:14, padding:'14px', fontSize:15, fontWeight:700, cursor:'pointer', background: stagingDone ? '#111' : '#534AB7', color:'#fff' }}>
              {stagingDone ? '+ Log another case' : staging ? 'Notifying…' : 'Notify Experts & Stage'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
      {/* Step dots */}
      <div style={{ display:'flex', gap:6, justifyContent:'flex-end', padding:'8px 0' }}>
        {[1,2,3].map(s => <div key={s} style={{ width: s === step ? 24 : 8, height:8, borderRadius:4, background: step >= s ? '#111' : '#ddd', transition:'all 0.2s' }} />)}
      </div>

      <div style={{ flex:1, paddingBottom:120 }}>
        {error && <div style={{ display:'flex', gap:8, alignItems:'center', background:'#FFF0F0', border:'1px solid #FFC9C9', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:14, color:'#C0392B' }}><AlertCircle size={16} />{error}</div>}

        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={labelSt}>Case Number</label>
              <input ref={caseRef} value={form.case_number} onChange={e => set('case_number', e.target.value)} placeholder="e.g. 2026-12345" style={{ ...inputSt, fontSize:18, fontWeight:600 }} onKeyDown={e => e.key === 'Enter' && canNext && setStep(2)} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div>
                <label style={labelSt}>Department</label>
                <div style={{ position:'relative' }}>
                  <select value={form.team} onChange={e => set('team', e.target.value)} style={{ ...inputSt, appearance:'none', WebkitAppearance:'none', paddingRight:36, color: form.team ? '#111' : '#999' }}>
                    <option value="">Select dept</option>
                    {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#999', fontSize:11 }}>▾</span>
                </div>
              </div>
              <div>
                <label style={labelSt}>Technician</label>
                <div style={{ position:'relative' }}>
                  <select value={form.technician} onChange={e => set('technician', e.target.value)} disabled={!form.team} style={{ ...inputSt, appearance:'none', WebkitAppearance:'none', paddingRight:36, color: form.technician ? '#111' : '#999', opacity: !form.team ? 0.5 : 1 }}>
                    <option value="">{form.team ? 'Select tech' : 'Select dept first'}</option>
                    {techs.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#999', fontSize:11 }}>▾</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:'#f5f5f5', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#555' }}>
              <strong>{form.case_number}</strong> · {form.team} · {form.technician}
            </div>
            <div>
              <label style={labelSt}>Reject Urgency</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {QC_REJECT_OPTIONS.map(opt => {
                  const active = form.qc_reject === opt.value;
                  return <button key={opt.value} onClick={() => set('qc_reject', opt.value)} style={{ padding:'10px 14px', fontSize:13, fontWeight: active ? 700 : 400, borderRadius:99, cursor:'pointer', border:'none', background: active ? opt.bg : '#f0f0f0', color: active ? opt.color : '#666', outline: active ? `2px solid ${opt.border}` : 'none', outlineOffset:1, transition:'all 0.15s' }}>{opt.value}</button>;
                })}
              </div>
            </div>
            <div>
              <label style={labelSt}>Reject Type</label>
              <div style={{ position:'relative' }}>
                <select value={form.reject_type} onChange={e => set('reject_type', e.target.value)} style={{ ...inputSt, appearance:'none', WebkitAppearance:'none', paddingRight:36, color: form.reject_type ? '#111' : '#999' }}>
                  <option value="">Select reject type</option>
                  {rejectTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#999', fontSize:11 }}>▾</span>
              </div>
            </div>
            <div>
              <label style={labelSt}>Details <span style={{ fontWeight:400, color:'#aaa', textTransform:'none' }}>(optional)</span></label>
              <textarea value={form.reject_details} onChange={e => set('reject_details', e.target.value)} placeholder="Describe the issue…" rows={3} style={{ ...inputSt, resize:'none', minHeight:80 }} />
            </div>
              <label style={labelSt}>Ship Date <span style={{ fontWeight:400, color:'#aaa', textTransform:'none' }}>(optional)</span></label>
              <input type="date" value={form.ship_date} onChange={e => set('ship_date', e.target.value)} style={inputSt} />
            </div>
        )}
      </div>

      <div style={{ position:'sticky', bottom:0, background:'#fff', borderTop:'1px solid #eee', padding:'16px 0' }}>
        <div style={{ display:'flex', gap:12, maxWidth:480, margin:'0 auto' }}>
          {step === 2 && <button onClick={() => setStep(1)} style={{ flex:'0 0 80px', background:'#f5f5f5', color:'#444', border:'none', borderRadius:14, padding:'14px', fontSize:14, fontWeight:600, cursor:'pointer' }}>← Back</button>}
          <button onClick={step === 1 ? () => setStep(2) : handleSubmit} disabled={step === 1 ? !canNext : (!canSubmit || saving)} style={{ flex:1, border: step === 2 && canSubmit ? `2px solid ${selectedReject.border}` : 'none', borderRadius:14, padding:'14px', fontSize:15, fontWeight:700, cursor: (step === 1 ? canNext : canSubmit) && !saving ? 'pointer' : 'not-allowed', background: (step === 1 ? canNext : canSubmit) && !saving ? (step === 2 ? selectedReject.bg : '#111') : '#e0e0e0', color: (step === 1 ? canNext : canSubmit) && !saving ? (step === 2 ? selectedReject.color : '#fff') : '#aaa', transition:'all 0.15s' }}>
            {step === 1 ? 'Next →' : saving ? 'Saving…' : `Submit ${form.qc_reject}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Internal Remake Form ─────────────────────────────────────────────────────
function InternalRemakeForm() {
  const [form, setForm] = useState(EMPTY_IR);
  const [needsExpert, setNeedsExpert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [caseInfo, setCaseInfo] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [caseSteps, setCaseSteps] = useState([]);
  const [rerouteStep, setRerouteStep] = useState('');
  const lookupTimer = useRef(null);

  const TEAMS_WEBHOOK = 'https://thedentalalliance.webhook.office.com/webhookb2/742d5b0d-5130-416e-ae9c-0b92f50c6c78@9eeb8be1-6508-41b3-a532-3825109ed502/IncomingWebhook/4edbd68bddfa456fb1326d7c6a2b0271/6ec45b25-de49-4660-af7b-cf136938d7cd/V2rckMY8aPFc4tzd9OK0qKY36y1dvIPhzSEeRbHHY6z7E1';

  const sendTeamsNotification = async (data) => {
    if (!TEAMS_WEBHOOK || TEAMS_WEBHOOK.includes('PASTE')) return;
    const payload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": data.needsExpert ? "534AB7" : "10B981",
      "summary": `Internal Remake — ${data.case_number}`,
      "sections": [{
        "activityTitle": `🔄 Internal Remake — ${data.case_number}`,
        "activitySubtitle": data.needsExpert
          ? "🔴 Expert Assistance Required — case staged for review"
          : `🟢 Self Rerouted by ${data.logged_by || 'lead'} → ${data.reroute_step}`,
        "facts": [
          { "name": "Case #",         "value": data.case_number },
          { "name": "Product",        "value": data.product || '—' },
          { "name": "Business Unit",  "value": data.bu || '—' },
          { "name": "Department",     "value": data.department || '—' },
          { "name": "Current Step",   "value": data.current_step || '—' },
          { "name": "Doctor Due",     "value": data.dr_due_date || '—' },
          { "name": "Ship Date",      "value": data.ship_date || '—' },
          { "name": "Logged By",      "value": data.logged_by || '—' },
          { "name": "Description",    "value": data.description || '—' },
          ...(data.needsExpert
            ? [{ "name": "Action", "value": "Jeannette, Ryan & Deepak have been notified" }]
            : [{ "name": "Reroute To", "value": data.reroute_step }]
          ),
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
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCaseNumber = (val) => {
    set('case_number', val);
    setCaseInfo(null);
    setCaseSteps([]);
    clearTimeout(lookupTimer.current);
    if (val.trim().length >= 5) {
      lookupTimer.current = setTimeout(async () => {
        setLookingUp(true);
        try {
          const [caseRes, wfRes] = await Promise.all([
            supabase.from('Cases')
              .select('"Case Number","Business Unit","Primary Product","Doctor Due Date","Ship Date","Received Date","Hold Flag","Hold Reason"')
              .eq('Case Number', val.trim())
              .maybeSingle(),
            supabase.from('wip_cases')
              .select('current_step_name, current_step_business_unit')
              .eq('case_number', val.trim())
              .maybeSingle(),
          ]);
          if (caseRes.data) {
            const wf = wfRes.data || {};
            const combined = {
              ...caseRes.data,
              current_step: wf.current_step_name || null,
              dept1: wf.current_step_business_unit || null,
            };
            setCaseInfo(combined);
            if (combined['Doctor Due Date']) set('dr_due_date', combined['Doctor Due Date'].slice(0, 10));
            if (combined['Ship Date']) set('ship_date', combined['Ship Date'].slice(0, 10));
            if (combined.dept1) set('department', combined.dept1);
            if (combined.current_step) set('source_step', combined.current_step);

            // Fetch step recipe
            const { data: steps } = await supabase
              .from('case_steps_dept_aox')
              .select('step_consolidated, start_date, status')
              .eq('case_number', val.trim())
              .order('start_date', { ascending: true });
            if (steps?.length) {
              const seen = new Set();
              setCaseSteps(steps.filter(s => {
                if (seen.has(s.step_consolidated)) return false;
                seen.add(s.step_consolidated); return true;
              }));
            }
          }
        } catch(e) { console.error('Lookup error:', e); }
        finally { setLookingUp(false); }
      }, 600);
    }
  };
  const canSubmit = form.case_number.trim() && needsExpert !== null && (needsExpert === true || rerouteStep);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!needsExpert && !rerouteStep) { setError('Please select the step to reroute the case back to.'); return; }
    setSaving(true); setError(null);
    try {
      // Use auto-filled dept from case lookup, fall back to empty string
      const dept = form.department || caseInfo?.dept1 || '';

      // Always log to internal_remake_log
      await supabase.from('cb_internal_remake_log').insert([{
        case_number: form.case_number.trim(),
        department: dept,
        logged_by: form.logged_by || null,
        ship_date: form.ship_date || null,
        dr_due_date: form.dr_due_date || null,
        description: form.description || null,
        needs_expert: needsExpert,
        time_stamp: new Date().toISOString(),
        created_date: new Date().toISOString(),
      }]);

      if (needsExpert) {
        // Insert into staged_cases so it appears in MRB Awaiting Claim queue
        const { error: stageErr } = await supabase.from('staged_cases').insert([{
          case_number: form.case_number.trim(),
          dr_due_date: form.dr_due_date || null,
          ship_date: form.ship_date || null,
          department: dept,
          issue_summary: form.description || null,
          staged_by: form.logged_by || null,
          assigned_expert: null,
          assigned_expert_email: null,
          status: 'Pending',
          staged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
        if (stageErr) console.error('staged_cases insert error:', stageErr);

        // Email all 3 experts
        await Promise.all(EXPERTS.map(ex =>
          fetch(`${SUPABASE_URL}/functions/v1/notify-expert-staged`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
            body: JSON.stringify({
              case_number: form.case_number.trim(),
              dr_due_date: form.dr_due_date,
              ship_date: form.ship_date,
              department: dept,
              issue_summary: form.description,
              source_step: caseInfo?.current_step,
              staged_by: form.logged_by,
              assigned_expert: ex.name,
              assigned_expert_email: ex.email,
            }),
          }).catch(() => {})
        ));
      }

      // Send Teams notification (both Yes and No)
      await sendTeamsNotification({
        case_number: form.case_number.trim(),
        product: caseInfo?.['Primary Product'],
        bu: caseInfo?.['Business Unit'],
        department: dept,
        current_step: caseInfo?.current_step,
        dr_due_date: form.dr_due_date,
        ship_date: form.ship_date,
        logged_by: form.logged_by,
        description: form.description,
        needsExpert,
        reroute_step: rerouteStep,
      });

      setDone(true);
    } catch (e) { setError(e.message || 'Something went wrong. Please try again.'); }
    finally { setSaving(false); }
  };

  const reset = () => { setForm(EMPTY_IR); setNeedsExpert(null); setDone(false); setError(null); setCaseInfo(null); setCaseSteps([]); setRerouteStep(''); setLookingUp(false); };

  if (done) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, padding:24 }}>
        <div style={{ textAlign:'center', maxWidth:400 }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background: needsExpert ? '#EEEDFE' : '#D4EDDA', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            {needsExpert ? <Bell size={32} color="#534AB7" /> : <CheckCircle size={32} color="#3B6D11" />}
          </div>
          <h2 style={{ margin:'0 0 6px', fontSize:20, fontWeight:700 }}>Internal Remake Logged</h2>
          <p style={{ margin:'0 0 20px', fontSize:14, color:'#555' }}><strong>{form.case_number}</strong> · {form.department}</p>
          <div style={{ background: needsExpert ? '#EDE9FE' : '#E8F5E9', border: `2px solid ${needsExpert ? '#534AB7' : '#4CAF50'}`, borderRadius:14, padding:'16px 20px', marginBottom:24, textAlign:'left' }}>
            {needsExpert ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}><Layers size={18} color="#534AB7" /><p style={{ margin:0, fontSize:14, fontWeight:700, color:'#534AB7' }}>Action Required</p></div>
                <p style={{ margin:'0 0 6px', fontSize:14, fontWeight:600, color:'#333', lineHeight:1.5 }}>Move the case to the <strong>Internal Remake — CB Staging Rack</strong>. A Technical Expert will review the case.</p>
                <p style={{ margin:0, fontSize:12, color:'#666' }}>Jeannette & Ryan have been notified by email.</p>
              </>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}><CheckCircle size={18} color="#3B6D11" /><p style={{ margin:0, fontSize:14, fontWeight:700, color:'#3B6D11' }}>Next Step</p></div>
                <p style={{ margin:0, fontSize:14, fontWeight:600, color:'#333' }}>Reroute case to <strong>{rerouteStep || 'selected step'}</strong> and proceed.</p>
              </>
            )}
          </div>
          <button onClick={reset} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#1a1a1a', color:'#fff', border:'none', borderRadius:14, padding:'14px 28px', fontSize:15, fontWeight:600, cursor:'pointer', width:'100%' }}>
            <RotateCcw size={16} /> Log another internal remake
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
      <div style={{ flex:1, paddingBottom:100 }}>
        {error && <div style={{ display:'flex', gap:8, alignItems:'center', background:'#FFF0F0', border:'1px solid #FFC9C9', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#C0392B' }}><AlertCircle size={15} />{error}</div>}

        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div>
            <label style={labelSt}>Case Number *</label>
            <div style={{position:'relative'}}>
              <input value={form.case_number} onChange={e => handleCaseNumber(e.target.value)} placeholder="e.g. 2026-12345" style={{ ...inputSt, fontSize:17, fontWeight:600 }} autoFocus />
              {lookingUp && <div style={{position:'absolute',right:14,top:'50%',width:18,height:18,marginTop:-9,border:'2.5px solid #e0e0e0',borderTopColor:'#534AB7',borderRadius:'50%',animation:'qc-spin 0.7s linear infinite'}}/>}
            </div>
            {caseInfo && (
              <div style={{ marginTop:10, background:'#F0F7FF', border:'1.5px solid #85B7EB', borderRadius:12, padding:'12px 14px' }}>
                <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:'#185FA5', textTransform:'uppercase', letterSpacing:'0.05em' }}>Case Found ✓</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 16px' }}>
                  {[
                    ['Product', caseInfo['Primary Product']],
                    ['Business Unit', caseInfo['Business Unit']],
                    ['Doctor Due', caseInfo['Doctor Due Date'] ? new Date(caseInfo['Doctor Due Date']).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'],
                    ['Ship Date', caseInfo['Ship Date'] ? new Date(caseInfo['Ship Date']).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'],
                    ['Current Step', caseInfo.current_step || '—'],
                    ['Department', caseInfo.dept1 || '—'],
                    caseInfo['Hold Flag'] ? ['Hold', caseInfo['Hold Reason'] || 'On Hold'] : null,
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label} style={{ gridColumn: label === 'Hold' ? 'span 2' : undefined }}>
                      <span style={{ fontSize:11, color:'#666' }}>{label}: </span>
                      <span style={{ fontSize:12, fontWeight:600, color: label === 'Hold' ? '#C0392B' : '#1a1a1a' }}>{value || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <label style={labelSt}>Your Name</label>
            <input value={form.logged_by} onChange={e => set('logged_by', e.target.value)} placeholder="Your name" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Description of Issue</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what went wrong and what needs to be fixed…" rows={3} style={{ ...inputSt, resize:'none', minHeight:80 }} />
          </div>
          <div>
            <label style={labelSt}>Need Technical Expert Assistance? *</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              {[{ val:true, label:'Yes', sub:'Notify tech experts', ac:'#534AB7', ab:'#EEEDFE', abr:'2px solid #534AB7' }, { val:false, label:'No', sub:'No expert needed', ac:'#3B6D11', ab:'#EAF3DE', abr:'2px solid #97C459' }].map(({ val, label, sub, ac, ab, abr }) => {
                const a = needsExpert === val;
                return <button key={String(val)} onClick={() => setNeedsExpert(val)} style={{ background: a ? ab : '#f5f5f5', border: a ? abr : '1.5px solid #e2e2e2', borderRadius:14, padding:'16px', textAlign:'center', cursor:'pointer', transition:'all 0.15s' }}>
                  <p style={{ margin:'0 0 4px', fontSize:20, fontWeight:700, color: a ? ac : '#444' }}>{label}</p>
                  <p style={{ margin:0, fontSize:12, color: a ? ac : '#888' }}>{sub}</p>
                </button>;
              })}
            </div>
            {needsExpert === true && <div style={{ background:'#EDE9FE', border:'1.5px solid #AFA9EC', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'flex-start', gap:8 }}><Layers size={16} color="#534AB7" style={{ flexShrink:0, marginTop:2 }} /><p style={{ margin:0, fontSize:13, color:'#555', lineHeight:1.4 }}>Place the case on the <strong>Internal Remake — CB Staging Rack</strong>. A Technical Expert will review the case.</p></div>}
            {needsExpert === false && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ background:'#EAF3DE', border:'1.5px solid #97C459', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'flex-start', gap:8 }}>
                  <CheckCircle size={16} color="#3B6D11" style={{ flexShrink:0, marginTop:2 }} />
                  <p style={{ margin:0, fontSize:13, color:'#555', lineHeight:1.4 }}>You will reroute this case yourself. Select the step to send it back to below.</p>
                </div>
                {/* Reroute step selector */}
                <div style={{ background:'#EEF2FF', border:'1.5px solid #A5B4FC', borderRadius:12, padding:'14px' }}>
                  <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#4338CA', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>
                    ↩️ Step to reroute case back to <span style={{ color:'#ef4444' }}>*</span>
                  </label>
                  {caseSteps.length === 0 ? (
                    <p style={{ fontSize:12, color:'#6B7280', fontStyle:'italic' }}>
                      {form.case_number.length >= 5 ? 'Loading recipe steps…' : 'Enter a case number first to see recipe steps'}
                    </p>
                  ) : (
                    <>
                      <div style={{ position:'relative' }}>
                        <select
                          value={rerouteStep}
                          onChange={e => setRerouteStep(e.target.value)}
                          style={{ ...inputSt, appearance:'none', WebkitAppearance:'none', paddingRight:36,
                            color: rerouteStep ? '#111' : '#999',
                            borderColor:'#A5B4FC',
                            background: rerouteStep ? '#EEF2FF' : '#fff' }}
                        >
                          <option value="">Select step to reroute back to</option>
                          {caseSteps.map(s => (
                            <option key={s.step_consolidated} value={s.step_consolidated}>
                              {s.step_consolidated}
                            </option>
                          ))}
                        </select>
                        <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#818CF8', fontSize:11 }}>▾</span>
                      </div>
                      {rerouteStep && (
                        <div style={{ marginTop:8, background:'#fff', border:'1px solid #C7D2FE', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#4338CA' }}>
                          ↩️ <strong>{form.case_number}</strong> will be rerouted back to <strong>{rerouteStep}</strong>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ position:'sticky', bottom:0, background:'#fff', borderTop:'1px solid #eee', padding:'14px 0' }}>
        <button onClick={handleSubmit} disabled={!canSubmit || saving} style={{ width:'100%', border:'none', borderRadius:14, padding:'15px', fontSize:15, fontWeight:700, background: canSubmit && !saving ? (needsExpert ? '#534AB7' : '#1a1a1a') : '#e0e0e0', color: canSubmit && !saving ? '#fff' : '#aaa', cursor: canSubmit && !saving ? 'pointer' : 'not-allowed', transition:'all 0.15s' }}>
          {saving ? 'Saving…' : needsExpert === true ? 'Submit & Notify Experts' : 'Submit Internal Remake'}
        </button>
      </div>
    </div>
  );
}

// ── Main Page with Tabs ──────────────────────────────────────────────────────
export default function QCLogPage() {
  const [activeTab, setActiveTab] = useState('qc');

  return (
    <div style={{ minHeight:'100dvh', background:'#fafafa', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #eee', padding:'14px 20px' }}>
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          <h1 style={{ margin:'0 0 12px', fontSize:18, fontWeight:700, color:'#111' }}>Log Entry</h1>
          {/* Tabs */}
          <div style={{ display:'flex', gap:0, background:'#f5f5f5', borderRadius:12, padding:4 }}>
            {[
              { key:'qc',  label:'QC Reject',       icon:'🔍', sub:'ASAP · Repair · Remake' },
              { key:'ir',  label:'Internal Remake',  icon:'🔄', sub:'Department leads' },
            ].map(({ key, label, icon, sub }) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{ flex:1, background: activeTab === key ? '#fff' : 'transparent', border:'none', borderRadius:10, padding:'10px 12px', cursor:'pointer', transition:'all 0.15s', boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                <p style={{ margin:'0 0 2px', fontSize:14, fontWeight: activeTab === key ? 700 : 500, color: activeTab === key ? '#111' : '#888' }}>{icon} {label}</p>
                <p style={{ margin:0, fontSize:11, color: activeTab === key ? '#555' : '#aaa' }}>{sub}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form content */}
      <div style={{ flex:1, padding:'20px 20px 0', maxWidth:520, margin:'0 auto', width:'100%', boxSizing:'border-box', display:'flex', flexDirection:'column' }}>
        {activeTab === 'qc'  && <QCRejectForm />}
        {activeTab === 'ir'  && <InternalRemakeForm />}
      </div>
    </div>
  );
}
