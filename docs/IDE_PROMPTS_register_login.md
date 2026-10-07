# FoodWings – IDE prompts: Register & Login for all three apps

How to use this file:

1. Paste **Prompt 0 (Project context)** first, in every new IDE chat. It tells the IDE what already exists and which rules it must not break.
2. Then paste **one prompt at a time**, in order: 1 → 2 → 3 → 4 → 5 → 6. Run the app and the tests after each one before moving on.
3. Each prompt ends with **acceptance criteria**. Ask the IDE to show you that every item passes before you continue.

The order matters: Prompt 1 builds the shared backend that Prompts 2, 3 and 4 use.

---

## Prompt 0 – Project context (paste first, every time)

```text
You are working on FoodWings, a Swiggy-style food delivery system. Read the project before changing anything.

STACK
- Database: PostgreSQL 16. Schema in db/01_schema.sql (30 tables), security in db/02_payment_security.sql, seed data in db/03_seed.sql.
- Backend: Python + FastAPI in api/app (psycopg3 + psycopg_pool, autocommit connections, explicit `with transaction(conn):` blocks from app/db.py).
- Frontend: plain HTML + JavaScript (no framework, no build step) in frontend/.
  - Three apps share one database: customer.html, restaurant.html, rider.html, and index.html shows all three side by side.
  - Global object `App`. Core files are in frontend/js/core, screens in frontend/js/screens.

EXISTING TABLES YOU WILL USE (do NOT rename, drop or change their columns)
- users(user_id, phone UNIQUE CHECK '^\+?[0-9]{10,14}$', name, email UNIQUE, is_active, created_at, updated_at)
- roles(role_id, role_name): 1 CUSTOMER, 2 RESTAURANT_OWNER, 3 RESTAURANT_STAFF, 4 DELIVERY_PARTNER, 5 ADMIN
- user_roles(user_id, role_id, assigned_at), PRIMARY KEY(user_id, role_id). One user can hold several roles.
- otp_requests(otp_id, phone, otp_hash, expires_at, attempts, verified, created_at). Only the HASH of the OTP is stored.
- addresses(address_id, user_id, label, address_line, landmark, city, latitude, longitude, is_default)
- restaurants(... status PENDING/ACTIVE/SUSPENDED/CLOSED, is_open, fssai_no UNIQUE, gst_no, city, latitude, longitude, cuisines ...)
- restaurant_staff(restaurant_id, user_id, staff_role OWNER/MANAGER/KITCHEN)
- restaurant_timings(restaurant_id, day_of_week 1-7 (1 = Monday), open_time, close_time)
- menu_categories, menu_items, item_addons
- delivery_partners(partner_id = users.user_id, vehicle_type BIKE/SCOOTER/CYCLE/EV, vehicle_no, licence_no UNIQUE, city,
  kyc_status PENDING_KYC/VERIFIED/REJECTED, is_online, current_order_id, rating, joined_at)
- partner_documents(doc_id, partner_id, doc_type LICENCE/RC/ID_PROOF/PHOTO, file_url, verified, verified_at, uploaded_at)

IMPORTANT FACTS ABOUT THE DESIGN
- There is NO password column. Login is by phone + 6-digit OTP. Do not add a password column unless I ask for it.
- One person = one row in `users`. Their apps are decided by rows in `user_roles`.
  Example: seed user 105 (Kiran) is both CUSTOMER and DELIVERY_PARTNER with the same user_id.
- A rider's partner_id IS their user_id (1-to-1).
- A restaurant owner is linked to a restaurant through restaurant_staff (staff_role = 'OWNER').

EXISTING ENDPOINTS (keep them working; the tests use them)
- POST /auth/otp/request {phone} -> stores the OTP hash; returns dev_otp when OTP_DEV_MODE is on.
- POST /auth/otp/verify {phone, otp, name?} -> auto-creates a CUSTOMER if the phone is new. Keep it for backward compatibility.
- GET /auth/me
- POST /restaurants/onboard {name, address_line, city, latitude, longitude, cuisines?, fssai_no, gst_no?}
  -> creates restaurants (PENDING) + restaurant_staff (OWNER) + user_roles role 2.
- POST /partners/onboard {vehicle_type, vehicle_no, licence_no, city}
  -> creates delivery_partners (PENDING_KYC) + user_roles role 4.
- POST /me/addresses, GET /restaurant/mine, GET /partner/me
- POST /admin/restaurants/{id}/approve, POST /admin/partners/{id}/verify

RULES YOU MUST FOLLOW IN EVERY CHANGE
1. Uniform response envelope. Every endpoint returns
   {success, data, error, meta{request_id, timestamp, operation}}
   through EnvelopeRoute (app/envelope.py). Use `router = APIRouter(route_class=EnvelopeRoute, ...)`.
   Raise HTTPException(status, "message") for errors. Never return a raw dict outside the envelope.
2. Every new route gets an entry in OPERATION_NAMES in app/main.py (for example "auth.register").
3. Request bodies are Pydantic models that extend `Strict` in app/schemas.py (extra="forbid"), with Field patterns and lengths.
4. SQL is always parameterised (%s). Never build SQL with f-strings from user input.
5. Multi-table writes go inside ONE `with transaction(conn):` block, so a failure leaves nothing half-created.
6. Security: never store or log a raw OTP, card number or CVV. The logging RedactingFilter must stay on.
   Validation errors must not echo the input back. The CVV rule in db/02_payment_security.sql must stay unchanged.
7. Frontend: every new API call is added in THREE places with the same operation name:
   frontend/js/core/operations.js (catalogue), frontend/js/core/mock-server.js (demo mode), api/app/main.py (OPERATION_NAMES).
   Screens follow the existing pattern: an object with state, load(), render(), actions, wired by
   data-action="..." on buttons/forms and data-change="..." on inputs (see frontend/js/core/shell.js).
   Use App.ui helpers (esc, toast, busy). Escape every value you put into HTML with App.ui.esc.
   Use the FoodWings styles in frontend/css/styles.css (yellow/black/red tokens). Do not add inline grid styles; add CSS classes.
8. Do not change db/01_schema.sql. If you truly need a new column or table, STOP and propose a separate migration file
   db/05_<name>.sql and explain why. Do not apply it until I agree.
9. After each task: run `pytest -q` in api/ and make sure the 4 existing tests still pass, plus the new tests.

Reply "Context loaded" and list the files you will touch for the next task before you write code.
```

---

## Prompt 1 – Shared backend: register & login endpoints (all apps)

```text
TASK: Add proper Register and Login endpoints that work for all three apps (customer, restaurant, rider),
using the existing users / user_roles / otp_requests tables. Phone + OTP only, no passwords.

1. Refactor OTP checking into one helper in api/app/routers/auth.py:
   `consume_otp(conn, phone, otp) -> None`
   - Picks the latest unverified otp_requests row for that phone (FOR UPDATE).
   - Missing or expired -> 400 "OTP expired, request a new one". attempts >= 5 -> 429 "Too many attempts".
   - Wrong OTP -> increment attempts in its own committed transaction, then 400 "Wrong OTP"
     (copy the pattern verify_otp already uses with the wrong_otp flag).
   - Correct -> set verified = TRUE. An OTP can be used only once.
   Make the existing /auth/otp/verify use this helper too, with unchanged behaviour.

2. Add an `app` value used by all new endpoints: Literal["customer","restaurant","rider"].
   Map app -> required roles:
     customer   -> CUSTOMER
     restaurant -> RESTAURANT_OWNER or RESTAURANT_STAFF
     rider      -> DELIVERY_PARTNER

3. POST /auth/check-phone {phone, app}   (public)
   Returns {exists: bool, has_app_role: bool, name: str|null}. The UI uses it to decide whether to show
   "Log in" or "Create account". Return the name only (masked like "Ra***"), never the email or other data.

4. POST /auth/register   (public)  body RegisterIn:
     phone (pattern ^\+?[0-9]{10,14}$), otp (^[0-9]{6}$), app,
     name (2–100 chars, required), email (optional, valid email, max 150)
   Logic, in ONE transaction after consume_otp succeeds:
   a) Look up users by phone.
      - Not found -> INSERT INTO users (phone, name, email) RETURNING user_id.
      - Found and is_active = FALSE -> 403 "Account blocked".
      - Found and already has the role for this app -> 409 "Already registered for this app. Please log in."
      - Found but without this app's role -> reuse the same user_id (do NOT create a second user).
        Update name/email only if they are currently NULL.
   b) Email already used by another user -> 409 "Email already in use" (catch the UNIQUE violation, do not leak details).
   c) Roles:
      - app = customer -> INSERT INTO user_roles (user_id, 1) ON CONFLICT DO NOTHING right away.
      - app = restaurant or rider -> do NOT add a role yet. The role is added by the onboarding step
        (Prompts 3 and 4), because a restaurant owner without a restaurant, or a rider without vehicle details,
        must not exist.
   d) Return {token, user_id, name, roles, app, next_step} where next_step is:
      customer -> "ADD_ADDRESS" ; restaurant -> "RESTAURANT_DETAILS" ; rider -> "RIDER_DETAILS".
      The token is created with create_token(user_id, roles) using the CURRENT roles (may be empty for restaurant/rider).

5. POST /auth/login   (public)  body LoginIn: phone, otp, app
   - consume_otp first.
   - No user with this phone -> 404 "No account for this number. Please register first." (error code USER_NOT_FOUND)
   - is_active = FALSE -> 403 "Account blocked".
   - User has no role for this app:
       restaurant/rider app and the user started registration but never finished onboarding
         -> 200 with roles = current roles and next_step = "RESTAURANT_DETAILS" / "RIDER_DETAILS"
            (so they can continue the wizard),
       otherwise -> 403 "This account is not registered for the <app> app" (error code ROLE_MISSING).
   - Success -> {token, user_id, name, roles, app, next_step, status}
     where status gives the onboarding state:
       restaurant -> the restaurant's status (PENDING/ACTIVE/...) from restaurants joined through restaurant_staff
       rider      -> delivery_partners.kyc_status
       customer   -> "ACTIVE"
     and next_step is "HOME", "WAIT_FOR_APPROVAL" (restaurant PENDING / rider PENDING_KYC), or "REJECTED".

6. Fix the "log in again to get the new role" problem:
   POST /restaurants/onboard and POST /partners/onboard must return a fresh `token` (with the new role included)
   and the updated `roles` list in their response data. Add POST /auth/refresh (auth required) that re-reads
   roles from user_roles and returns a new token. Use it on the front end after admin approval.

7. Rate limiting (simple, in the database, no new table):
   POST /auth/otp/request -> reject with 429 when the phone already has 5 or more otp_requests in the last 15 minutes.
   POST /auth/otp/request must also accept an optional `app` and `purpose` ("LOGIN" | "REGISTER"), for logging only.
   Log only the last 4 digits of the phone.

8. Add to OPERATION_NAMES: auth.checkPhone, auth.register, auth.login, auth.refresh.

9. Tests: create api/tests/test_auth_register_login.py with pytest cases:
   - register a new customer -> users row + user_roles(…,1) exist, token works on GET /auth/me
   - register the same phone twice for customer -> 409
   - login with an unknown phone -> 404 USER_NOT_FOUND
   - login to the rider app with a customer-only account -> 403 ROLE_MISSING
   - existing customer registers as a rider -> the SAME user_id, no duplicate users row
   - wrong OTP 5 times -> 429; OTP reused -> 400
   - the raw OTP never appears in otp_requests or in the captured log output
   - every response matches the envelope shape

ACCEPTANCE CRITERIA
- All old tests and all new tests pass.
- No schema change. No password column.
- `SELECT * FROM users` after registering shows exactly one row per phone.
```

---

## Prompt 2 – Customer app: Register / Login screens

```text
TASK: Replace the sample-persona login in the CUSTOMER app with a real Register / Login flow.
Files: frontend/js/screens/login.js (split it if it gets big, for example frontend/js/screens/auth/*.js
loaded by every HTML page), frontend/js/core/operations.js, frontend/js/core/mock-server.js, frontend/css/styles.css.

SCREEN FLOW (customer)
1. "Welcome" screen: FoodWings logo, two tabs: "Log in" | "Create account".
2. Step 1 – Phone: input +91 phone (10 digits, digits only, inputmode="numeric").
   On Continue call auth.checkPhone {phone, app:"customer"}:
     - exists and has_app_role -> switch to the Log in tab automatically and show "Welcome back, Ra***".
     - otherwise stay on Create account.
   Then call auth.requestOtp {phone, app:"customer", purpose}.
3. Step 2 – OTP: six one-digit boxes (auto-advance, paste support), a 30-second "Resend OTP" timer,
   and "Change number". In demo/dev mode show the dev_otp in a small hint ("Demo OTP: 123456").
4. Create account only – Step 3 – Your details: full name (required), email (optional).
   Submit -> auth.register {phone, otp, app:"customer", name, email}.
   (Collect the OTP in step 2 but send it with register in step 3, so the OTP is consumed only once.)
5. Create account only – Step 4 – Delivery address (next_step = "ADD_ADDRESS"):
   label (Home/Work/Other), address line, landmark, city, and a location picker:
   "Use my current location" (navigator.geolocation) or a pin on the map (reuse App.maps / Leaflet).
   Submit -> addresses.add, with is_default = true. Allow "Skip for now", but block checkout later
   until an address exists.
6. Log in -> auth.login {phone, otp, app:"customer"}. Handle errors:
   USER_NOT_FOUND -> show "No account found" with a button "Create account" that keeps the phone.
   ROLE_MISSING -> not possible for customer, but show the message from the server if it ever happens.
7. On success: session.login(data) (store token, user_id, name, roles exactly like the current session code does
   in api.js createSession), then ctx.go() so the home screen loads. Show the user's name in the app bar.

UI RULES
- A step indicator (1 Phone · 2 OTP · 3 Details · 4 Address) at the top of the card.
- Inline field errors under each input (red token), a disabled submit button while busy (App.ui.busy).
- Every call goes through ctx.api.run("operation.name", body) so the inspector shows it and the response is the envelope.
- Keep the "Sample accounts" list, but move it into a collapsible "Demo accounts" section below the form
  (the seeded users must still work for testing).
- Works on a 360 px wide phone screen. Dark mode must look right.

MOCK SERVER
Implement auth.checkPhone, auth.register, auth.login, auth.refresh in mock-server.js with the SAME rules and error codes
as the backend (users and user_roles arrays in the mock database, 409 duplicates, 404 USER_NOT_FOUND, 403 ROLE_MISSING),
so the demo build (build_demo.py -> dist/foodwings-demo.html) behaves exactly like the real API.

ACCEPTANCE CRITERIA
- A brand-new number can register, add an address, and immediately see the restaurant list.
- In PostgreSQL: one new users row, one user_roles row with role_id 1, one addresses row with is_default = true.
- Logging out and logging in again with the same number uses the SAME user_id.
- Placing an order from this new customer creates orders.user_id = the new user_id.
```

---

## Prompt 3 – Restaurant app: Register (onboarding wizard) / Login

```text
TASK: Build Register / Login for the RESTAURANT app (restaurant.html). A restaurant owner registers themselves
AND their restaurant. The restaurant starts as PENDING until an admin approves it.

BACKEND ADDITIONS (api/app/routers/restaurant.py, schemas in app/schemas.py, names in OPERATION_NAMES)
1. POST /restaurants/onboard already exists. Change only:
   - Reject with 409 if this user is already OWNER of a restaurant (one restaurant per owner in this version).
   - FSSAI number: exactly 14 digits (pattern ^[0-9]{14}$). Duplicate -> 409 "FSSAI number already registered".
   - GST optional: pattern ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$.
   - latitude -90..90, longitude -180..180, city required.
   - Return {restaurant_id, status:"PENDING", token, roles} (fresh token from Prompt 1).
   All inserts (restaurants, restaurant_staff OWNER, user_roles role 2) in ONE transaction.
2. PUT /restaurant/{restaurant_id}/timings  (role RESTAURANT_OWNER, must be OWNER of this restaurant)
   body: list of {day_of_week 1–7, open_time "HH:MM", close_time "HH:MM"}; open_time < close_time.
   Replace the restaurant's rows in restaurant_timings in one transaction.
3. POST /restaurant/{restaurant_id}/categories {name, sort_order}  -> menu_categories
   POST /restaurant/{restaurant_id}/items {category_id, name, description, price (DECIMAL > 0), is_veg, image_url?}
   -> menu_items. Check that category_id belongs to the same restaurant (otherwise 404).
   Use the existing columns of menu_categories / menu_items exactly as they are in db/01_schema.sql.
4. Every /restaurant/{restaurant_id}/... endpoint must check that the logged-in user is in restaurant_staff
   for that restaurant (403 otherwise). Reuse the existing helper if there is one; otherwise write
   `require_staff(conn, user_id, restaurant_id, roles=("OWNER","MANAGER"))`.

FRONTEND FLOW (restaurant app)
1. Same Phone -> OTP steps as the customer (share the component; pass app:"restaurant").
2. Create account: Step "Owner details": name, email -> auth.register {app:"restaurant"} (no role yet).
3. Step "Restaurant details" (next_step = RESTAURANT_DETAILS):
   restaurant name, cuisines (chips: South Indian, North Indian, Chinese, Biryani, Desserts…),
   address line, city, map pin for latitude/longitude, FSSAI no, GST no (optional)
   -> restaurants.onboard. Save the returned token into the session (session.login with the new token and roles).
4. Step "Opening hours": a 7-day grid with a toggle per day and open/close times, "Copy Monday to all days"
   -> restaurant.timings.
5. Step "First menu" (optional, can skip): add one category and a few items -> restaurant.categories.add / restaurant.items.add.
6. Done screen "Under review": shows restaurant name, status PENDING badge, FSSAI no, and
   "We will notify you once approved." Poll GET /restaurant/mine every few seconds (or a Refresh button);
   when status becomes ACTIVE call auth.refresh and open the normal dashboard.
7. Log in: auth.login {app:"restaurant"}.
   - next_step RESTAURANT_DETAILS -> resume the wizard where they stopped (no restaurant yet).
   - next_step WAIT_FOR_APPROVAL -> "Under review" screen.
   - status SUSPENDED/CLOSED -> a read-only screen with the reason and a support message.
   - HOME -> the existing restaurant dashboard (orders, menu, payouts).
   - ROLE_MISSING (a customer-only number) -> message plus a button "Register your restaurant with this number",
     which continues the wizard with the SAME user_id.
8. Update the noRole screen in shell.js so it offers "Register for this app" instead of only "Log out".

RULES
- While the restaurant is PENDING, the "Open/Closed" switch is disabled and the restaurant must not appear in the
  customer's restaurant list (check GET /restaurants already filters status = 'ACTIVE'; add the filter if not).
- Add all new operations to operations.js, mock-server.js and OPERATION_NAMES.

TESTS (api/tests/test_restaurant_onboarding.py)
- register -> onboard -> rows in users, user_roles(role 2), restaurants(PENDING), restaurant_staff(OWNER)
- duplicate FSSAI -> 409; second restaurant for the same owner -> 409
- PENDING restaurant is not in GET /restaurants; after admin approve it is
- another owner cannot edit this restaurant's timings or menu -> 403

ACCEPTANCE CRITERIA
- A new owner can register, create a restaurant, set hours and a menu, wait for approval, and then receive orders.
- restaurants.restaurant_id of the new restaurant is what the dashboard uses for every call.
```

---

## Prompt 4 – Rider app: Register (KYC wizard) / Login

```text
TASK: Build Register / Login for the RIDER app (rider.html). A rider registers, gives vehicle details,
uploads KYC documents, and waits for verification before going online.

BACKEND ADDITIONS (api/app/routers/partner.py)
1. POST /partners/onboard already exists. Change only:
   - 409 if delivery_partners already has a row for this user.
   - vehicle_type in BIKE/SCOOTER/CYCLE/EV.
   - vehicle_no required unless vehicle_type = CYCLE; Indian format like KA01AB1234
     (pattern ^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$, uppercase it first).
   - licence_no required unless CYCLE; duplicate -> 409 "Licence already registered".
   - Return {partner_id (= user_id), kyc_status:"PENDING_KYC", token, roles}.
   delivery_partners + user_roles role 4 in ONE transaction.
2. POST /partner/documents (role DELIVERY_PARTNER), multipart/form-data: doc_type (LICENCE/RC/ID_PROOF/PHOTO) + file.
   - Allow only image/jpeg, image/png, application/pdf, max 5 MB. Check the real file signature, not just the extension.
   - Save the file OUTSIDE the database: local folder api/uploads/partner_docs/<partner_id>/<random uuid>.<ext>
     (in production this would be S3). Store only that path in partner_documents.file_url.
   - Re-uploading the same doc_type replaces the old row (verified = FALSE again).
   - Never log the file contents. Add api/uploads/ to .gitignore.
   GET /partner/documents -> list of {doc_type, verified, uploaded_at} for the logged-in rider (no file paths to other riders).
3. KYC rule: POST /partner/status {online:true} must return 409 "KYC not verified" unless kyc_status = 'VERIFIED'.
   Check the current code; add the check if it is missing.
4. Add operation names: partners.onboard (if missing), partner.documents.upload, partner.documents.list.
   For the upload, the frontend api.js needs a FormData path (do not JSON-encode). Add a `multipart: true`
   flag in operations.js and handle it in api.js and mock-server.js.

FRONTEND FLOW (rider app)
1. Phone -> OTP (shared component, app:"rider").
2. Create account: "Personal details": name, email -> auth.register {app:"rider"}.
3. "Vehicle details" (next_step = RIDER_DETAILS): vehicle type cards (Bike / Scooter / Cycle / EV), vehicle number,
   driving licence number, city -> partners.onboard. Save the fresh token in the session.
4. "Documents": four upload tiles (Driving licence, RC, ID proof, Profile photo) with preview, progress, and
   status (Not uploaded / Uploaded / Verified). For a CYCLE, only ID proof and photo are required.
5. "Verification pending" screen: shows kyc_status PENDING_KYC, the document checklist, and a disabled
   "Go online" button with the text "You can go online after verification". Poll GET /partner/me; when
   kyc_status becomes VERIFIED call auth.refresh and open the normal rider home (map, offers, earnings).
   If REJECTED, show which documents to upload again.
6. Log in: auth.login {app:"rider"}:
   - RIDER_DETAILS -> resume the wizard; WAIT_FOR_APPROVAL -> pending screen; REJECTED -> re-upload screen;
     HOME -> existing rider screen.
   - ROLE_MISSING (customer-only number) -> "Become a delivery partner with this number" -> continue with the SAME user_id.
7. Ask for location permission on the pending screen and explain why (needed for order offers).

TESTS (api/tests/test_rider_onboarding.py)
- register -> onboard -> users, user_roles(role 4), delivery_partners(PENDING_KYC, partner_id = user_id)
- upload a PNG -> partner_documents row, file exists on disk, file_url is not a URL to another rider
- upload a .exe renamed to .png -> 400; a 6 MB file -> 413
- going online before verification -> 409; after admin verify -> 200
- an existing customer (seed user 101) registering as a rider keeps user_id 101

ACCEPTANCE CRITERIA
- A new rider can register, upload documents, get verified, go online, and receive an order offer.
- delivery_partners.partner_id equals users.user_id for that rider.
```

---

## Prompt 5 – Admin approval screen (needed to finish the flow)

```text
TASK: Add a small ADMIN app so new restaurants and riders can be approved from the UI (today it is only an API).

1. Backend (api/app/routers/admin.py, role ADMIN):
   - GET /admin/restaurants?status=PENDING -> id, name, city, fssai_no, gst_no, owner name and phone (masked), created_at
   - POST /admin/restaurants/{id}/approve (exists) and POST /admin/restaurants/{id}/reject {reason} -> status SUSPENDED
   - GET /admin/partners?kyc_status=PENDING_KYC -> partner_id, name, vehicle, licence_no, city, documents list
   - GET /admin/partners/{id}/documents/{doc_id}/file -> streams the file (ADMIN only)
   - POST /admin/partners/{id}/verify (exists): also set partner_documents.verified = TRUE, verified_at = now()
   - POST /admin/partners/{id}/reject {reason} -> kyc_status REJECTED
   Every change also writes a line to the application log (who, what, which id) with no personal data except ids.
2. Frontend: frontend/admin.html + frontend/js/screens/admin.js, mounted with App.mountApp(root, "admin").
   Add "admin" to App.APPS in shell.js with roles ["ADMIN"]. Two tabs: Restaurants | Riders, each with
   Approve / Reject buttons and a document viewer for riders.
3. Login uses the same Login component with app:"admin" (no Create account tab for admin; admins are created only by seed/SQL).
   Seed admin: user 401, phone 9845044441.
4. Add the operations to operations.js, mock-server.js and OPERATION_NAMES. Include the admin app on index.html
   as a fourth, narrower column (optional toggle).

ACCEPTANCE CRITERIA
- Approving in the admin app makes the restaurant / rider app move from "Under review" to the dashboard
  within one poll cycle, without logging out.
```

---

## Prompt 6 – End-to-end check: a brand-new ID flows through all three apps

```text
TASK: Prove that brand-new accounts (not seed users) work through the whole order flow.
Write api/tests/test_e2e_new_accounts.py (pytest, real API + PostgreSQL) AND a Playwright script
tests/e2e/new_accounts.spec.js (or .py) that drives the real UI.

SCENARIO (use fresh phone numbers generated per run, for example 98760xxxxx)
1. Customer C registers (name, email, address in Bengaluru near the seed restaurants) -> remember C.user_id.
2. Owner O registers, onboards restaurant R (coordinates within 3 km of C's address), sets hours,
   adds category "Mains" and item "Masala Dosa" Rs 90 -> remember R.restaurant_id and the item_id.
3. Rider P registers (BIKE), uploads 4 documents -> remember P.user_id.
4. Admin (9845044441) approves R and verifies P.
5. O opens the restaurant (is_open = true). P goes online and sends a location near R.
6. C sees R in the restaurant list, adds 2 x Masala Dosa, places the order with card 4111 1111 1111 1111,
   expiry 12/30, CVV 123 -> remember order_id.
7. O accepts -> P receives the offer and accepts -> O marks READY -> P picks up -> P delivers.
8. C sees DELIVERED and rates the order.

ASSERT IN THE DATABASE
- orders.user_id = C.user_id, orders.restaurant_id = R.restaurant_id, orders.partner_id = P.user_id
- order_status_history has PLACED, ACCEPTED, PREPARING, READY, PICKED_UP, DELIVERED in order
- delivery_assignments has exactly one ACCEPTED row for P
- payments.status = SUCCESS; saved card data is only token + last4 + network + expiry
- The CVV "123" and the full card number appear in NO table (search every text/jsonb column) and NOT in the log file
- partner_earnings has a row for P; restaurant_payouts can be computed for R
- user_roles: C has only CUSTOMER, O has RESTAURANT_OWNER, P has DELIVERY_PARTNER
- No duplicate users rows for any phone

Print a short report at the end: each new ID created and each step PASS/FAIL.
Also add a README section "Register & Login" that explains the flow, the new endpoints, and how to run these tests.
```

---

## Quick reference – what each app writes to the database

| App | Register writes | Becomes usable when |
|---|---|---|
| Customer | `users` → `user_roles` (role 1) → `addresses` | Immediately |
| Restaurant | `users` → `restaurants` (PENDING) + `restaurant_staff` (OWNER) + `user_roles` (role 2) → `restaurant_timings` → `menu_categories` / `menu_items` | Admin sets `restaurants.status = 'ACTIVE'` |
| Rider | `users` → `delivery_partners` (PENDING_KYC, `partner_id = user_id`) + `user_roles` (role 4) → `partner_documents` | Admin sets `kyc_status = 'VERIFIED'` |
| All | `otp_requests` stores only the OTP **hash**; login = phone + OTP; one phone = one `user_id`, roles added per app | — |

**Optional, only if you also want passwords:** ask the IDE for a separate migration `db/05_password_login.sql` that adds `users.password_hash VARCHAR(255)` (bcrypt or argon2 hash only, never the plain password), plus a password-strength rule and a "Forgot password via OTP" flow. The prompts above don't need it.
