# Prompt for your IDE: build the dynamic Foodu front end

Paste the block below into your IDE chat (Cursor, Copilot Chat, Windsurf, Claude Code, etc.). Then paste **one screen prompt at a time** from Part 2, and check each screen in the browser before moving on.

---

## Part 1 – Context (paste first, once per chat)

```text
You are working on the Foodu (FoodWings) food delivery project in this folder.
Read these first, before writing code:
  - docs/foodu-design/UI_DESIGN_SPEC.md   (colours, font, components, every screen and the API it calls)
  - docs/foodu-design/*.dc.html           (the design for each screen: exact layout, text, CSS and behaviour)
  - docs/foodu-design/img/*.jpg           (the food and restaurant photos to use)
  - frontend/                             (the existing app: js/core/api.js, operations.js, mock-server.js, screens)

About the .dc.html design files:
  - They are design-canvas files, NOT pages to copy as-is. Treat them as a precise reference.
  - Markup is inside <x-dc>. CSS is in <helmet><style>. Behaviour is the JavaScript class at the bottom
    (state in this.state, values in renderVals()).
  - {{name}} means "a value from renderVals()". <sc-for list="{{items}}" as="x"> means "repeat for each item".
    <sc-if value="{{flag}}"> means "show only when flag is true". onClick="{{fn}}" means "call fn on click".
  - Translate them into plain HTML + CSS + JavaScript that fits the existing frontend structure.
  - Image paths like /_blob/... are canvas uploads. Use the matching file from docs/foodu-design/img instead
    (copy the folder to frontend/img). Mapping: biryani.jpg, dosa.jpg, idli.jpg, pizza.jpg, north-indian.jpg,
    south-indian.jpg, desserts.jpg, chinese.jpg, rolls.jpg (thali/spices), salad.jpg, tea.jpg, burger.jpg,
    dineout.jpg, hero-groceries.jpg, hero-sushi.jpg, grocery-shelf.jpg, restaurant-1.jpg, restaurant-2.jpg, cafe.jpg.

Rules you must follow:
1. Plain HTML, CSS and JavaScript only. No React, no build step. Keep the global App object and the existing
   screen pattern (state, load(), render(), actions with data-action / data-change).
2. Every API call goes through js/core/api.js, is listed in js/core/operations.js and is answered in
   js/core/mock-server.js too (demo mode must keep working). Use the real endpoints listed in UI_DESIGN_SPEC.md.
3. Put the design tokens in frontend/css/styles.css as CSS variables (from UI_DESIGN_SPEC.md section 1):
   --green #13A04F, --green-strong #0E8A42, --green-text #0E7A3C, --green-tint #E7F6EC, --ink #111311,
   --muted #5D6560, --line #D6DCD8, --page #F4F7F5, warn/error colours. Font: Outfit (Google Fonts).
4. Create ONE shared animation file frontend/css/motion.css with these reusable classes, copied from the designs:
   fadeUp (cards appear), pop (badges, check marks), shake (errors), toast (bottom message), spin (loading),
   pulse / ping (map pins), shimmer (offer chip and slide button), float (landing photos), kenburns (slow photo zoom),
   draw (success tick), confetti (order placed).
   Image effects: .photo img zooms to scale(1.08) and saturate(1.25) on card hover; sold-out and closed items use
   filter: grayscale(1). Wrap all motion in @media (prefers-reduced-motion: reduce) { animation:none; transition:none }.
5. Every photo: <img loading="lazy" alt="..."> inside a .photo box with a green gradient background, so a missing
   image never shows a broken icon. Use object-fit: cover.
6. Keep the CVV rule: card number and CVV go only to the gateway SDK (js/core/gateway-sdk.js); only the token is
   sent to our API. Never log card data.
7. Buttons are real <button> or <a> elements, minimum 44px tall. Every list has an empty state, every action a
   loading state, and errors use the API envelope message.
8. After each screen: run the app (python -m uvicorn api.app.main:app --reload --port 8000, open
   http://localhost:8000/app/), check it in demo mode and live mode, and tell me what you changed.

Reply "Context loaded" and list the files you will create or change for the first screen.
```

---

## Part 2 – One prompt per screen (paste in this order)

### 1. Landing page

```text
Build the landing page from docs/foodu-design/Main.dc.html into frontend/index.html.
Must have: green radial-gradient hero with the two floating corner photos (hero-groceries.jpg, hero-sushi.jpg),
fade-up headline, rotating offer chip (changes every 2.6 s with a shimmer), search box that shows a live
suggestion dropdown of dishes with thumbnails as you type (and "No dishes match" when empty), three app cards
(Food delivery / Kitchen Portal / Rider HUD) that lift and zoom their photo on hover, a "What's on your mind?"
row of round dish photos that highlight when picked, and the 4-step "How it works" row where the active step
moves every 2.6 s. Nav links go to the three apps and the sign-in page.
```

### 2. Sign in and register

```text
Build frontend/login.html from SignIn.dc.html and Register.dc.html.
Sign in: app picker (Customer / Restaurant / Rider) that also swaps the left photo, title and text with a slow
Ken Burns zoom; phone field (Send OTP disabled until 10 digits, spinner while sending); 6 OTP boxes driven by
one hidden input with a blinking cursor box; 30 s resend countdown; wrong OTP shakes the form and shows tries
left; success shows a tick and "Open <app>" button. Use POST /auth/otp/request and POST /auth/login.
Register: same app picker; split card with a photo panel on the left and the form for that app on the right
(fade in when switching). Customer form + address pills, restaurant form with cuisine chips and live FSSAI
check (14 digits), rider form with vehicle pills (Cycle hides vehicle number and licence). Use POST /auth/register,
then /me/addresses, /restaurants/onboard or /partners/onboard.
```

### 3. Customer home

```text
Build the customer home from CustomerHome.dc.html.
Sticky green header with address select, live search and cart button. Offer carousel (photo on the right,
auto-advances every 4 s, clickable dots). Filter chips (Biryani, South Indian, Pizza, North Indian, Pure veg,
Rating 4.5+, Under 30 min) that really filter the list, plus a Sort select (Relevance, Rating, Delivery time,
Distance). Restaurant cards with photo, dark gradient and offer text, heart button that pops when saved,
rating badge, cuisines, ETA, km. Cards fade up one after another. Empty state with "Clear filters".
Data: GET /restaurants?address_id=... (changing the address reloads the list).
```

### 4. Restaurant menu and cart

```text
Build the menu screen from CustomerMenu.dc.html.
Photo banner (restaurant-1.jpg darkened) with the dish photo, rating and glass-style chips. Left category list
that filters dishes, Veg-only switch. Each dish: veg mark, BESTSELLER tag, price, description, photo with ADD
button overlapping the bottom; ADD turns into a − qty + stepper; sold-out dishes are grey and disabled.
Customisable dishes open an add-on dialog (blurred backdrop, photo, checkboxes, live price) before adding.
Sticky cart panel updates live: rows slide in, totals change, "Add ₹X more to unlock FLAT75" nudge, empty state.
A toast "Added <dish>" appears at the bottom. Use GET /restaurants/{id}/menu, POST /cart/items,
DELETE /cart/items/{id}; handle 409 (cart from another restaurant) with a confirm to replace.
```

### 5. Checkout and payment

```text
Build checkout from CustomerCheckout.dc.html.
Selectable address cards and payment options (saved card, new card, UPI, cash) with a highlighted selected state.
New card shows a live card preview (number fills in, network detected: VISA/MASTERCARD/RUPAY) with a tilt on hover.
Coupon box: Apply/Remove, messages for valid, expired (DIWALI20) and unknown codes, bill recalculates.
Pay button shows a spinner ("Contacting your bank…"); declined card (4000 0000 0000 0002) shakes the bill and shows
the "Payment failed" message; success shows a dialog with drawn tick and confetti, then "Track my order".
Use POST /orders/checkout (with a new idempotency key per tap), the gateway SDK for the card, then
POST /payments/{id}/pay. Never send card number or CVV to our API.
```

### 6. Live tracking

```text
Build tracking from CustomerTracking.dc.html.
Map area (use Leaflet if available, else the drawn map from the design) with parks/water shapes, the restaurant pin
showing its photo, a pinging home pin and a pulsing rider pin that moves along the route. The active route leg is
yellow on black; the next leg is dashed and moving; finished legs fade. Floating glass card with "Arriving in N min"
and a progress bar. Timeline on the right: done steps green with ticks, current step bigger and black, next steps
faded. Rider card with Call. Poll GET /orders/{id} every few seconds and move the rider to partner_location.
```

### 7. My orders and rating

```text
Build from CustomerOrders.dc.html: tabs Orders / Addresses / Saved cards; order cards with photo, coloured status
badge (preparing, delivered, cancelled grey photo), Track / Reorder / Rate buttons, hover lift. Rating panel with
photo header, two 5-star rows that pop when chosen and show a word (Poor … Loved it), quick-tag chips, comment,
and a success state with a drawn tick. Use GET /me/orders and POST /orders/{id}/rate.
```

### 8. Kitchen Portal: live orders

```text
Build frontend/restaurant.html live orders from KitchenOrders.dc.html.
Dark sidebar with a restaurant photo card. Open/closed switch. Live stat tiles. Three columns New / Preparing /
Ready for pickup; order cards drop in, new orders glow 3 times and the bell rings; each card has a dish thumbnail,
items, note, elapsed timer (turns red when cooking > 20 min), payment badge and rider line.
Accept moves the card to Preparing and shows "Finding a rider…" until a rider is assigned; Mark ready moves it to
Ready; it disappears after the rider picks up. Use GET /restaurant/{rid}/orders (poll), .../accept, .../ready,
POST /restaurant/{rid}/open. In demo mode keep a "Simulate new order" button.
```

### 9. Kitchen Portal: menu, payouts, profile

```text
Build Menu & stock (KitchenMenu.dc.html): category tabs with counts, search, dish rows with photo (zoom on hover),
price input that saves on change (toast "Price saved"), stock switch (toast, row turns grey). PATCH /restaurant/{rid}/items/{id}.
Build Payouts (KitchenPayouts.dc.html): count-up totals, "where each ₹100 goes" animated bar, All/Pending/Paid
tabs, rows fade in. GET /restaurant/{rid}/payouts.
Build Restaurant profile / review (KitchenOnboarding.dc.html): pending banner with pulsing current step, details
form, 7-day hours with working switches and "Copy Monday to all days". GET /restaurant/mine.
```

### 10. Rider HUD

```text
Build frontend/rider.html (phone layout, max-width 430px, centred on desktop) from the Rider*.dc.html files.
Home: online switch (offline greys out the map), radar rings while searching, offer sheet slides up with a
30 s countdown ring, Reject / Accept. Pickup: rider pin moves to the restaurant, ETA counts down, order items with
thumbnails, "Slide to confirm pickup" (range input styled as a slide button with shimmer) unlocks on arrival.
Drop: rider moves to the customer, cash-on-delivery field validates the exact amount (shakes if wrong),
Mark as delivered shows a full-screen success with "+₹35" pop. Earnings: count-up totals, tappable trips with
animated base/distance/tip bar. Onboarding: document upload rows with progress bars, status updates when all four
are done, location permission. Use the /partner/* endpoints from UI_DESIGN_SPEC.md.
```

### 11. Admin

```text
Build frontend/admin.html from AdminApprovals.dc.html: tabs with counts, restaurant card with photo, rider card with
document chips (missing ones amber), Approve/Reject stamps APPROVED/REJECTED on the card, then the card slides out
and the empty state appears. Verify stays disabled until all documents are uploaded.
POST /admin/restaurants/{id}/approve and POST /admin/partners/{id}/verify.
```

---

## Part 3 – Final check (paste last)

```text
Go through every screen in both demo mode and live mode and confirm:
- every photo loads from frontend/img and nothing shows a broken image;
- animations run once and smoothly, and turn off with "reduce motion" enabled in Windows settings;
- layouts work at 1440px, 1024px and 390px wide;
- one full order works end to end: customer orders and pays → kitchen accepts → rider accepts, picks up, delivers →
  customer sees Delivered and rates;
- no card number or CVV appears in the network calls to our API or in logs/app.log.
List anything that does not pass and fix it.
```
