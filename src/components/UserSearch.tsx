import { useState } from 'react';
import { api } from '../lib/api';
import ProfileEditor from './ProfileEditor';

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name?: string;
  is_paid?: boolean;
  plan_name?: string;
  subscription_expires_at?: string;
  stripe_customer_id?: string;
  paypal_payer_id?: string;
  [key: string]: unknown;
}

export default function UserSearch() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ user: AuthUser; profile: Profile | null } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await api.searchUser(email);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error searching user');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdated = (profile: Record<string, unknown>) => {
    if (result) setResult({ ...result, profile: profile as Profile });
  };

  return (
    <>
      <div className="card">
        <h2>Search User by Email</h2>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ marginBottom: 0 }}
            />
          </div>
          <button type="submit" className="primary" disabled={loading} style={{ marginBottom: 0 }}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>
        {error && <div className="msg error" style={{ marginTop: '0.75rem' }}>{error}</div>}
      </div>

      {result && (
        <>
          <div className="user-info card">
            <h2>User Info</h2>
            <div>
              <span>ID: <strong>{result.user.id}</strong></span>
              <span>Email: <strong>{result.user.email}</strong></span>
              <span>Created: <strong>{new Date(result.user.created_at).toLocaleDateString()}</strong></span>
            </div>
          </div>
          <ProfileEditor
            userId={result.user.id}
            profile={result.profile}
            onUpdated={handleProfileUpdated}
          />
        </>
      )}
    </>
  );
}
