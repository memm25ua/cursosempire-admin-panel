import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import ProfileEditor from './ProfileEditor';

interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  plan_name?: string;
  is_paid?: boolean;
  subscription_expires_at?: string;
  stripe_customer_id?: string;
  paypal_payer_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

export default function UserSearch() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listUsers();
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.email, row.full_name, row.plan_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [rows, query]);

  const handleProfileUpdated = (profile: Record<string, unknown>) => {
    const next = profile as Profile;
    setRows((prev) => prev.map((row) => (row.id === next.id ? next : row)));
    setSelected(next);
  };

  return (
    <>
      {selected && (
        <>
          <div className="user-info card">
            <h2>Usuario seleccionado</h2>
            <div>
              <span>ID: <strong>{selected.id}</strong></span>
              <span>Email: <strong>{selected.email || '—'}</strong></span>
            </div>
          </div>
          <ProfileEditor userId={selected.id} profile={selected} onUpdated={handleProfileUpdated} />
        </>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2>Usuarios</h2>
            <label>Buscar</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por email, nombre o plan"
              style={{ marginBottom: 0 }}
            />
          </div>
          <button type="button" className="primary" onClick={load} disabled={loading}>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
        {error && <div className="msg error" style={{ marginTop: '0.75rem' }}>{error}</div>}

        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Email</th>
                <th style={th}>Nombre</th>
                <th style={th}>Plan</th>
                <th style={th}>Pagado</th>
                <th style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td style={td}>{row.email || '—'}</td>
                  <td style={td}>{row.full_name || '—'}</td>
                  <td style={td}>{row.plan_name || '—'}</td>
                  <td style={td}>{row.is_paid ? 'Sí' : 'No'}</td>
                  <td style={td}>
                    <button type="button" className="primary" onClick={() => setSelected(row)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td style={td} colSpan={5}>No hay usuarios que coincidan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem',
  borderBottom: '1px solid #ddd',
};

const td: React.CSSProperties = {
  padding: '0.75rem',
  borderBottom: '1px solid #eee',
  verticalAlign: 'middle',
};
