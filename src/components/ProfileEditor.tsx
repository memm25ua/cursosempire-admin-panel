import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const PLAN_OPTIONS = [
  '',
  'Cancelado',
  'Free',
  'Lifetime',
  'PAGO UNICO',
  'Pendiente a pago',
  'Plan Anual',
  'Plan mensual',
  'Prueba',
];

interface Profile {
  id?: string;
  full_name?: string;
  is_paid?: boolean;
  is_active?: boolean;
  plan_name?: string;
  subscription_expires_at?: string;
  stripe_customer_id?: string;
  paypal_payer_id?: string;
  [key: string]: unknown;
}

interface Props {
  userId: string;
  profile: Profile | null;
  onUpdated: (profile: Record<string, unknown>) => void;
}

function toDatetimeLocal(iso?: string): string {
  if (!iso) return '';
  // Convert ISO to datetime-local format (YYYY-MM-DDTHH:mm)
  return iso.slice(0, 16);
}

export default function ProfileEditor({ userId, profile, onUpdated }: Props) {
  const [form, setForm] = useState({
    full_name: '',
    is_paid: false,
    is_active: false,
    plan_name: '',
    subscription_expires_at: '',
    stripe_customer_id: '',
    paypal_payer_id: '',
  });
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        is_paid: profile.is_paid || false,
        is_active: profile.is_active || false,
        plan_name: profile.plan_name || '',
        subscription_expires_at: toDatetimeLocal(profile.subscription_expires_at),
        stripe_customer_id: profile.stripe_customer_id || '',
        paypal_payer_id: profile.paypal_payer_id || '',
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name || null,
        is_paid: form.is_paid,
        is_active: form.is_active,
        plan_name: form.plan_name || null,
        stripe_customer_id: form.stripe_customer_id || null,
        paypal_payer_id: form.paypal_payer_id || null,
        subscription_expires_at: form.subscription_expires_at
          ? new Date(form.subscription_expires_at).toISOString()
          : null,
      };
      const data = await api.updateProfile(userId, payload);
      onUpdated(data.profile);
      setMsg({ type: 'success', text: 'Perfil actualizado.' });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al actualizar' });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="card">
        <h2>Perfil</h2>
        <p style={{ color: '#888', fontSize: '0.9rem' }}>No existe fila en `profiles` para este usuario.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Editar usuario</h2>
      <form onSubmit={handleSubmit}>
        <div className="row">
          <div>
            <label>Nombre completo</label>
            <input type="text" name="full_name" value={form.full_name} onChange={handleChange} />
          </div>
          <div>
            <label>Plan</label>
            <select name="plan_name" value={form.plan_name} onChange={(e) => setForm(prev => ({ ...prev, plan_name: e.target.value }))}>
              {PLAN_OPTIONS.map((plan) => (
                <option key={plan || '__empty__'} value={plan}>
                  {plan || 'Sin plan'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row">
          <div>
            <label>Stripe customer ID</label>
            <input type="text" name="stripe_customer_id" value={form.stripe_customer_id} onChange={handleChange} placeholder="cus_..." />
          </div>
          <div>
            <label>PayPal payer ID</label>
            <input type="text" name="paypal_payer_id" value={form.paypal_payer_id} onChange={handleChange} />
          </div>
        </div>

        <label>Fin de suscripción</label>
        <input
          type="datetime-local"
          name="subscription_expires_at"
          value={form.subscription_expires_at}
          onChange={handleChange}
        />

        <div className="toggle-row">
          <input
            type="checkbox"
            id="is_paid"
            name="is_paid"
            checked={form.is_paid}
            onChange={handleChange}
            style={{ width: 'auto', marginBottom: 0 }}
          />
          <label htmlFor="is_paid">Pagado</label>
        </div>

        <div className="toggle-row">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={form.is_active}
            onChange={handleChange}
            style={{ width: 'auto', marginBottom: 0 }}
          />
          <label htmlFor="is_active">Activo</label>
        </div>

        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
    </div>
  );
}
