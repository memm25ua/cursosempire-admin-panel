require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uuincljsbkispwybnvid.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1aW5jbGpzYmtpc3B3eWJudmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzODI5MzAsImV4cCI6MjA3MDk1ODkzMH0.WloTqUHAVd8O7AOpMaNqhNa4FL0MqIYAKRsVJi2TLMc';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'diegocastanedo03@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'benito123camela';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_51T96V7BWAdE6tUvw087iOfjXZIhgAY5HE42LzOlA6KRjrcj2Ew2CE7DckcamrkRGZbM3CzYTcfZ5iMty2lYDkdPq004SA8W3mg';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_yV210lWcCYjMzKiuNPZAsygh4OryI3sl';
const SITE_URL = process.env.SITE_URL || 'https://cursosempire.pro';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

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
  if (!res.ok) throw new Error((json && (json.message || json.error_description || json.msg)) || text || `Supabase error ${res.status}`);
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

async function findProfileByEmail(email) {
  const rows = await sbFetch(`/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=*`, {
    method: 'GET',
    token: SUPABASE_ANON_KEY,
  });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function findAuthUserByEmail(email) {
  if (!supabaseAdmin) return null;
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((u) => String(u.email || '').toLowerCase() === String(email).toLowerCase());
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function ensureUserForEmail(email, metadata = {}) {
  const existingProfile = await findProfileByEmail(email);
  if (existingProfile?.id) return existingProfile.id;

  const authUser = await findAuthUserByEmail(email);
  if (authUser?.id) return authUser.id;

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: metadata,
      redirectTo: `${SITE_URL.replace(/\/$/, '')}/login`,
    });
    if (error) throw error;
    return data?.user?.id || null;
  }

  const randomPassword = `Tmp!${Math.random().toString(36).slice(2)}${Date.now()}`;
  const created = await sbFetch('/auth/v1/signup', {
    method: 'POST',
    token: SUPABASE_ANON_KEY,
    body: {
      email,
      password: randomPassword,
      data: metadata,
    },
  });

  return created?.user?.id || null;
}

async function upsertProfileByEmail(email, patch, metadata = {}) {
  const existing = await findProfileByEmail(email);
  const bearer = await getAdminBearer();

  if (existing?.id) {
    const result = await sbFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(existing.id)}&select=*`, {
      method: 'PATCH',
      token: bearer,
      headers: { Prefer: 'return=representation' },
      body: patch,
    });
    return Array.isArray(result) ? result[0] : result;
  }

  const userId = await ensureUserForEmail(email, metadata);
  if (!userId) return null;

  const result = await sbFetch('/rest/v1/profiles', {
    method: 'POST',
    token: bearer,
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: {
      id: userId,
      email,
      role: 'user',
      is_active: true,
      ...patch,
    },
  });
  return Array.isArray(result) ? result[0] : result;
}

function derivePlanName(sessionObj, subscriptionObj) {
  return sessionObj?.metadata?.plan_name
    || subscriptionObj?.items?.data?.[0]?.price?.nickname
    || subscriptionObj?.items?.data?.[0]?.price?.id
    || 'Stripe';
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
      const subscriptionId = sessionObj.subscription || null;
      let subscriptionObj = null;
      if (subscriptionId && stripe) {
        try { subscriptionObj = await stripe.subscriptions.retrieve(subscriptionId); } catch (_) {}
      }
      if (email) {
        await upsertProfileByEmail(
          email,
          {
            is_paid: true,
            is_active: true,
            plan_name: derivePlanName(sessionObj, subscriptionObj),
            stripe_customer_id: customerId,
            subscription_expires_at: subscriptionObj?.current_period_end
              ? new Date(subscriptionObj.current_period_end * 1000).toISOString()
              : null,
          },
          { full_name: sessionObj.customer_details?.name || '' }
        );
      }
    }

    if (event.type.startsWith('customer.subscription.')) {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const status = subscription.status;
      const cancelish = ['canceled', 'unpaid', 'incomplete_expired', 'paused'].includes(status);
      const expiresAt = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
      const planName = derivePlanName(null, subscription);
      let email = null;
      if (stripe && customerId) {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && !customer.deleted) email = customer.email || null;
        } catch (_) {}
      }

      const bearer = await getAdminBearer();
      const result = await sbFetch(`/rest/v1/profiles?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=*`, {
        method: 'PATCH',
        token: bearer,
        headers: { Prefer: 'return=representation' },
        body: {
          stripe_customer_id: customerId,
          is_paid: !cancelish,
          is_active: !cancelish,
          plan_name: cancelish ? 'Cancelado' : planName,
          subscription_expires_at: expiresAt,
        },
      });

      if ((!Array.isArray(result) || result.length === 0) && email) {
        await upsertProfileByEmail(email, {
          stripe_customer_id: customerId,
          is_paid: !cancelish,
          is_active: !cancelish,
          plan_name: cancelish ? 'Cancelado' : planName,
          subscription_expires_at: expiresAt,
        });
      }
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

app.post('/api/login', (_req, res) => res.json({ ok: true }));
app.post('/api/logout', (_req, res) => res.json({ ok: true }));
app.get('/api/me', (_req, res) => res.json({ authenticated: true }));

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
            is_active: false,
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

app.get('/api/users/list', requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = q ? 500 : 1000;
    let url = `/rest/v1/profiles?select=id,email,full_name,plan_name,is_paid,is_active,subscription_expires_at&order=email.asc&limit=${limit}`;

    if (q) {
      const safe = q.replace(/[%*,()]/g, ' ').trim();
      const term = encodeURIComponent(`*${safe}*`);
      url += `&or=(email.ilike.${term},full_name.ilike.${term},plan_name.ilike.${term})`;
    }

    const rows = await sbFetch(url, { method: 'GET', token: SUPABASE_ANON_KEY });
    res.json({ rows: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/profiles/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const allowed = ['is_paid', 'is_active', 'plan_name', 'subscription_expires_at', 'stripe_customer_id', 'paypal_payer_id', 'full_name'];
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
