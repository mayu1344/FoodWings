/* =====================================================================
   operations.js - THE CATALOGUE OF EVERY OPERATION
   ---------------------------------------------------------------------
   One entry per thing the app can do. Screens never write URLs or fetch()
   themselves; they call   App.api.call("cart.addItem", { body: {...} })
   and this table says how that operation travels.

   Fields:
     method  HTTP verb
     path    URL with {placeholders} filled from req.params
     auth    false = public, true = any logged-in user, "ROLE" = needs that role
     label   human description (shown in the API inspector)

   The names match OPERATION_NAMES in api/app/main.py, and the server echoes
   the name back in every response as meta.operation.
   ===================================================================== */
App.operations = {
  // ---------- auth (everyone) ----------
  "auth.requestOtp":        { method: "POST",  path: "/auth/otp/request",                           auth: false, label: "Send OTP to phone" },
  "auth.verifyOtp":         { method: "POST",  path: "/auth/otp/verify",                            auth: false, label: "Verify OTP and log in" },
  "auth.me":                { method: "GET",   path: "/auth/me",                                    auth: true,  label: "Who am I" },

  // ---------- customer ----------
  "restaurants.list":       { method: "GET",   path: "/restaurants",                                auth: "CUSTOMER", label: "Restaurants near an address" },
  "restaurants.menu":       { method: "GET",   path: "/restaurants/{restaurant_id}/menu",           auth: false, label: "Menu of a restaurant" },
  "addresses.list":         { method: "GET",   path: "/me/addresses",                               auth: "CUSTOMER", label: "My addresses" },
  "addresses.add":          { method: "POST",  path: "/me/addresses",                               auth: "CUSTOMER", label: "Add address" },
  "cart.get":               { method: "GET",   path: "/cart",                                       auth: "CUSTOMER", label: "My cart" },
  "cart.addItem":           { method: "POST",  path: "/cart/items",                                 auth: "CUSTOMER", label: "Add dish to cart" },
  "cart.removeItem":        { method: "DELETE",path: "/cart/items/{cart_item_id}",                  auth: "CUSTOMER", label: "Remove dish from cart" },
  "paymentMethods.list":    { method: "GET",   path: "/me/payment-methods",                         auth: "CUSTOMER", label: "Saved cards / UPI" },
  "orders.checkout":        { method: "POST",  path: "/orders/checkout",                            auth: "CUSTOMER", label: "Create order + payment" },
  "payments.pay":           { method: "POST",  path: "/payments/{payment_id}/pay",                  auth: "CUSTOMER", label: "Pay with gateway token" },
  "orders.get":             { method: "GET",   path: "/orders/{order_id}",                          auth: true,  label: "Track one order" },
  "orders.mine":            { method: "GET",   path: "/me/orders",                                  auth: "CUSTOMER", label: "My orders" },
  "orders.cancel":          { method: "POST",  path: "/orders/{order_id}/cancel",                   auth: "CUSTOMER", label: "Cancel order (auto refund)" },
  "orders.rate":            { method: "POST",  path: "/orders/{order_id}/rate",                     auth: "CUSTOMER", label: "Rate order" },

  // ---------- restaurant (hotel) ----------
  "restaurant.mine":        { method: "GET",   path: "/restaurant/mine",                            auth: "RESTAURANT_OWNER|RESTAURANT_STAFF", label: "Restaurants I manage" },
  "restaurant.orders":      { method: "GET",   path: "/restaurant/{restaurant_id}/orders",          auth: "RESTAURANT_OWNER|RESTAURANT_STAFF", label: "Live orders by status" },
  "restaurant.accept":      { method: "POST",  path: "/restaurant/{restaurant_id}/orders/{order_id}/accept", auth: "RESTAURANT_OWNER|RESTAURANT_STAFF", label: "Accept order" },
  "restaurant.ready":       { method: "POST",  path: "/restaurant/{restaurant_id}/orders/{order_id}/ready",  auth: "RESTAURANT_OWNER|RESTAURANT_STAFF", label: "Mark food ready" },
  "restaurant.updateItem":  { method: "PATCH", path: "/restaurant/{restaurant_id}/items/{item_id}",  auth: "RESTAURANT_OWNER|RESTAURANT_STAFF", label: "Stock / price change" },
  "restaurant.setOpen":     { method: "POST",  path: "/restaurant/{restaurant_id}/open",            auth: "RESTAURANT_OWNER|RESTAURANT_STAFF", label: "Open / close restaurant" },
  "restaurant.payouts":     { method: "GET",   path: "/restaurant/{restaurant_id}/payouts",         auth: "RESTAURANT_OWNER|RESTAURANT_STAFF", label: "Payouts" },

  // ---------- delivery partner ----------
  "partner.me":             { method: "GET",   path: "/partner/me",                                 auth: "DELIVERY_PARTNER", label: "My partner profile" },
  "partner.setOnline":      { method: "POST",  path: "/partner/status",                             auth: "DELIVERY_PARTNER", label: "Go online / offline" },
  "partner.location":       { method: "POST",  path: "/partner/location",                           auth: "DELIVERY_PARTNER", label: "Send GPS point" },
  "partner.offers":         { method: "GET",   path: "/partner/offers",                             auth: "DELIVERY_PARTNER", label: "Order offers for me" },
  "partner.acceptOffer":    { method: "POST",  path: "/partner/offers/{assignment_id}/accept",      auth: "DELIVERY_PARTNER", label: "Accept offer" },
  "partner.rejectOffer":    { method: "POST",  path: "/partner/offers/{assignment_id}/reject",      auth: "DELIVERY_PARTNER", label: "Reject offer" },
  "partner.pickup":         { method: "POST",  path: "/partner/orders/{order_id}/pickup",           auth: "DELIVERY_PARTNER", label: "Picked up" },
  "partner.deliver":        { method: "POST",  path: "/partner/orders/{order_id}/deliver",          auth: "DELIVERY_PARTNER", label: "Delivered" },
  "partner.earnings":       { method: "GET",   path: "/partner/earnings",                           auth: "DELIVERY_PARTNER", label: "My earnings" },

  // ---------- admin ----------
  "admin.approveRestaurant":{ method: "POST",  path: "/admin/restaurants/{restaurant_id}/approve",  auth: "ADMIN", label: "Approve restaurant" },
  "admin.verifyPartner":    { method: "POST",  path: "/admin/partners/{partner_id}/verify",         auth: "ADMIN", label: "Verify partner KYC" },
};
