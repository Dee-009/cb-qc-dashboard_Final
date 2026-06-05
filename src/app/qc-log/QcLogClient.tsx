'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, Search } from 'lucide-react';
import { format } from 'date-fns';
import type { CbQcLog } from '@/types';

const REJECT_TYPES = ['Shade','Contour/Anatomy','Contacts/Occlusion','Margin','Surface Finish','Fracture','Wrong Product','Wrong Tooth','Missing Item','Screw Access','Other'];
const DEPTS = ['Design','Milling','Staining','Porcelain','Finishing','QC','Scheduling','Other'];

const empty = {
  case_number:'', technician:'', team:'', qc_reject:'Pass',
  reject_type:'', reject_details:'', route_back_dept:'', route_back_details:'',
  appointment_reschedule_needed:'No', new_date_days_needed:'', rush_required:'No',
  ship_date:'', comments:'', reviewed_by:'',
};

export default function QcLogClient() {
  const [logs, setLogs]         = useState<CbQcLog[]>([]);
  const [teams, setTeams]       = useState<string[]>([]);
  const [techs, setTechs]       = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(empty);
  const [search, setSearch]     = useState('');
  const [filterResult, setFilterResult] = useState<'all'|'Pass'|'Fail'>('all');

  const load = async () => {
    setLoading(true);
    const [qcRes, teamRes, techRes] = await Promise.all([
      supabase.from('cb_qc_logs').select('*').eq('is_sample', false).order('created_date', { ascending: false }).limit(500),
      supabase.from('cb_teams').select('name').eq('active', true).order('sort_order'),
      supabase.from('cb_employees').select('name').eq('active', true).order('name'),
    ]);
    setLogs(qcRes.data ?? []);
    setTeams((teamRes.data ?? []).map((t: any) => t.name));
    setTechs((techRes.data ?? []).map((e: any) => e.name));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const f = (k: string) => (e: any) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const save = async () => {
    if (!form.case_number.trim()) return alert('Case number is required');
    setSaving(true);
    const payload: any = {
      case_number: form.case_number.trim(),
      technician: form.technician || null,
      team: form.team || null,
      qc_reject: form.qc_reject,
      reject_type: form.qc_reject === 'Fail' ? form.reject_type || null : null,
      reject_details: form.qc_reject === 'Fail' ? form.reject_details || null : null,
      route_back_dept: form.qc_reject === 'Fail' ? form.route_back_dept || null : null,
      route_back_details: form.qc_reject === 'Fail' ? form.route_back_details || null : null,
      appointment_reschedule_needed: form.appointment_reschedule_needed,
      new_date_days_needed: form.new_date_days_needed ? parseFloat(form.new_date_days_needed) : null,
      rush_required: form.rush_required,
      ship_date: form.ship_date || null,
      comments: form.comments || null,
      reviewed_by: form.reviewed_by || null,
      time_stamp: new Date().toISOString(),
    };
    const { error } = await supabase.from('cb_qc_logs').insert(payload);
    if (error) { alert(error.message); setSaving(false); return; }
    setForm(empty);
    setShowForm(false);
    await load();
    setSaving(false);
  };

  const filtered = logs.filter(l => {
    const matchSearch = !search || (l.case_number ?? '').toLowerCase().includes(search.toLowerCase()) || (l.technician ?? '').toLowerCase().includes(search.toLowerCase());
    const matchResult = filterResult === 'all' || l.qc_reject === filterResult;
    return matchSearch && matchResult;
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">QC Log</h1>
          <p className="page-sub">Crown &amp; Bridge inspection entries · {logs.length.toLocaleString()} total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> New Entry</button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-wrap" style={{ width: 220 }}>
          <Search size={14} className="search-icon" />
          <input className="input" placeholder="Search case # or tech…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {(['all','Pass','Fail'] as const).map(r => (
          <button key={r} className={`filter-chip${filterResult === r ? ' active' : ''}`} onClick={() => setFilterResult(r)}>
            {r === 'all' ? 'All' : r}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} results</span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="empty-state">Loading…</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Date</th><th>Case #</th><th>Technician</th><th>Team</th>
                <th>Result</th><th>Reject Type</th><th>Route Back</th><th>Rush</th><th>Reviewed By</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={9}><div className="empty-state">No entries found.</div></td></tr>
                  : filtered.map(l => (
                    <tr key={l.id}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                        {l.created_date ? format(new Date(l.created_date), 'MM/dd/yy') : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{l.case_number ?? '—'}</td>
                      <td>{l.technician ?? '—'}</td>
                      <td>{l.team ?? '—'}</td>
                      <td><span className={`badge badge-${(l.qc_reject ?? '').toLowerCase()}`}>{l.qc_reject ?? '—'}</span></td>
                      <td>{l.reject_type ?? '—'}</td>
                      <td>{l.route_back_dept ?? '—'}</td>
                      <td>{l.rush_required === 'Yes' ? <span className="badge badge-fail">Yes</span> : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{l.reviewed_by ?? '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>New QC Entry</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">Case Number *</label>
                <input className="input" value={form.case_number} onChange={f('case_number')} placeholder="e.g. 240001234" autoFocus />
              </div>
              <div>
                <label className="label">Technician</label>
                <select className="input" value={form.technician} onChange={f('technician')}>
                  <option value="">— Select —</option>
                  {techs.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Team</label>
                <select className="input" value={form.team} onChange={f('team')}>
                  <option value="">— Select —</option>
                  {teams.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">QC Result *</label>
                <select className="input" value={form.qc_reject} onChange={f('qc_reject')}>
                  <option>Pass</option><option>Fail</option>
                </select>
              </div>
              <div>
                <label className="label">Ship Date</label>
                <input className="input" type="date" value={form.ship_date} onChange={f('ship_date')} />
              </div>

              {form.qc_reject === 'Fail' && <>
                <div>
                  <label className="label">Reject Type</label>
                  <select className="input" value={form.reject_type} onChange={f('reject_type')}>
                    <option value="">— Select —</option>
                    {REJECT_TYPES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Route Back Dept</label>
                  <select className="input" value={form.route_back_dept} onChange={f('route_back_dept')}>
                    <option value="">— Select —</option>
                    {DEPTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Reject Details</label>
                  <textarea className="input" value={form.reject_details} onChange={f('reject_details')} placeholder="Describe the defect…" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Route Back Details</label>
                  <textarea className="input" value={form.route_back_details} onChange={f('route_back_details')} placeholder="Instructions for the department…" />
                </div>
                <div>
                  <label className="label">Appt Reschedule?</label>
                  <select className="input" value={form.appointment_reschedule_needed} onChange={f('appointment_reschedule_needed')}>
                    <option>No</option><option>Yes</option>
                  </select>
                </div>
                <div>
                  <label className="label">Days Needed</label>
                  <input className="input" type="number" value={form.new_date_days_needed} onChange={f('new_date_days_needed')} placeholder="0" />
                </div>
                <div>
                  <label className="label">Rush Required?</label>
                  <select className="input" value={form.rush_required} onChange={f('rush_required')}>
                    <option>No</option><option>Yes</option>
                  </select>
                </div>
              </>}

              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">Comments</label>
                <textarea className="input" value={form.comments} onChange={f('comments')} placeholder="Optional notes…" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">Reviewed By</label>
                <input className="input" value={form.reviewed_by} onChange={f('reviewed_by')} placeholder="Your name" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
