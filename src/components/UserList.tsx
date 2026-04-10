import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface UserRow {
  id: string;
  email?: string;
  full_name?: string;
  plan_name?: string;
  is_paid?: boolean;
  subscription_expires_at?: string;
}

export default function UserList() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listUsers();
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>User List</h2>
        <button className="primary" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="msg error">{error}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr>
              <th style={th}>Email</th>
              <th style={th}>Nombre</th>
              <th style={th}>Plan</th>
              <th style={th}>Pagado</th>
              <th style={th}>Expira</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.email || '—'}</td>
                <td style={td}>{row.full_name || '—'}</td>
                <td style={td}>{row.plan_name || '—'}</td>
                <td style={td}>{row.is_paid ? 'Sí' : 'No'}</td>
                <td style={td}>{row.subscription_expires_at ? new Date(row.subscription_expires_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem',
  borderBottom: '1px solid #2d3748',
};

const td: React.CSSProperties = {
  padding: '0.75rem',
  borderBottom: '1px solid #1f2937',
  fontSize: '0.95rem',
};
