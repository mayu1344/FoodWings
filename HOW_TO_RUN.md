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
