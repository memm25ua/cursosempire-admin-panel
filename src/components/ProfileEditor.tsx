import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Profile {
  id?: string;
  full_name?: string;
  is_paid?: boolean;
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
        plan_name: form.plan_name || null,
        stripe_customer_id: form.stripe_customer_id || null,
        paypal_payer_id: form.paypal_payer_id || null,
        subscription_expires_at: form.subscription_expires_at
          ? new Date(form.subscription_expires_at).toISOString()
          : null,
      };
      const data = await api.updateProfile(userId, payload);
      onUpdated(data.profile);
      setMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="card">
        <h2>Profile</h2>
        <p style={{ color: '#888', fontSize: '0.9rem' }}>No profile row found in the profiles table for this user.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Edit Profile</h2>
      <form onSubmit={handleSubmit}>
        <div className="row">
          <div>
            <label>Full Name</label>
            <input type="text" name="full_name" value={form.full_name} onChange={handleChange} />
          </div>
          <div>
            <label>Plan Name</label>
            <input type="text" name="plan_name" value={form.plan_name} onChange={handleChange} placeholder="e.g. pro, basic" />
          </div>
        </div>

        <div className="row">
          <div>
            <label>Stripe Customer ID</label>
            <input type="text" name="stripe_customer_id" value={form.stripe_customer_id} onChange={handleChange} placeholder="cus_..." />
          </div>
          <div>
            <label>PayPal Payer ID</label>
            <input type="text" name="paypal_payer_id" value={form.paypal_payer_id} onChange={handleChange} />
          </div>
        </div>

        <label>Subscription Expires At</label>
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
          <label htmlFor="is_paid">Is Paid</label>
        </div>

        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
    </div>
  );
}
