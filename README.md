# Food Delivery Backend (Swiggy-style): step-by-step build guide

PostgreSQL database + Python FastAPI backend for three apps: **Customer**, **Restaurant (hotel)** and **Delivery partner**. Everything is covered, from the user entering the app to payment, delivery and rating.

> **Main rule: CVV / CVC and the full card number are never stored in the database and never written to any log file.**
> The section [Where the CVV rule is enforced](#where-the-cvv-rule-is-enforced) lists every place this rule is implemented.

```
swiggy-clone/
├── db/
│   ├── 01_schema.sql            # Step 1: all 30 tables
│   ├── 02_payment_security.sql  # Step 2: CVV / card-number protection + least-privilege DB user
│   ├── 03_seed.sql              # Step 3: sample data (users, restaurants, menus, partners, orders, payments)
│   ├── 04_flow_walkthrough.sql  # Step 4: one full order in plain SQL
│   ├── postgresql_logging.conf  # server log settings (no values in logs)
│   └── reset_db.sh              # re-create DB = 01 + 02 + 03
├── api/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py db.py security.py schemas.py errors.py logging_setup.py
│   │   ├── services/            # gateway client, order status + dispatch logic
│   │   └── routers/             # auth, customer, orders, payments, restaurant, partner, admin, mock_gateway
│   ├── requirements.txt  .env.example  Dockerfile
├── tests/test_full_flow.py      # end-to-end test + "CVV never stored/logged" test
└── docker-compose.yml           # one-command local setup
```

---

## Step 0: Install the tools

| Tool | Version | Check |
|---|---|---|
| PostgreSQL | 14 or newer (16 recommended) | `psql --version` |
| Python | 3.11 or newer | `python --version` |
| (optional) Docker Desktop | any recent | `docker --version` |

**Fastest path:** with Docker installed, run `docker compose up --build`, open http://localhost:8000/docs, and skip to Step 6.

---

## Step 1: Create the database and tables

```bash
createdb -U postgres swiggy_db
psql -U postgres -d swiggy_db -f db/01_schema.sql
```

The 30 tables are grouped the same way as in the mind map:

| Group | Tables |
|---|---|
| **A. Shared identity** | `users`, `roles`, `user_roles`, `otp_requests` |
| **B. Customer app** | `addresses`, `carts`, `cart_items`, `coupons`, `ratings` |
| **C. Restaurant app** | `restaurants`, `restaurant_staff`, `restaurant_timings`, `menu_categories`, `menu_items`, `item_addons`, `restaurant_payouts` |
| **D. Delivery partner app** | `delivery_partners`, `partner_documents`, `partner_locations`, `delivery_assignments`, `partner_earnings` |
| **E. Order core** | `orders`, `order_items`, `order_status_history` |
| **F. Payment gateway** | `payment_gateways`, `saved_payment_methods`, `payments`, `payment_transactions`, `refunds`, `payment_webhook_events` |

Key design points:

* **One login table for everyone** (`users`). Roles come from `user_roles`, so one phone can be a customer *and* a delivery partner.
* **A restaurant is a business, not a login.** People act for it through `restaurant_staff`.
* **`orders` is the hub.** It holds `customer_id`, `restaurant_id`, `partner_id`, `address_id` and `coupon_id`.
* `order_items` copies the dish name and price at order time, so old bills never change.
* CHECK constraints guard every status column, and indexes cover the common screens (my orders, restaurant live orders and so on).

## Step 2: Apply the payment security rules

```bash
psql -U postgres -d swiggy_db -f db/02_payment_security.sql
```

This file adds the database-side CVV protection and creates **`app_user`**, the limited login the API uses. Change its password in production.

## Step 3: Seed the data

```bash
psql -U postgres -d swiggy_db -f db/03_seed.sql
# or do Steps 1-3 in one go:
PGUSER=postgres ./db/reset_db.sh
```

Who's who in the seed data (log in with these phones; in dev mode the OTP is returned by the API):

| Phone | Person | Role(s) |
|---|---|---|
| 9845011111 | Ravi Kumar | Customer (has a saved VISA ••••1111 token) |
| 9845011112 | Ananya Rao | Customer (has items in her cart) |
| 9845011115 | Kiran Desai | Customer **and** Delivery partner |
| 9845022221 | Manjunath Gowda | Owner of restaurant 1, Spice Route Biryani House |
| 9845022222 | Lakshmi Iyer | Owner of restaurant 2, Udupi Grand Veg |
| 9845033331 | Suresh B | Delivery partner (online, near restaurant 1) |
| 9845033334 | Imran Khan | Delivery partner (KYC pending) |
| 9845044441 | Ops Admin | Admin |

Seeded orders show every state: 9001 delivered (card), 9002 delivered (COD), 9003 payment failed (UPI), 9004 placed and waiting for the restaurant.

## Step 4: Walk through one order in SQL

```bash
psql -U postgres -d swiggy_db -f db/04_flow_walkthrough.sql
```

This script runs the queries the API runs: login → browse → cart → checkout → payment → accept → dispatch → pickup → deliver → rate. Read it top to bottom.

## Step 5: Run the API

```bash
cd api
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                      # edit DATABASE_URL / secrets
uvicorn app.main:app --reload
```

Open **http://localhost:8000/docs**. Every endpoint can be tried from the browser: click **Authorize**, then paste `Bearer <token>`.

## Step 6: The full flow through the API

| # | Who | Endpoint | Tables touched |
|---|---|---|---|
| 1 | anyone | `POST /auth/otp/request` → `POST /auth/otp/verify` | `otp_requests`, `users`, `user_roles` |
| 2 | customer | `POST /me/addresses`, `GET /restaurants?address_id=` | `addresses`, `restaurants` |
| 3 | customer | `GET /restaurants/{id}/menu` | `menu_categories`, `menu_items`, `item_addons` |
| 4 | customer | `POST /cart/items` | `carts`, `cart_items` |
| 5 | customer | `POST /orders/checkout` | `orders`, `order_items`, `order_status_history`, `payments`, `payment_transactions` |
| 6 | **gateway SDK** | `POST /mock-gateway/v1/tokenize` (card + CVV go **here**, not to our API) | none |
| 7 | customer | `POST /payments/{id}/pay` with **token only** | `payments`, `payment_transactions`, `saved_payment_methods`, `orders` |
| 8 | gateway | `POST /payments/webhooks/mockpay` (signed) | `payment_webhook_events`, `payments` |
| 9 | restaurant | `GET /restaurant/{rid}/orders`, `POST …/accept` (auto-dispatch) | `orders`, `delivery_assignments` |
| 10 | partner | `GET /partner/offers`, `POST /partner/offers/{id}/accept` | `delivery_assignments`, `orders`, `delivery_partners` |
| 11 | restaurant | `POST …/ready` | `orders`, `order_status_history` |
| 12 | partner | `POST /partner/orders/{id}/pickup`, `POST /partner/location` | `orders`, `partner_locations` |
| 13 | customer | `GET /orders/{id}` (timeline + live location) | `orders`, `order_status_history`, `partner_locations` |
| 14 | partner | `POST /partner/orders/{id}/deliver` | `orders`, `partner_earnings`, `restaurant_payouts`, `payments` (COD) |
| 15 | customer | `POST /orders/{id}/rate` | `ratings`, `restaurants`, `delivery_partners` |

Also included: cancel with automatic refund (`refunds`), COD, coupons, sold-out items, one-restaurant-per-cart, idempotent checkout (a double tap never creates two orders), restaurant onboarding with admin approval, and partner onboarding with KYC verification.

## Step 7: Payment flow and the CVV rule

```
 Customer phone                     Payment gateway (Razorpay/Stripe)            OUR API + DB
 ──────────────                     ─────────────────────────────────            ────────────
 1. Card no. + expiry + CVV ──────► tokenises, checks CVV, discards it
 2.            ◄────── token + brand + last4 + expiry
 3. token ─────────────────────────────────────────────────────────────────►  /payments/{id}/pay
 4.                                  ◄──── charge(token, amount) ────────────  server-to-server
 5.                                  ───── captured / failed ───────────────►  save status, brand, last4
```

Our servers **never see** the card number or the CVV, so there is nothing to store and nothing to leak. PCI-DSS (requirement 3.3) forbids storing CVV after authorisation, even encrypted.

### Where the CVV rule is enforced

| # | Layer | File | What it does |
|---|---|---|---|
| 1 | Schema | `db/01_schema.sql` | No column for CVV or full card number exists. Only `gateway_token`, `card_network`, `card_last4` and expiry. `COMMENT ON TABLE payments` states the rule inside the DB. |
| 2 | DDL guard | `db/02_payment_security.sql` → `trg_block_card_secret_columns` | An **event trigger** blocks anyone from adding a column like `cvv`, `cvc`, `card_number` or `pan` later. |
| 3 | Data guard | `db/02_payment_security.sql` → `jsonb_has_card_secrets()` triggers | Rejects any gateway response, webhook payload, add-on JSON, order note or review that contains a `cvv`/`card_number` key or a Luhn-valid card number. The error message never includes the value. |
| 4 | DB logs | `db/02_payment_security.sql`, `db/postgresql_logging.conf` | `log_parameter_max_length = 0` and `log_statement = 'ddl'`, so PostgreSQL never writes query values to its log files. |
| 5 | DB user | `db/02_payment_security.sql` | The API logs in as `app_user`. It cannot ALTER tables and cannot delete or edit payment history. |
| 6 | API input | `api/app/schemas.py` (`Strict`, `PayIn`) + `api/app/errors.py` | Request models forbid extra fields. Sending `cvv` returns 422, and the custom handler never echoes the value back. |
| 7 | App logs | `api/app/logging_setup.py` | Request bodies are never logged. A redaction filter masks any CVV field or card number in every log line as a safety net. |
| 8 | Gateway data | `api/app/services/gateway.py` → `sanitize()` | Only whitelisted keys from gateway responses are stored. |
| 9 | Proof | `tests/test_full_flow.py::test_cvv_never_stored_or_logged` | Scans every table and the log file after a real payment to confirm the card number and CVV are absent. |

Test cards for the mock gateway: `4111 1111 1111 1111` succeeds, `4000 0000 0000 0002` is declined. Any future expiry date and any 3-digit CVV work.

## Step 8: Run the tests

```bash
PGUSER=postgres ./db/reset_db.sh
cd api && pytest -q ../tests
```

The tests cover the whole journey: a new user signs up, a payment is declined and retried, a webhook arrives twice, the restaurant accepts, dispatch runs, the partner delivers and the customer rates. They also cover COD, cancel with refund, role checks and the CVV checks.

## Step 9: Before going live (checklist)

* Replace MockPay with a real gateway: add a `RazorpayGateway` class in `services/gateway.py`, use their mobile SDK in the app, and set `ENABLE_MOCK_GATEWAY=false`.
* Send OTPs by SMS (MSG91 / Twilio) and set `OTP_DEV_MODE=false`.
* Keep secrets in a vault or environment variables, never in git or the DB. Use HTTPS everywhere.
* Move `partner_locations` to Redis and push order events through a queue (Kafka / Redis streams).
* Use PostGIS for distance queries, Alembic for schema migrations, and set up daily backups and read replicas.
* Add rate limiting on OTP and payment endpoints.
