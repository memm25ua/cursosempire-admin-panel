require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

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

      const { error } = await supabase
        .from('profiles')
        .update({
          stripe_customer_id: customerId,
          is_paid: !cancelish,
          plan_name: cancelish ? 'Cancelado' : planName,
          subscription_expires_at: expiresAt,
        })
        .eq('stripe_customer_id', customerId);

      if (error) throw error;
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme-super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// POST /api/login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return res.status(500).json({ error: 'ADMIN_PASSWORD not configured' });
  if (password === adminPassword) {
    req.session.authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/me
app.get('/api/me', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// POST /api/users — create user
app.post('/api/users', requireAuth, async (req, res) => {
  const { email, password, full_name = null } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: full_name ? { full_name } : {},
  });
  if (error) return res.status(400).json({ error: error.message });

  if (data?.user?.id) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        email,
        full_name,
        role: 'user',
        is_paid: false,
        plan_name: 'Pendiente a pago',
        admin_permissions: null,
      }, { onConflict: 'id' });

    if (profileError) return res.status(400).json({ error: profileError.message, user: data.user });
  }

  res.json({ user: data.user });
});

// GET /api/users/search?email=... — find user by email
app.get('/api/users/search', requireAuth, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email query param required' });

  // Paginate through auth users to find by email
  let found = null;
  let page = 1;
  const perPage = 1000;

  while (!found) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.users.length === 0) break;

    found = data.users.find(u => u.email?.toLowerCase() === String(email).toLowerCase()) || null;
    if (data.users.length < perPage) break;
    page++;
  }

  if (!found) return res.status(404).json({ error: 'User not found' });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', found.id)
    .single();

  res.json({
    user: { id: found.id, email: found.email, created_at: found.created_at },
    profile: profileError ? null : profile,
  });
});

// PUT /api/profiles/:userId — update subscription fields
app.put('/api/profiles/:userId', requireAuth, async (req, res) => {
  const { userId } = req.params;
  const allowed = ['is_paid', 'plan_name', 'subscription_expires_at', 'stripe_customer_id', 'paypal_payer_id', 'full_name'];
  const updateData = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updateData[key] = req.body[key];
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ profile: data });
});

async function upsertProfileByEmail(email, patch) {
  const { data: rows, error } = await supabase
    .from('profiles')
    .select('id,email')
    .eq('email', email)
    .limit(1);

  if (error) throw error;

  if (rows?.[0]?.id) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', rows[0].id);
    if (updateError) throw updateError;
    return;
  }

  let found = null;
  let page = 1;
  const perPage = 1000;
  while (!found) {
    const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
    if (listError) throw listError;
    if (!data || data.users.length === 0) break;
    found = data.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase()) || null;
    if (data.users.length < perPage) break;
    page++;
  }

  if (!found) return;

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({
      id: found.id,
      email,
      role: 'user',
      ...patch,
    }, { onConflict: 'id' });

  if (upsertError) throw upsertError;
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
