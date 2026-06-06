import { useState, useEffect } from 'react';
import { Shield, User, UserCheck, UserX, Search, RefreshCw } from 'lucide-react';
import { getDatabase, type UserDocType } from '../db/database';
import { syncWorker } from '../db/sync';
import { useToast } from './ToastNotification';
import { API_URL } from '../config';

interface UserAdminProps {
  user: { id: string; email: string; name: string; role: string };
}

const ROLES = ['ADMIN', 'AUDITOR', 'CASHIER'] as const;

export default function UserAdmin({ user }: UserAdminProps) {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserDocType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadUsers = async () => {
    const db = await getDatabase();
    const docs = await db.users.find().exec();
    setUsers(docs.map(d => d.toJSON()).sort((a, b) => a.name.localeCompare(b.name)));
  };

  useEffect(() => { loadUsers(); }, []);

  const updateRole = async (userId: string, newRole: string) => {
    setSavingId(userId);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Error');
      addToast({ type: 'success', title: 'Rol actualizado', message: `Usuario actualizado a ${newRole}` });
      await loadUsers();
      syncWorker.sync();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const disableUser = async (userId: string) => {
    setSavingId(userId);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/auth/users/${userId}/disable`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Error');
      addToast({ type: 'success', title: 'Usuario desactivado', message: 'Cuenta desactivada correctamente' });
      await loadUsers();
      syncWorker.sync();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="view-container-layout" style={{ padding: '24px', gap: '20px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={22} style={{ color: 'var(--brand-primary)' }} />
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>Gestión de Usuarios</h3>
          <span className="view-header-pill pill-teal">{users.length} usuarios</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="search-container" style={{ height: '36px', width: '240px' }}>
            <Search className="search-icon" size={14} />
            <input type="text" placeholder="Buscar usuario..." className="search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={loadUsers} className="btn-pill-dark" style={{ padding: '8px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map(u => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderRadius: '14px', border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)', flexWrap: 'wrap', gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%',
                backgroundColor: u.role === 'ADMIN' ? 'rgba(59,130,246,0.15)' : u.role === 'AUDITOR' ? 'rgba(139,92,246,0.15)' : 'rgba(34,197,94,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {u.role === 'ADMIN' ? <Shield size={16} style={{ color: '#3b82f6' }} /> :
                 u.role === 'AUDITOR' ? <UserCheck size={16} style={{ color: '#8b5cf6' }} /> :
                 <User size={16} style={{ color: '#22c55e' }} />}
              </div>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>{u.name}</strong>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{u.email}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={u.role}
                onChange={e => updateRole(u.id, e.target.value)}
                disabled={savingId === u.id || u.id === user.id}
                style={{
                  padding: '6px 10px', borderRadius: '8px', border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700
                }}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {u.id !== user.id && (
                <button
                  onClick={() => disableUser(u.id)}
                  disabled={savingId === u.id}
                  className="btn-pill-dark"
                  style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center' }}
                  title="Desactivar usuario"
                >
                  <UserX size={14} style={{ color: '#ef4444' }} />
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            {searchTerm ? 'No se encontraron usuarios con ese filtro.' : 'No hay usuarios registrados.'}
          </div>
        )}
      </div>
    </div>
  );
}
