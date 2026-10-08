# Foodu UI design spec (for the IDE)

This folder holds the screen designs for the Foodu food delivery app: a customer web app, a restaurant dashboard (Kitchen Portal), a rider phone app (Rider HUD) and an admin page. Each `*.dc.html` file is one screen, exported from the "Foodu App Design" canvas. View the screens on that canvas; here, read the markup for exact layout, spacing, colours and text. (These files use the design canvas format: `<x-dc>` markup with `{{...}}` placeholders filled from the small script at the bottom of each file, so they do not render correctly when opened directly in a browser.)

Build the real screens in `frontend/` with plain HTML, CSS and JavaScript, following the existing project rules: every API call goes through `js/core/api.js`, is listed in `js/core/operations.js`, and is mirrored in `js/core/mock-server.js`. Do not change the database schema.

---

## 1. Theme

### Colours

| Token | Hex | Use |
|---|---|---|
| `--green` | `#13A04F` | Brand green: page headers, hero, active nav, rating badge |
| `--green-strong` | `#0E8A42` | Main action buttons (Accept, Checkout, Pay) |
| `--green-text` | `#0E7A3C` | Green text and links on white |
| `--green-tint` | `#E7F6EC` | Chips, selected options, success notes |
| `--ink` | `#111311` | Main text, dark buttons, dark sidebars |
| `--muted` | `#5D6560` | Secondary text |
| `--line` | `#D6DCD8` | Input and card borders |
| `--divider` | `#E4E8E5` | Thin dividers |
| `--page` | `#F4F7F5` | Page background |
| `--card` | `#FFFFFF` | Cards |
| `--warn-bg` / `--warn-text` | `#FFF4D6` / `#7A4B00` | Pending, preparing, test-mode notes |
| `--error-bg` / `--error-text` | `#FDECEA` / `#8E1F16` | Errors, rejected, cancelled |
| `--veg` / `--nonveg` | `#138A44` / `#A8261B` | Veg and non-veg dish markers |
| `--map-bg` / `--route` | `#E9EFEB` / `#FFD60A` on `#111311` | Maps: background, active route |

### Typography

- Font: **Outfit** (Google Fonts), weights 400, 500, 600, 700, 800.
- Hero heading: 72px / 800, letter-spacing -0.03em.
- Page title: 32–36px / 800.
- Card title: 20–24px / 800.
- Body: 15–17px / 400–600.
- Eyebrow labels (e.g. TOP RESTAURANTS, KITCHEN PORTAL): 12–16px / 600–700, uppercase, letter-spacing 0.08–0.14em.

### Shape and spacing

- Cards: white, radius 20–28px, shadow `0 1px 2px rgba(17,19,17,.06), 0 10px 28px rgba(17,19,17,.06)`.
- Buttons: pill (radius 999px), min height 44–54px. Dark (`--ink`), green (`--green-strong`), ghost (white with `--line` border).
- Inputs: height 48–54px, radius 12–14px, 1.5px `--line` border.
- Chips: pill, `--green-tint` background, `--green-text`, uppercase 12–13px bold.
- Spacing scale: 4, 8, 12, 16, 20, 24, 28, 32, 48.
- Desktop content max width 1280px with 24px side padding. Phone screens 390 × 844.
- Touch targets at least 44px.

### Shared components

| Component | Where | Notes |
|---|---|---|
| Green header bar | Customer screens | Logo, address picker, search, My orders, Cart button, avatar |
| Dark sidebar | Kitchen Portal | Logo + "KITCHEN PORTAL", nav: Live orders, Menu & stock, Payouts, Restaurant profile |
| Phone header | Rider HUD | Green, "RIDER HUD" eyebrow, step label or earnings |
| Veg marker | Menus, cart | Square outline with dot, green = veg, dark red = non-veg |
| Status badge | Orders, payouts, KYC | Pill: green = done/paid, amber = pending/preparing, red = cancelled/rejected |
| Map | Tracking, rider screens | Pins: K = restaurant (red), H = home (green), R = rider (black); active route yellow on black, next leg dashed grey |
| Bottom sheet | Rider pickup/drop | White, rounded top 28px, main action at the bottom |

---

## 2. Screens

Each row: design file → page to build → what it shows → actions and the API they call.

### Entry

| Design file | Build as | Shows | Actions → API |
|---|---|---|---|
| `Main.dc.html` | `index.html` (landing) | Hero, address + search bar, three app cards, "how it works", footer | Links to the three apps and sign-in |
| `SignIn.dc.html` | `login.html` (Sign in tab) | App picker (Customer / Restaurant / Rider), phone, 6 OTP boxes, resend timer, test-mode OTP note | Send OTP → `POST /auth/otp/request` · Verify → `POST /auth/login` (404 → go to register, 403 → offer to register for this app) |
| `Register.dc.html` | `login.html` (Create account tab) | Step indicator, then the last step per app | `POST /auth/register` then: customer → `POST /me/addresses`; restaurant → `POST /restaurants/onboard`; rider → `POST /partners/onboard` + document upload |

### Customer app (web)

| Design file | Build as | Shows | Actions → API |
|---|---|---|---|
| `CustomerHome.dc.html` | `customer.html` home | Coupon cards, last order, filters, restaurant cards (photo, offer, rating, cuisines, ETA, km, area) | Address change → `GET /restaurants?address_id=` · open card → menu |
| `CustomerMenu.dc.html` | menu screen | Restaurant banner, category nav, dishes with veg marker, price, sold-out state, add-ons, cart panel | `GET /restaurants/{id}/menu` · ADD → `POST /cart/items` (409 → ask to replace cart) · remove → `DELETE /cart/items/{id}` |
| `CustomerCheckout.dc.html` | checkout screen | Address choice, payment options (saved card, new card, UPI, cash), coupon, bill, decline note | `GET /me/addresses`, `GET /me/payment-methods` · Pay → `POST /orders/checkout` then card to gateway → `POST /payments/{id}/pay` (402 = declined, allow retry) |
| `CustomerTracking.dc.html` | tracking screen | Map with K/H/R pins and ETA, 6-step timeline, rider card, order summary | Poll `GET /orders/{id}` |
| `CustomerOrders.dc.html` | orders screen | Order list with status badges, reorder, rating panel | `GET /me/orders` · `POST /orders/{id}/cancel` (only before the restaurant accepts) · `POST /orders/{id}/rate` |

The card number and CVV fields send data **only to the payment gateway SDK**, never to our API. Only the gateway token is sent to `/payments/{id}/pay`.

### Restaurant app: Kitchen Portal (desktop)

| Design file | Build as | Shows | Actions → API |
|---|---|---|---|
| `KitchenOrders.dc.html` | `restaurant.html` live orders | Open/closed switch, 4 stat tiles, columns New / Preparing / Ready for pickup | `GET /restaurant/{rid}/orders` · Accept → `.../accept` · Ready → `.../ready` · switch → `POST /restaurant/{rid}/open` |
| `KitchenMenu.dc.html` | menu screen | Category tabs, dish table with price input and stock switch | `PATCH /restaurant/{rid}/items/{item_id}` |
| `KitchenPayouts.dc.html` | payouts screen | Pending / paid / commission tiles, payout table | `GET /restaurant/{rid}/payouts` |
| `KitchenOnboarding.dc.html` | profile / pending screen | "Under review" banner with 4-step checklist, restaurant details form, 7-day opening hours | `GET /restaurant/mine` (status PENDING), save details, opening hours (new endpoint if needed) |

### Rider app: Rider HUD (phone, 390 × 844)

| Design file | Build as | Shows | Actions → API |
|---|---|---|---|
| `RiderOnboarding.dc.html` | `rider.html` pending state | KYC pending card, vehicle, 4 documents with upload buttons, location permission, disabled Go online | `GET /partner/me` (kyc_status) · document upload (new endpoint if needed) |
| `RiderHome.dc.html` | home | Online switch, today's earnings, map, offer card with pickup/drop, pay, countdown, Accept/Reject | `POST /partner/status` · `POST /partner/location` · `GET /partner/offers` · accept/reject `POST /partner/offers/{id}/accept\|reject` |
| `RiderPickup.dc.html` | step 1 | Map to restaurant, restaurant address, Navigate, order items, food-ready badge | `POST /partner/orders/{id}/pickup` |
| `RiderDrop.dc.html` | step 2 | Map to customer, address and landmark, Call, Navigate, cash-collected field for COD | `POST /partner/orders/{id}/deliver` (send `cash_collected` for COD) |
| `RiderEarnings.dc.html` | earnings | Today total, paid/pending, per-trip breakdown, bottom nav | `GET /partner/earnings` |

### Admin

| Design file | Build as | Shows | Actions → API |
|---|---|---|---|
| `AdminApprovals.dc.html` | `admin.html` | Tabs Restaurants / Riders, pending cards with details and documents | `POST /admin/restaurants/{id}/approve` · `POST /admin/partners/{id}/verify` (reject endpoints are new, if wanted) |

---

## 3. Notes for building

- Sample data in the designs comes from `db/03_seed.sql` (Ravi Kumar, Spice Route Biryani House, Suresh B, and so on). Some order numbers and amounts on the Kitchen and payout screens are examples for layout only. Real screens must show API data.
- Images in the designs are labelled placeholders such as `[Dish photo]`. The schema has `menu_items.image_url`; use it where present, otherwise show the placeholder block.
- Every list needs an empty state, and every action button a loading state, and errors shown in the `--error` colours using the message from the API envelope.
- Phone layouts: customer and kitchen pages must also work at phone width (stack columns, wrap toolbars, scroll wide tables).
