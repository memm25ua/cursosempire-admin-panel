require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uuincljsbkispwybnvid.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1aW5jbGpzYmtpc3B3eWJudmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzODI5MzAsImV4cCI6MjA3MDk1ODkzMH0.WloTqUHAVd8O7AOpMaNqhNa4FL0MqIYAKRsVJi2TLMc';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'diegocastanedo03@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'benito123camela';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_51T96V7BWAdE6tUvw087iOfjXZIhgAY5HE42LzOlA6KRjrcj2Ew2CE7DckcamrkRGZbM3CzYTcfZ5iMty2lYDkdPq004SA8W3mg';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_yV210lWcCYjMzKiuNPZAsygh4OryI3sl';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

async function sbFetch(pathname, { method = 'GET', token = SUPABASE_ANON_KEY, body, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error((json && json.message) || text || `Supabase error ${res.status}`);
  return json;
}

async function getAdminBearer() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(json.error_description || json.msg || 'Could not obtain admin bearer');
  return json.access_token;
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
      const sessionObj = event.data.object;
      const email = sessionObj.customer_details?.email || sessionObj.customer_email || null;
      const customerId = sessionObj.customer || null;
      if (email) {
        await upsertProfileByEmail(email, {
          is_paid: true,
          plan_name: sessionObj.metadata?.plan_name || 'Stripe',
          stripe_customer_id: customerId,
        });
      }
    }

    if (event.type.startsWith('customer.subscription.')) {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const status = subscription.status;
      const cancelish = ['canceled', 'unpaid', 'incomplete_expired', 'paused'].includes(status);
      const expiresAt = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
      const planName = subscription.items?.data?.[0]?.price?.nickname || subscription.items?.data?.[0]?.price?.id || status;

      const bearer = await getAdminBearer();
      await sbFetch(`/rest/v1/profiles?stripe_customer_id=eq.${encodeURIComponent(customerId)}`, {
        method: 'PATCH',
        token: bearer,
        headers: { Prefer: 'return=representation' },
        body: {
          stripe_customer_id: customerId,
          is_paid: !cancelish,
          plan_name: cancelish ? 'Cancelado' : planName,
          subscription_expires_at: expiresAt,
        },
      });
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.use(express.json());

function requireAuth(_req, _res, next) {
  return next();
}

// POST /api/login
app.post('/api/login', (_req, res) => {
  res.json({ ok: true });
});

// POST /api/logout
app.post('/api/logout', (_req, res) => {
  res.json({ ok: true });
});

// GET /api/me
app.get('/api/me', (_req, res) => {
  res.json({ authenticated: true });
});

// POST /api/users — create user
app.post('/api/users', requireAuth, async (req, res) => {
  try {
    const { email, password, full_name = null } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const created = await sbFetch('/auth/v1/signup', {
      method: 'POST',
      token: SUPABASE_ANON_KEY,
      body: { email, password, data: full_name ? { full_name } : {} },
    });

    let userId = created?.user?.id || null;
    if (!userId) {
      const found = await findProfileByEmail(email);
      userId = found?.id || null;
    }

    if (userId) {
      const bearer = await getAdminBearer();
      try {
        await sbFetch('/rest/v1/profiles', {
          method: 'POST',
          token: bearer,
          headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
          body: {
            id: userId,
            email,
            full_name,
            role: 'user',
            is_paid: false,
            plan_name: 'Pendiente a pago',
            admin_permissions: null,
          },
        });
      } catch (_e) {}
    }

    res.json({ user: created.user, session: created.session ?? null });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/users/search?email=... — find user by email
app.get('/api/users/search', requireAuth, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email query param required' });

    const profile = await findProfileByEmail(String(email));
    if (!profile) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: { id: profile.id, email: profile.email, created_at: profile.created_at || null },
      profile,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/users/list — list users from profiles
app.get('/api/users/list', requireAuth, async (_req, res) => {
  try {
    const rows = await sbFetch('/rest/v1/profiles?select=id,email,full_name,plan_name,is_paid,subscription_expires_at&order=email.asc&limit=200', {
      method: 'GET',
      token: SUPABASE_ANON_KEY,
    });
    res.json({ rows: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/profiles/:userId — update subscription fields
app.put('/api/profiles/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const allowed = ['is_paid', 'plan_name', 'subscription_expires_at', 'stripe_customer_id', 'paypal_payer_id', 'full_name'];
    const updateData = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const bearer = await getAdminBearer();
    const data = await sbFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, {
      method: 'PATCH',
      token: bearer,
      headers: { Prefer: 'return=representation' },
      body: updateData,
    });

    res.json({ profile: Array.isArray(data) ? data[0] : data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

async function findProfileByEmail(email) {
  const rows = await sbFetch(`/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=*`, {
    method: 'GET',
    token: SUPABASE_ANON_KEY,
  });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function upsertProfileByEmail(email, patch) {
  const existing = await findProfileByEmail(email);
  const bearer = await getAdminBearer();

  if (existing?.id) {
    await sbFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(existing.id)}&select=*`, {
      method: 'PATCH',
      token: bearer,
      headers: { Prefer: 'return=representation' },
      body: patch,
    });
    return;
  }

  const login = await sbFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    token: SUPABASE_ANON_KEY,
    body: { email, password: '123456' },
  }).catch(() => null);

  const userId = login?.user?.id || null;
  if (!userId) return;

  await sbFetch('/rest/v1/profiles', {
    method: 'POST',
    token: bearer,
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: {
      id: userId,
      email,
      role: 'user',
      ...patch,
    },
  });
}

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Admin panel server running on port ${PORT}`);
});
