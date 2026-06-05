'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X } from 'lucide-react';
import type { CbEmployee, CbTeam } from '@/types';

export default function EmployeesClient() {
  const [employees, setEmployees] = useState<CbEmployee[]>([]);
  const [teams, setTeams]         = useState<CbTeam[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showEmp, setShowEmp]     = useState(false);
  const [showTeam, setShowTeam]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [empForm, setEmpForm]     = useState({ name:'', team_id:'', department:'', role:'', email:'' });
  const [teamForm, setTeamForm]   = useState({ name:'', sort_order:'0' });

  const load = async () => {
    setLoading(true);
    const [e, t] = await Promise.all([
      supabase.from('cb_employees').select('*').order('name'),
      supabase.from('cb_teams').select('*').order('sort_order'),
    ]);
    setEmployees(e.data ?? []);
    setTeams(t.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveEmp = async () => {
    if (!empForm.name.trim()) return alert('Name required');
    setSaving(true);
    const { error } = await (supabase.from('cb_employees') as any).insert({
      name: empForm.name.trim(),
      team_id: empForm.team_id || null,
      department: empForm.department,
      role: empForm.role,
      email: empForm.email || null,
    });
    if (error) { alert(error.message); setSaving(false); return; }
    setEmpForm({ name:'', team_id:'', department:'', role:'', email:'' });
    setShowEmp(false);
    await load();
    setSaving(false);
  };

  const saveTeam = async () => {
    if (!teamForm.name.trim()) return alert('Team name required');
    setSaving(true);
    const { error } = await (supabase.from('cb_teams') as any).insert({
      name: teamForm.name.trim(),
      sort_order: parseInt(teamForm.sort_order) || 0,
    });
    if (error) { alert(error.message); setSaving(false); return; }
    setTeamForm({ name:'', sort_order:'0' });
    setShowTeam(false);
    await load();
    setSaving(false);
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from('cb_employees').update({ active: !active }).eq('id', id);
    await load();
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-sub">Crown &amp; Bridge technicians &amp; teams</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setShowTeam(true)}><Plus size={14} /> Add Team</button>
          <button className="btn btn-primary" onClick={() => setShowEmp(true)}><Plus size={14} /> Add Employee</button>
        </div>
      </div>

      {/* Teams pills */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>TEAMS ({teams.length})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {teams.length === 0
            ? <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>No teams yet — add one above.</span>
            : teams.map(t => (
              <span key={t.id} style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '4px 12px', fontSize: 12, color: t.active ? 'var(--text)' : 'var(--text-dim)',
              }}>
                {t.name}
              </span>
            ))
          }
        </div>
      </div>

      {/* Employees table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="empty-state">Loading…</div> : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Team</th><th>Department</th><th>Role</th><th>Email</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {employees.length === 0
                ? <tr><td colSpan={7}><div className="empty-state">No employees yet.</div></td></tr>
                : employees.map(e => {
                  const team = teams.find(t => t.id === e.team_id);
                  return (
                    <tr key={e.id} style={{ opacity: e.active ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 600 }}>{e.name}</td>
                      <td>{team?.name ?? '—'}</td>
                      <td>{e.department || '—'}</td>
                      <td>{e.role || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.email ?? '—'}</td>
                      <td><span className={`badge badge-${e.active ? 'active' : 'inactive'}`}>{e.active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => toggle(e.id, e.active)}>
                          {e.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        )}
      </div>

      {/* Add Employee modal */}
      {showEmp && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Add Employee</span>
              <button onClick={() => setShowEmp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Full Name *</label><input className="input" value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
              <div><label className="label">Team</label>
                <select className="input" value={empForm.team_id} onChange={e => setEmpForm(f => ({ ...f, team_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div><label className="label">Department</label><input className="input" value={empForm.department} onChange={e => setEmpForm(f => ({ ...f, department: e.target.value }))} /></div>
              <div><label className="label">Role</label><input className="input" value={empForm.role} onChange={e => setEmpForm(f => ({ ...f, role: e.target.value }))} /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={empForm.email} onChange={e => setEmpForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowEmp(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEmp} disabled={saving}>{saving ? 'Saving…' : 'Add Employee'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Team modal */}
      {showTeam && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Add Team</span>
              <button onClick={() => setShowTeam(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label className="label">Team Name *</label><input className="input" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
              <div><label className="label">Sort Order</label><input className="input" type="number" value={teamForm.sort_order} onChange={e => setTeamForm(f => ({ ...f, sort_order: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowTeam(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTeam} disabled={saving}>{saving ? 'Saving…' : 'Add Team'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
