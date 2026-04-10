import { useState } from 'react';
import { api } from '../lib/api';

export default function CreateUser() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const data = await api.createUser(email, password, fullName);
      setMsg({ type: 'success', text: `Usuario creado: ${data.user.email} (id: ${data.user.id})` });
      setEmail('');
      setPassword('');
      setFullName('');
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al crear el usuario' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Crear usuario</h2>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label>Contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
        <label>Nombre completo</label>
        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} />
        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
    </div>
  );
}
