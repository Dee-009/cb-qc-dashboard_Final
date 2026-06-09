import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { CheckCircle, RotateCcw, AlertTriangle, Bell, Layers } from 'lucide-react';

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
    setForm({ case_number: '', department: '', logged_by: '', ship_date: '', dr_due_date: '', description: '' });
    setNeedsExpert(null); setDone(false); setError(null);
  };

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ minHeight: '100dvh', background: needsExpert ? '#F5F3FF' : '#F0F9EB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 500, width: '100%' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: needsExpert ? '#EEEDFE' : '#D4EDDA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            {needsExpert ? <Bell size={40} color="#534AB7" /> : <CheckCircle size={40} color="#3B6D11" />}
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 700 }}>Internal Remake Logged</h2>
          <p style={{ margin: '0 0 28px', fontSize: 16, color: '#555' }}>
            <strong>{form.case_number}</strong> · {form.department}
          </p>
          <div style={{ background: needsExpert ? '#EDE9FE' : '#E8F5E9', border: `2px solid ${needsExpert ? '#534AB7' : '#4CAF50'}`, borderRadius: 18, padding: '24px 28px', marginBottom: 32, textAlign: 'left' }}>
            {needsExpert ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Layers size={22} color="#534AB7" />
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#534AB7' }}>Action Required</p>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 600, color: '#333', lineHeight: 1.6 }}>
                  Move the case to the <strong>Internal Remake — C&amp;B Staging Rack</strong>. A Technical Expert will review the case.
                </p>
                <p style={{ margin: 0, fontSize: 14, color: '#666' }}>
                  Jeannette Rubio &amp; Ryan Okon have been notified by email and will claim the case on the MRB Board.
                </p>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <CheckCircle size={22} color="#3B6D11" />
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#3B6D11' }}>Next Step</p>
                </div>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#333', lineHeight: 1.5 }}>
                  Get the review from <strong>Final QC</strong>
                </p>
              </>
            )}
          </div>
          <button onClick={reset} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 16, padding: '18px 32px', fontSize: 17, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
            <RotateCcw size={20} /> Log another internal remake
          </button>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '20px 32px' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111' }}>Log Internal Remake</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#888' }}>SKDLA · Crown &amp; Bridge · Department Leads</p>
      </div>

      {/* Form body */}
      <div style={{ flex: 1, padding: '32px', paddingBottom: 140, maxWidth: 680, width: '100%', boxSizing: 'border-box' }}>
        {error && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#FFF0F0', border: '1px solid #FFC9C9', borderRadius: 14, padding: '14px 18px', marginBottom: 24, fontSize: 15, color: '#C0392B' }}>
            <AlertTriangle size={18} />{error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Case Number */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Case Number *</label>
            <input
              value={form.case_number}
              onChange={e => set('case_number', e.target.value)}
              placeholder="e.g. 2026-12345"
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e2e2', borderRadius: 14, padding: '18px 20px', fontSize: 20, fontWeight: 700, background: '#fff', color: '#111', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>

          {/* Department + Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Department *</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={form.department}
                  onChange={e => set('department', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e2e2', borderRadius: 14, padding: '16px 40px 16px 18px', fontSize: 16, background: '#fff', color: form.department ? '#111' : '#999', outline: 'none', fontFamily: 'inherit', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#999', fontSize: 13 }}>▾</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Name</label>
              <input
                value={form.logged_by}
                onChange={e => set('logged_by', e.target.value)}
                placeholder="Department lead name"
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e2e2', borderRadius: 14, padding: '16px 18px', fontSize: 16, background: '#fff', color: '#111', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {/* Ship Date + Dr Due */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ship Date</label>
              <input type="date" value={form.ship_date} onChange={e => set('ship_date', e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e2e2', borderRadius: 14, padding: '16px 18px', fontSize: 16, background: '#fff', color: '#111', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Doctor Due Date</label>
              <input type="date" value={form.dr_due_date} onChange={e => set('dr_due_date', e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e2e2', borderRadius: 14, padding: '16px 18px', fontSize: 16, background: '#fff', color: '#111', outline: 'none', fontFamily: 'inherit' }} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description of Issue</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Describe what went wrong and what needs to be fixed…"
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e2e2', borderRadius: 14, padding: '16px 18px', fontSize: 16, background: '#fff', color: '#111', outline: 'none', fontFamily: 'inherit', resize: 'none', minHeight: 110 }}
            />
          </div>

          {/* Expert toggle */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Need Technical Expert Assistance? *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {[
                { val: true,  label: 'Yes', sub: 'Notify tech experts', ac: '#534AB7', ab: '#EEEDFE', abr: '2px solid #534AB7' },
                { val: false, label: 'No',  sub: 'No expert needed',    ac: '#3B6D11', ab: '#EAF3DE', abr: '2px solid #97C459' },
              ].map(({ val, label, sub, ac, ab, abr }) => {
                const active = needsExpert === val;
                return (
                  <button key={String(val)} onClick={() => setNeedsExpert(val)} style={{ background: active ? ab : '#f5f5f5', border: active ? abr : '1.5px solid #e2e2e2', borderRadius: 16, padding: '22px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 700, color: active ? ac : '#444' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 14, color: active ? ac : '#888' }}>{sub}</p>
                  </button>
                );
              })}
            </div>

            {needsExpert === true && (
              <div style={{ background: '#EDE9FE', border: '1.5px solid #AFA9EC', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Layers size={20} color="#534AB7" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#534AB7' }}>Move case to staging rack</p>
                  <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.5 }}>
                    Place the case on the <strong>Internal Remake — C&amp;B Staging Rack</strong>. A Technical Expert will review the case. Both experts will be notified by email.
                  </p>
                </div>
              </div>
            )}
            {needsExpert === false && (
              <div style={{ background: '#EAF3DE', border: '1.5px solid #97C459', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <CheckCircle size={20} color="#3B6D11" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#3B6D11' }}>Get the review from Final QC</p>
                  <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.5 }}>Route the case to Final QC for review and clearance before proceeding.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', padding: '20px 32px' }}>
        <div style={{ maxWidth: 680 }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            style={{ width: '100%', border: 'none', borderRadius: 16, padding: '20px', fontSize: 18, fontWeight: 700, background: canSubmit && !saving ? (needsExpert === true ? '#534AB7' : '#1a1a1a') : '#e0e0e0', color: canSubmit && !saving ? '#fff' : '#aaa', cursor: canSubmit && !saving ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
          >
            {saving ? 'Saving…' : needsExpert === true ? 'Submit & Notify Experts' : 'Submit Internal Remake'}
          </button>
        </div>
      </div>
    </div>
  );
}
