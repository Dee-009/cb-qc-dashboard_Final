import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { CheckCircle, RotateCcw, AlertTriangle, Bell, Layers } from 'lucide-react';

const DEPARTMENTS = [
  'Design', 'Milling', 'Staining', 'Porcelain',
  'Finishing', 'QC', 'Scheduling', 'Case Entry',
  'Model', 'Printing', 'Other',
];

const SUPABASE_URL = 'https://asdunkqodixbhbohxtuq.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZHVua3FvZGl4Ymhib2h4dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDUwNTcsImV4cCI6MjA5MDgyMTA1N30.lStrSSEpwFFk5GuXl2qzh2tr6bLZFY4_x9u6q4FcVeo';
const EXPERTS = [
  { name: 'Jeannette Rubio', email: 'jeannette.rubio@skdla.com' },
  { name: 'Ryan Okon',       email: 'ryan.okon@skdla.com' },
];

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1.5px solid #e2e2e2', borderRadius: 12,
  padding: '14px 16px', fontSize: 15,
  background: '#fff', color: '#111', outline: 'none',
  fontFamily: 'inherit',
};
const labelStyle = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: '#555', marginBottom: 8,
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

export default function LogInternalRemake() {
  const [form, setForm] = useState({
    case_number: '', department: '', logged_by: '',
    ship_date: '', dr_due_date: '', description: '',
  });
  const [needsExpert, setNeedsExpert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const canSubmit = form.case_number.trim() && form.department && needsExpert !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
      const { error: dbErr } = await supabase.from('cb_internal_remake_log').insert([{
        case_number: form.case_number.trim(),
        department: form.department,
        logged_by: form.logged_by || null,
        ship_date: form.ship_date || null,
        dr_due_date: form.dr_due_date || null,
        description: form.description || null,
        needs_expert: needsExpert,
        time_stamp: new Date().toISOString(),
        created_date: new Date().toISOString(),
      }]);
      if (dbErr) throw dbErr;

      if (needsExpert) {
        await supabase.from('cb_staged_cases').insert([{
          case_number: form.case_number.trim(),
          dr_due_date: form.dr_due_date || null,
          department: form.department,
          issue_summary: form.description || null,
          staged_by: form.logged_by || null,
          assigned_expert: null,
          assigned_expert_email: null,
          status: 'Pending',
          staged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
        EXPERTS.forEach(ex => {
          fetch(`${SUPABASE_URL}/functions/v1/notify-expert-staged`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
            body: JSON.stringify({
              case_number: form.case_number.trim(),
              dr_due_date: form.dr_due_date,
              department: form.department,
              issue_summary: form.description,
              staged_by: form.logged_by,
              assigned_expert: ex.name,
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
    setForm({ case_number: '', department: '', logged_by: '', ship_date: '', dr_due_date: '', description: '' });
    setNeedsExpert(null); setDone(false); setError(null);
  };

  if (done) {
    return (
      <div style={{ minHeight: '100dvh', background: needsExpert ? '#F5F3FF' : '#F0F9EB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: needsExpert ? '#EEEDFE' : '#D4EDDA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            {needsExpert ? <Bell size={36} color="#534AB7" /> : <CheckCircle size={36} color="#3B6D11" />}
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700 }}>Internal Remake Logged</h2>
          <p style={{ margin: '0 0 24px', fontSize: 15, color: '#555' }}>
            <strong>{form.case_number}</strong> · {form.department}
          </p>
          <div style={{
            background: needsExpert ? '#EDE9FE' : '#E8F5E9',
            border: `2px solid ${needsExpert ? '#534AB7' : '#4CAF50'}`,
            borderRadius: 16, padding: '20px 24px', marginBottom: 28, textAlign: 'left',
          }}>
            {needsExpert ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Layers size={20} color="#534AB7" />
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#534AB7' }}>Action Required</p>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#333', lineHeight: 1.6 }}>
                  Move the case to the <strong>Internal Remake — C&B Staging Rack</strong>. A Technical Expert will review the case.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                  Jeannette Rubio & Ryan Okon have been notified by email and will claim the case on the MRB Board.
                </p>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <CheckCircle size={20} color="#3B6D11" />
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#3B6D11' }}>Next Step</p>
                </div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#333', lineHeight: 1.5 }}>
                  Get the review from <strong>Final QC</strong>
                </p>
              </>
            )}
          </div>
          <button onClick={reset} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 28px', fontSize: 16, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
            <RotateCcw size={18} /> Log another internal remake
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '16px 20px' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111' }}>Log Internal Remake</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>SKDLA · Crown & Bridge · Department Leads</p>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 20px 140px', maxWidth: 520, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {error && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#FFF0F0', border: '1px solid #FFC9C9', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#C0392B' }}>
            <AlertTriangle size={16} />{error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Case Number *</label>
            <input value={form.case_number} onChange={e => set('case_number', e.target.value)} placeholder="e.g. 2026-12345" style={{ ...inputStyle, fontSize: 18, fontWeight: 600 }} autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Department *</label>
              <div style={{ position: 'relative' }}>
                <select value={form.department} onChange={e => set('department', e.target.value)} style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: 36, color: form.department ? '#111' : '#999' }}>
                  <option value="">Select dept</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#999', fontSize: 11 }}>▾</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Your Name</label>
              <input value={form.logged_by} onChange={e => set('logged_by', e.target.value)} placeholder="Department lead name" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Ship Date</label>
              <input type="date" value={form.ship_date} onChange={e => set('ship_date', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Doctor Due Date</label>
              <input type="date" value={form.dr_due_date} onChange={e => set('dr_due_date', e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description of Issue</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what went wrong and what needs to be fixed…" rows={3} style={{ ...inputStyle, resize: 'none', minHeight: 90 }} />
          </div>

          <div>
            <label style={labelStyle}>Need Technical Expert Assistance? *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[
                { val: true,  label: 'Yes', sub: 'Notify tech experts', activeColor: '#534AB7', activeBg: '#EEEDFE', activeBorder: '2px solid #534AB7' },
                { val: false, label: 'No',  sub: 'No expert needed',   activeColor: '#3B6D11', activeBg: '#EAF3DE', activeBorder: '2px solid #97C459' },
              ].map(({ val, label, sub, activeColor, activeBg, activeBorder }) => {
                const isActive = needsExpert === val;
                return (
                  <button key={String(val)} onClick={() => setNeedsExpert(val)} style={{ background: isActive ? activeBg : '#f5f5f5', border: isActive ? activeBorder : '1.5px solid #e2e2e2', borderRadius: 14, padding: '18px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: isActive ? activeColor : '#444' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: isActive ? activeColor : '#888' }}>{sub}</p>
                  </button>
                );
              })}
            </div>

            {needsExpert === true && (
              <div style={{ background: '#EDE9FE', border: '1.5px solid #AFA9EC', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Layers size={18} color="#534AB7" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#534AB7' }}>Move case to staging rack</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.4 }}>
                    Place the case on the <strong>Internal Remake — C&B Staging Rack</strong>. A Technical Expert will review the case. Both experts will be notified by email.
                  </p>
                </div>
              </div>
            )}
            {needsExpert === false && (
              <div style={{ background: '#EAF3DE', border: '1.5px solid #97C459', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <CheckCircle size={18} color="#3B6D11" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#3B6D11' }}>Get the review from Final QC</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.4 }}>Route the case to Final QC for review and clearance before proceeding.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', padding: '16px 20px' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <button onClick={handleSubmit} disabled={!canSubmit || saving} style={{ width: '100%', border: 'none', borderRadius: 14, padding: '16px', fontSize: 16, fontWeight: 700, background: canSubmit && !saving ? (needsExpert === true ? '#534AB7' : '#1a1a1a') : '#e0e0e0', color: canSubmit && !saving ? '#fff' : '#aaa', cursor: canSubmit && !saving ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
            {saving ? 'Saving…' : needsExpert === true ? 'Submit & Notify Experts' : 'Submit Internal Remake'}
          </button>
        </div>
      </div>
    </div>
  );
}
