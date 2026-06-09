import React, { useState, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';
import { CheckCircle, RotateCcw, AlertTriangle, Bell, Layers, Search, Loader2 } from 'lucide-react';

const DEPARTMENTS = [
  'Design', 'Milling', 'Staining', 'Porcelain',
  'Finishing', 'QC', 'Scheduling', 'Case Entry',
  'Model', 'Printing', 'Other',
];

const SUPABASE_URL = 'https://asdunkqodixbhbohxtuq.supabase.co';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const EXPERTS = [
  { name: 'Jeannette Rubio', email: 'jeannette.rubio@skdla.com' },
  { name: 'Ryan Okon',       email: 'ryan.okon@skdla.com' },
];

const inp = { width:'100%', boxSizing:'border-box', border:'1.5px solid #e2e2e2', borderRadius:12, padding:'14px 16px', fontSize:15, background:'#fff', color:'#111', outline:'none', fontFamily:'inherit' };
const lbl = { display:'block', fontSize:12, fontWeight:700, color:'#555', marginBottom:7, textTransform:'uppercase', letterSpacing:'0.06em' };

export default function LogInternalRemake() {
  const [form, setForm]           = useState({ case_number:'', department:'', logged_by:'', ship_date:'', dr_due_date:'', description:'' });
  const [needsExpert, setNeedsExpert] = useState(null);
  const [caseInfo, setCaseInfo]   = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [done, setDone]           = useState(false);
  const lookupTimer               = useRef(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCaseNumber = (val) => {
    set('case_number', val);
    setCaseInfo(null);
    clearTimeout(lookupTimer.current);
    if (val.trim().length >= 5) {
      lookupTimer.current = setTimeout(async () => {
        setLookingUp(true);
        try {
          const [caseRes, wfRes] = await Promise.all([
            supabase.from('Cases')
              .select('"Case Number","Business Unit","Primary Product","Doctor Due Date","Ship Date","Hold Flag","Hold Reason"')
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
            if (combined['Ship Date'])       set('ship_date',   combined['Ship Date'].slice(0, 10));
            if (combined.dept1)              set('department',  combined.dept1);
          }
        } catch(e) { console.error('Lookup error:', e); }
        finally { setLookingUp(false); }
      }, 600);
    }
  };

  const canSubmit = form.case_number.trim() && form.department && needsExpert !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
      const { error: dbErr } = await supabase.from('cb_internal_remake_log').insert([{
        case_number:  form.case_number.trim(),
        department:   form.department,
        logged_by:    form.logged_by || null,
        ship_date:    form.ship_date || null,
        dr_due_date:  form.dr_due_date || null,
        description:  form.description || null,
        needs_expert: needsExpert,
        time_stamp:   new Date().toISOString(),
        created_date: new Date().toISOString(),
      }]);
      if (dbErr) throw dbErr;

      if (needsExpert) {
        await supabase.from('cb_staged_cases').insert([{
          case_number:           form.case_number.trim(),
          dr_due_date:           form.dr_due_date || null,
          ship_date:             form.ship_date || null,
          department:            form.department,
          issue_summary:         form.description || null,
          staged_by:             form.logged_by || null,
          assigned_expert:       null,
          assigned_expert_email: null,
          status:                'Pending',
          staged_at:             new Date().toISOString(),
          updated_at:            new Date().toISOString(),
        }]);
        EXPERTS.forEach(ex => {
          fetch(`${SUPABASE_URL}/functions/v1/notify-expert-staged`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
            body: JSON.stringify({
              case_number:           form.case_number.trim(),
              dr_due_date:           form.dr_due_date,
              department:            form.department,
              issue_summary:         form.description,
              staged_by:             form.logged_by,
              assigned_expert:       ex.name,
              assigned_expert_email: ex.email,
            }),
          }).catch(() => {});
        });
      }
      setDone(true);
    } catch (e) {
      setError(e.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setForm({ case_number:'', department:'', logged_by:'', ship_date:'', dr_due_date:'', description:'' });
    setNeedsExpert(null); setCaseInfo(null); setDone(false); setError(null);
  };

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ minHeight:'100dvh', background: needsExpert ? '#F5F3FF' : '#F0F9EB', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, fontFamily:'system-ui, sans-serif' }}>
        <div style={{ textAlign:'center', maxWidth:480, width:'100%' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background: needsExpert ? '#EEEDFE' : '#D4EDDA', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
            {needsExpert ? <Bell size={36} color="#534AB7" /> : <CheckCircle size={36} color="#3B6D11" />}
          </div>
          <h2 style={{ margin:'0 0 6px', fontSize:24, fontWeight:700 }}>Internal Remake Logged</h2>
          <p style={{ margin:'0 0 24px', fontSize:15, color:'#555' }}><strong>{form.case_number}</strong> · {form.department}</p>
          <div style={{ background: needsExpert ? '#EDE9FE' : '#E8F5E9', border:`2px solid ${needsExpert ? '#534AB7' : '#4CAF50'}`, borderRadius:16, padding:'20px 24px', marginBottom:28, textAlign:'left' }}>
            {needsExpert ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <Layers size={20} color="#534AB7" />
                  <p style={{ margin:0, fontSize:15, fontWeight:700, color:'#534AB7' }}>Action Required</p>
                </div>
                <p style={{ margin:'0 0 8px', fontSize:15, fontWeight:600, color:'#333', lineHeight:1.6 }}>
                  Move the case to the <strong>Internal Remake — C&amp;B Staging Rack</strong>.
                </p>
                <p style={{ margin:0, fontSize:13, color:'#666' }}>Jeannette Rubio &amp; Ryan Okon have been notified by email.</p>
              </>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <CheckCircle size={20} color="#3B6D11" />
                  <p style={{ margin:0, fontSize:15, fontWeight:700, color:'#3B6D11' }}>Next Step</p>
                </div>
                <p style={{ margin:0, fontSize:15, fontWeight:600, color:'#333', lineHeight:1.5 }}>Get the review from <strong>Final QC</strong></p>
              </>
            )}
          </div>
          <button onClick={reset} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#1a1a1a', color:'#fff', border:'none', borderRadius:14, padding:'16px 28px', fontSize:16, fontWeight:600, cursor:'pointer', width:'100%' }}>
            <RotateCcw size={18} /> Log another internal remake
          </button>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100dvh', background:'#fafafa', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #eee', padding:'16px 24px' }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:'#111' }}>Log Internal Remake</h1>
          <p style={{ margin:'2px 0 0', fontSize:13, color:'#888' }}>SKDLA · Crown &amp; Bridge · Department Leads</p>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, padding:'24px', paddingBottom:120, maxWidth:560, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>
        {error && (
          <div style={{ display:'flex', gap:8, alignItems:'center', background:'#FFF0F0', border:'1px solid #FFC9C9', borderRadius:12, padding:'12px 16px', marginBottom:20, fontSize:14, color:'#C0392B' }}>
            <AlertTriangle size={16} />{error}
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* Case Number with lookup */}
          <div>
            <label style={lbl}>Case Number *</label>
            <div style={{ position:'relative' }}>
              <input
                value={form.case_number}
                onChange={e => handleCaseNumber(e.target.value)}
                placeholder="e.g. 2026-12345"
                autoFocus
                style={{ ...inp, fontSize:18, fontWeight:600, paddingRight:44 }}
              />
              <div style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'#aaa' }}>
                {lookingUp ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} /> : <Search size={16} />}
              </div>
            </div>

            {/* Case info card */}
            {caseInfo && (
              <div style={{ marginTop:10, background:'#EFF6FF', border:'1.5px solid #BFDBFE', borderRadius:12, padding:'14px 16px' }}>
                <p style={{ margin:'0 0 10px', fontSize:12, fontWeight:700, color:'#2563EB', textTransform:'uppercase', letterSpacing:'0.06em' }}>Case Found ✓</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px' }}>
                  {[
                    ['Product',      caseInfo['Primary Product']],
                    ['Business Unit', caseInfo['Business Unit']],
                    ['Doctor Due',   caseInfo['Doctor Due Date'] ? new Date(caseInfo['Doctor Due Date']).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'],
                    ['Ship Date',    caseInfo['Ship Date'] ? new Date(caseInfo['Ship Date']).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'],
                    ['Current Step', caseInfo.current_step || '—'],
                    ['Department',   caseInfo.dept1 || '—'],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p style={{ margin:'0 0 2px', fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</p>
                      <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#1E3A5F' }}>{val || '—'}</p>
                    </div>
                  ))}
                </div>
                {caseInfo['Hold Flag'] && (
                  <div style={{ marginTop:10, background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:8, padding:'8px 12px', fontSize:13, color:'#92400E', fontWeight:600 }}>
                    ⚠️ On Hold: {caseInfo['Hold Reason'] || 'Hold reason not specified'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Department + Name */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <label style={lbl}>Department *</label>
              <div style={{ position:'relative' }}>
                <select value={form.department} onChange={e => set('department', e.target.value)}
                  style={{ ...inp, appearance:'none', WebkitAppearance:'none', paddingRight:36, color: form.department ? '#111' : '#999', cursor:'pointer' }}>
                  <option value="">Select dept</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#999', fontSize:11 }}>▾</span>
              </div>
            </div>
            <div>
              <label style={lbl}>Your Name</label>
              <input value={form.logged_by} onChange={e => set('logged_by', e.target.value)}
                placeholder="Department lead name" style={inp} />
            </div>
          </div>

          {/* Dates */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <label style={lbl}>Ship Date</label>
              <input type="date" value={form.ship_date} onChange={e => set('ship_date', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Doctor Due Date</label>
              <input type="date" value={form.dr_due_date} onChange={e => set('dr_due_date', e.target.value)} style={inp} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>Description of Issue</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Describe what went wrong and what needs to be fixed…"
              rows={3} style={{ ...inp, resize:'none', minHeight:90 }} />
          </div>

          {/* Expert toggle */}
          <div>
            <label style={lbl}>Need Technical Expert Assistance? *</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              {[
                { val:true,  label:'Yes', sub:'Notify tech experts', ac:'#534AB7', ab:'#EEEDFE', abr:'2px solid #534AB7' },
                { val:false, label:'No',  sub:'No expert needed',    ac:'#3B6D11', ab:'#EAF3DE', abr:'2px solid #97C459' },
              ].map(({ val, label, sub, ac, ab, abr }) => {
                const active = needsExpert === val;
                return (
                  <button key={String(val)} onClick={() => setNeedsExpert(val)} style={{ background: active ? ab : '#f5f5f5', border: active ? abr : '1.5px solid #e2e2e2', borderRadius:14, padding:'18px 16px', textAlign:'center', cursor:'pointer', transition:'all 0.15s' }}>
                    <p style={{ margin:'0 0 4px', fontSize:22, fontWeight:700, color: active ? ac : '#444' }}>{label}</p>
                    <p style={{ margin:0, fontSize:12, color: active ? ac : '#888' }}>{sub}</p>
                  </button>
                );
              })}
            </div>
            {needsExpert === true && (
              <div style={{ background:'#EDE9FE', border:'1.5px solid #AFA9EC', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:10 }}>
                <Layers size={18} color="#534AB7" style={{ flexShrink:0, marginTop:2 }} />
                <div>
                  <p style={{ margin:'0 0 4px', fontSize:14, fontWeight:700, color:'#534AB7' }}>Move case to staging rack</p>
                  <p style={{ margin:0, fontSize:13, color:'#555', lineHeight:1.4 }}>
                    Place on the <strong>Internal Remake — C&amp;B Staging Rack</strong>. Both experts will be notified by email.
                  </p>
                </div>
              </div>
            )}
            {needsExpert === false && (
              <div style={{ background:'#EAF3DE', border:'1.5px solid #97C459', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:10 }}>
                <CheckCircle size={18} color="#3B6D11" style={{ flexShrink:0, marginTop:2 }} />
                <div>
                  <p style={{ margin:'0 0 4px', fontSize:14, fontWeight:700, color:'#3B6D11' }}>Get the review from Final QC</p>
                  <p style={{ margin:0, fontSize:13, color:'#555', lineHeight:1.4 }}>Route the case to Final QC for review and clearance.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #eee', padding:'16px 24px' }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          <button onClick={handleSubmit} disabled={!canSubmit || saving} style={{ width:'100%', border:'none', borderRadius:14, padding:'16px', fontSize:16, fontWeight:700, background: canSubmit && !saving ? (needsExpert === true ? '#534AB7' : '#1a1a1a') : '#e0e0e0', color: canSubmit && !saving ? '#fff' : '#aaa', cursor: canSubmit && !saving ? 'pointer' : 'not-allowed', transition:'all 0.15s' }}>
            {saving ? 'Saving…' : needsExpert === true ? 'Submit & Notify Experts' : 'Submit Internal Remake'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
