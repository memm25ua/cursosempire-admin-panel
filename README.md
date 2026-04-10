# cursosempire-admin-panel

Mini admin panel for managing Supabase users and profiles.

## Stack

- Frontend: Vite + React (TypeScript)
- Backend: Express.js (serves API + static build)
- Auth: Session-based with `ADMIN_PASSWORD`

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (admin — keep secret) |
| `ADMIN_PASSWORD` | Yes | Password to access the panel |
| `SESSION_SECRET` | Yes | Random string for session signing |
| `STRIPE_SECRET_KEY` | No | Stripe secret key for webhook processing |
| `STRIPE_WEBHOOK_SECRET` | No | Signing secret from Stripe webhook |
| `PORT` | No | Server port (default: 3000 in prod) |

## Local Development

```bash
npm install
cp .env.example .env   # fill in values
npm run dev            # starts Express (3001) + Vite (5173)
```

Open http://localhost:5173

## Deploy on Coolify

1. In Coolify, create a new **Docker** service pointing to this repo.
2. Select **Dockerfile** as build method.
3. Set environment variables from the table above.
4. Expose port **3000**.
5. Deploy.

The container builds the React app and serves everything from the Express server on port 3000.

## API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/login` | Authenticate with ADMIN_PASSWORD |
| POST | `/api/logout` | End session |
| GET | `/api/me` | Check auth status |
| POST | `/api/users` | Create Supabase auth user and upsert profile |
| GET | `/api/users/search?email=` | Find user + profile by email |
| PUT | `/api/profiles/:userId` | Update profile subscription fields |
| POST | `/api/stripe/webhook` | Sync Stripe checkout/subscription events |

## Profile Fields Managed

`full_name`, `is_paid`, `plan_name`, `subscription_expires_at`, `stripe_customer_id`, `paypal_payer_id`

## Stripe webhook

En Stripe:

1. Developers → Webhooks → Add endpoint
2. URL: `https://TU-DOMINIO/api/stripe/webhook`
3. Eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copia el `whsec_...` y ponlo en `STRIPE_WEBHOOK_SECRET`

Qué hace:
- en `checkout.session.completed` intenta guardar `stripe_customer_id` y marcar pago
- en `customer.subscription.*` actualiza `is_paid`, `plan_name` y `subscription_expires_at`
