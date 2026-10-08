# 🚀 How to Run the Project (Quick Start Guide)

A step-by-step guide to run the Food Delivery (Swiggy Clone) platform locally on Windows or via Docker.

---

## 📋 Prerequisites

- **Python**: 3.11+
- **PostgreSQL**: 14+ (or Docker Desktop)

---

## 🛠️ Step 1: Initial Database Setup (One-time)

If you have PostgreSQL installed locally, run the following commands to create and seed the database:

### Windows (PowerShell / Command Prompt):
```powershell
# 1. Create the database
createdb -U postgres swiggy_db

# 2. Run schema migration (all 30 tables)
psql -U postgres -d swiggy_db -f db\01_schema.sql

# 3. Apply payment security rules & permissions
psql -U postgres -d swiggy_db -f db\02_payment_security.sql

# 4. Seed initial test data (users, restaurants, menus, partners, orders)
psql -U postgres -d swiggy_db -f db\03_seed.sql
```

### macOS / Linux:
```bash
createdb -U postgres swiggy_db
psql -U postgres -d swiggy_db -f db/01_schema.sql
psql -U postgres -d swiggy_db -f db/02_payment_security.sql
psql -U postgres -d swiggy_db -f db/03_seed.sql
```

---

## 💻 Step 2: Run Backend & Frontend Locally

### 1. Activate the Virtual Environment
Navigate to the project root directory (`swiggy-clone`):

**Windows (PowerShell):**
```powershell
.\venv\Scripts\activate
```

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
```

**macOS / Linux:**
```bash
source venv/bin/activate
```

*(If you haven't installed dependencies yet)*:
```powershell
pip install -r api\requirements.txt
```

---

### 2. Start the FastAPI Application Server
Run the Uvicorn server from the project root:

```powershell
python -m uvicorn api.app.main:app --reload --port 8000
```

---

## 🌐 Step 3: Access the Applications

Once the server is running, open the following URLs in your browser:

| Interface | URL | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:8000/app/](http://localhost:8000/app/) | Customer, Restaurant & Delivery Partner UI |
| **API Documentation (Swagger UI)** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API exploration and testing |
| **Alternative Docs (ReDoc)** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Clean API schema reference |
| **Health Check** | [http://localhost:8000/health](http://localhost:8000/health) | Backend & Database status check |

---

## 🐳 Alternative: Run Everything with Docker Compose

If you have Docker Desktop installed, you can start the entire stack (PostgreSQL + Backend + Frontend) in one command:

```powershell
docker compose up --build
```

To stop the containers:
```powershell
docker compose down
```

---

## 🧪 Running Automated Tests

To run the full end-to-end flow test suite:

```powershell
pytest -q tests\test_full_flow.py
```

---

## 👥 Demo Test Accounts (Seed Data)

In dev mode (`OTP_DEV_MODE=true`), the OTP is returned directly in the response for easy testing.

| Role | Name | Phone Number |
| :--- | :--- | :--- |
| **Customer** | Ravi Kumar | `9845011111` |
| **Customer** | Ananya Rao | `9845011112` |
| **Customer & Partner** | Kiran Desai | `9845011115` |
| **Restaurant Owner** (Spice Route) | Manjunath Gowda | `9845022221` |
| **Restaurant Owner** (Udupi Grand) | Lakshmi Iyer | `9845022222` |
| **Delivery Partner** | Suresh B | `9845033331` |
| **Ops Admin** | Admin | `9845044441` |

---

## 🎨 New Foodu front end (October 2026)

The front end in `frontend/` was rebuilt from the Foodu design (`docs/foodu-design/`). It talks to the real API only (no mock mode).
The old front end is kept in `frontend_legacy/` in case you need it.

Start the API as usual, then open **http://localhost:8000/app/**

| Page | URL | Test login (OTP is shown on screen in dev mode) |
|------|-----|------------------------------------------------|
| Landing | `/app/` | – |
| Customer | `/app/customer.html` | 9845011111 (Ravi) |
| Kitchen Portal | `/app/restaurant.html` | 9845022221 (Manjunath, Spice Route) |
| Rider HUD | `/app/rider.html` | 9845033331 (Suresh) |
| Admin | `/app/admin.html` | 9845044441 |
| Sign in / register | `/app/login.html?app=customer` (or restaurant / rider / admin) | any new 10-digit number to register |

Test cards (mock gateway): `4111 1111 1111 1111` works, `4000 0000 0000 0002` is declined. Any future expiry, any CVV.
The card number and CVV are sent only to `/mock-gateway/v1/tokenize`; our API receives only the token.

Full order test: customer orders and pays → Kitchen Portal "Accept order" → Rider goes online and accepts → Kitchen "Mark ready" → Rider slides to confirm pickup → "Mark as delivered" → customer sees Delivered and rates.

### Backend changes made with the new UI (`api/app/main.py`)
- `/auth/login` for the restaurant app crashed (it sorted by a column `restaurant_staff.assigned_at` that does not exist). Fixed.
- `/restaurant/{id}/payouts` used columns that do not exist. It now returns `payout_id, order_id, order_amount, commission, payout_amount, payout_status, created_at`.
- `/restaurant/{id}/orders` also returns `item_total`, `partner_id` and `partner_name`.
- A rider who comes online later now gets offered waiting orders (`offer_waiting_orders`, used by `/partner/status` and `/partner/offers`).
- New admin endpoints: `GET /admin/pending`, `POST /admin/restaurants/{id}/reject`, `POST /admin/partners/{id}/reject`.
- A declined payment (402) now includes a readable `message`.
