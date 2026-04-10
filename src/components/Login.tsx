import { useState } from 'react';
import { api } from '../lib/api';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login(password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 400, marginTop: '4rem' }}>
      <div className="card">
        <h1>Admin Panel</h1>
        <form onSubmit={handleSubmit}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            required
          />
          <button type="submit" className="primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>
        {error && <div className="msg error">{error}</div>}
      </div>
    </div>
  );
}
