'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, Search } from 'lucide-react';
import { format } from 'date-fns';
import type { CbMrbCase } from '@/types';

const REJECT_TYPES = ['Shade','Contour/Anatomy','Contacts/Occlusion','Margin','Surface Finish','Fracture','Wrong Product','Wrong Tooth','Other'];
const FAULTS       = ['Lab','Doctor','Patient','Material','Unknown'];
const DISPOSITIONS = ['Remake','Repair','Ship As Is','Return to Doctor','Scrap','Credit'];

const empty = {
  case_number:'', source:'external', product:'', team:'', technician:'',
  defect_description:'', reject_type:'', fault:'', severity:'Medium',
  disposition:'', root_cause:'', corrective_action:'', dr_notes:'',
  logged_by:'', ship_date:'', dr_due_date:'', needs_expert: false,
};

export default function MrbClient() {
  const [cases, setCases]       = useState<CbMrbCase[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<CbMrbCase | null>(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(empty);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch]     = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('cb_mrb_cases').select('*').order('opened_date', { ascending: false });
    setCases(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const f = (k: string) => (e: any) => setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async () => {
    if (!form.case_number.trim()) return alert('Case number is required');
    setSaving(true);
    const payload: any = {
      ...form,
      case_number: form.case_number.trim(),
      product: form.product || null,
      team: form.team || null,
      technician: form.technician || null,
      defect_description: form.defect_description || null,
      reject_type: form.reject_type || null,
      fault: form.fault || null,
      disposition: form.disposition || null,
      root_cause: form.root_cause || null,
      corrective_action: form.corrective_action || null,
      dr_notes: form.dr_notes || null,
      logged_by: form.logged_by || null,
      ship_date: form.ship_date || null,
      dr_due_date: form.dr_due_date || null,
    };
    const { error } = await supabase.from('cb_mrb_cases').insert(payload);
    if (error) { alert(error.message); setSaving(false); return; }
    setForm(empty);
    setShowForm(false);
    await load();
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('cb_mrb_cases').update({
      status,
      updated_date: new Date().toISOString(),
      ...(status === 'Closed' ? { closed_date: new Date().toISOString().slice(0, 10) } : {}),
    }).eq('id', id);
    setSelected(null);
    await load();
  };

  const filtered = cases.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch = !search || c.case_number.toLowerCase().includes(search.toLowerCase()) || (c.technician ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const severityColor = (s: string) => s === 'High' ? 'var(--fail)' : s === 'Medium' ? 'var(--warn)' : 'var(--pass)';
  const statusClass   = (s: string) => s === 'Open' ? 'badge-open' : s === 'Closed' ? 'badge-closed' : 'badge-progress';

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">MRB Cases</h1>
          <p className="page-sub">Material Review Board · Crown &amp; Bridge · {cases.length} total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> New Case</button>
      </div>

      <div className="filter-bar">
        <div className="search-wrap" style={{ width: 220 }}>
          <Search size={14} className="search-icon" />
          <input className="input" placeholder="Search case # or tech…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {(['all','Open','In Progress','Closed'] as const).map(s => (
          <button key={s} className={`filter-chip${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} results</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="empty-state">Loading…</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Opened</th><th>Case #</th><th>Source</th><th>Product</th>
                <th>Severity</th><th>Reject Type</th><th>Fault</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={9}><div className="empty-state">No cases found.</div></td></tr>
                  : filtered.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c)}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                        {format(new Date(c.opened_date), 'MM/dd/yy')}
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.case_number}</td>
                      <td style={{ textTransform: 'capitalize' }}>{c.source}</td>
                      <td>{c.product ?? '—'}</td>
                      <td><span className={`badge badge-${c.severity.toLowerCase()}`}>{c.severity}</span></td>
                      <td>{c.reject_type ?? '—'}</td>
                      <td>{c.fault ?? '—'}</td>
                      <td><span className={`badge ${statusClass(c.status)}`}>{c.status}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {c.status === 'Open'        && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => updateStatus(c.id, 'In Progress')}>Start</button>}
                          {c.status === 'In Progress' && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => updateStatus(c.id, 'Closed')}>Close</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>MRB — {selected.case_number}</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 13 }}>
              {[
                ['Status', <span className={`badge ${statusClass(selected.status)}`}>{selected.status}</span>],
                ['Severity', <span className={`badge badge-${selected.severity.toLowerCase()}`}>{selected.severity}</span>],
                ['Source', selected.source],
                ['Product', selected.product ?? '—'],
                ['Team', selected.team ?? '—'],
                ['Technician', selected.technician ?? '—'],
                ['Reject Type', selected.reject_type ?? '—'],
                ['Fault', selected.fault ?? '—'],
                ['Ship Date', selected.ship_date ?? '—'],
                ['Dr Due Date', selected.dr_due_date ?? '—'],
                ['Needs Expert', selected.needs_expert ? 'Yes' : 'No'],
                ['Logged By', selected.logged_by ?? '—'],
              ].map(([label, val]) => (
                <div key={String(label)}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                  <div>{val}</div>
                </div>
              ))}
              {selected.defect_description && (
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2 }}>Defect Description</div>
                  <div style={{ color: 'var(--text-muted)' }}>{selected.defect_description}</div>
                </div>
              )}
              {selected.dr_notes && (
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2 }}>Dr Notes</div>
                  <div style={{ color: 'var(--text-muted)' }}>{selected.dr_notes}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {selected.status === 'Open' && <button className="btn btn-ghost" onClick={() => updateStatus(selected.id, 'In Progress')}>Mark In Progress</button>}
              {selected.status === 'In Progress' && <button className="btn btn-ghost" onClick={() => updateStatus(selected.id, 'Closed')}>Close Case</button>}
              {selected.status === 'Closed' && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Closed {selected.closed_date ? format(new Date(selected.closed_date), 'MM/dd/yy') : ''}</span>}
            </div>
          </div>
        </div>
      )}

      {/* New case modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 580 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>New MRB Case</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="label">Case Number *</label><input className="input" value={form.case_number} onChange={f('case_number')} autoFocus /></div>
              <div><label className="label">Source</label>
                <select className="input" value={form.source} onChange={f('source')}>
                  <option value="external">External</option><option value="internal">Internal</option>
                </select>
              </div>
              <div><label className="label">Product</label><input className="input" value={form.product} onChange={f('product')} /></div>
              <div><label className="label">Team</label><input className="input" value={form.team} onChange={f('team')} /></div>
              <div><label className="label">Technician</label><input className="input" value={form.technician} onChange={f('technician')} /></div>
              <div><label className="label">Severity</label>
                <select className="input" value={form.severity} onChange={f('severity')}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
              <div><label className="label">Reject Type</label>
                <select className="input" value={form.reject_type} onChange={f('reject_type')}>
                  <option value="">— Select —</option>
                  {REJECT_TYPES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div><label className="label">Fault</label>
                <select className="input" value={form.fault} onChange={f('fault')}>
                  <option value="">— Select —</option>
                  {FAULTS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div><label className="label">Disposition</label>
                <select className="input" value={form.disposition} onChange={f('disposition')}>
                  <option value="">— Select —</option>
                  {DISPOSITIONS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div><label className="label">Ship Date</label><input className="input" type="date" value={form.ship_date} onChange={f('ship_date')} /></div>
              <div><label className="label">Dr Due Date</label><input className="input" type="date" value={form.dr_due_date} onChange={f('dr_due_date')} /></div>
              <div><label className="label">Logged By</label><input className="input" value={form.logged_by} onChange={f('logged_by')} /></div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Defect Description</label><textarea className="input" value={form.defect_description} onChange={f('defect_description')} /></div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Dr Notes</label><textarea className="input" value={form.dr_notes} onChange={f('dr_notes')} /></div>
              <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="needs_expert" checked={form.needs_expert} onChange={f('needs_expert')} />
                <label htmlFor="needs_expert" style={{ fontSize: 13, cursor: 'pointer' }}>Needs Expert Review</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Case'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
