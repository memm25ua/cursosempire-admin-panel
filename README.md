# cursosempire-admin-panel

Panel mínimo para gestionar usuarios y suscripciones de Cursosempire.

## Qué hace ahora

- crear usuarios manualmente
- editar `profiles`
- listar/buscar usuarios
- recibir webhooks de Stripe
- **crear/invitar automáticamente al usuario cuando paga**
- **activar `is_paid` e `is_active` automáticamente**
- **enviar email de acceso automáticamente vía Supabase Auth** si configuras `SUPABASE_SERVICE_ROLE_KEY`

## Variables importantes en Coolify

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ← necesaria para crear/invitar usuarios por email automáticamente
- `SITE_URL=https://cursosempire.pro`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Qué hace el webhook

### `checkout.session.completed`
- coge el email del pago
- intenta localizar el usuario
- si no existe y hay `SUPABASE_SERVICE_ROLE_KEY`, lo **invita/crea** en Supabase Auth
- crea/actualiza `profiles`
- pone:
  - `is_paid = true`
  - `is_active = true`
  - `plan_name`
  - `stripe_customer_id`
  - `subscription_expires_at` si Stripe ya la devuelve

### `customer.subscription.created|updated|deleted`
- sincroniza:
  - `is_paid`
  - `is_active`
  - `plan_name`
  - `subscription_expires_at`
  - `stripe_customer_id`

## Qué tienes que hacer en Stripe

### 1. Crear webhook
En Stripe:
- Developers → Webhooks → Add endpoint
- URL:
  - `https://cursosempire-admin.aistack.es/api/stripe/webhook`

### 2. Eventos a escuchar
Marca estos:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### 3. Copiar el signing secret
Te dará un valor tipo:
- `whsec_...`

Ponlo en Coolify como:
- `STRIPE_WEBHOOK_SECRET`

### 4. Asegúrate de cobrar con email
En tu Checkout de Stripe debe ir email real del cliente.
Idealmente:
- `customer_email`
- o que Checkout recoja el email del comprador

### 5. Opcional pero recomendable
En el Checkout Session manda también:
- `metadata.plan_name`

Ejemplo:
- `Plan mensual`
- `Plan Anual`
- `Lifetime`

Así el panel guarda el plan correcto.

## Emails

### Email de Stripe
Stripe puede mandar:
- recibos
- confirmaciones de pago
- facturas

Eso se configura en Stripe Dashboard → Customer emails.

### Email de acceso
Ese **no** lo manda Stripe.
Lo manda **Supabase Auth** cuando el webhook invita/crea al usuario.

Por eso necesitas en Coolify:
- `SUPABASE_SERVICE_ROLE_KEY`

Y en Supabase debes tener bien configurado:
- SMTP / emails de Auth
- URL de redirección correcta (`SITE_URL`)

## Después de poner las envs
Solo redeploy en Coolify.

Webhook final:
- `https://cursosempire-admin.aistack.es/api/stripe/webhook`
