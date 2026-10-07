-- =====================================================================
--  04_flow_walkthrough.sql
--  One complete order in plain SQL, from login to payment to delivery.
--  This is exactly what the API does behind each screen.
--  Run with psql (it uses \gset to remember new IDs):
--     psql -d swiggy_db -f db/04_flow_walkthrough.sql
-- =====================================================================
SET search_path = public;
\set ON_ERROR_STOP on

-- STEP 1  Customer opens app, logs in with phone -> find the user and roles
SELECT u.user_id, u.name, array_agg(r.role_name) AS roles
FROM users u JOIN user_roles ur USING (user_id) JOIN roles r USING (role_id)
WHERE u.phone = '9845011111'
GROUP BY u.user_id, u.name;

-- STEP 2  Home screen: open, active restaurants within 5 km of the Home address (address 11)
SELECT r.restaurant_id, r.name, r.avg_rating,
       round((6371 * acos(least(1, cos(radians(a.latitude)) * cos(radians(r.latitude))
             * cos(radians(r.longitude) - radians(a.longitude))
             + sin(radians(a.latitude)) * sin(radians(r.latitude)))))::numeric, 2) AS distance_km
FROM restaurants r, addresses a
WHERE a.address_id = 11 AND r.status = 'ACTIVE' AND r.is_open
ORDER BY distance_km;

-- STEP 3  Open the menu of restaurant 1
SELECT c.name AS category, i.item_id, i.name, i.price, i.is_veg, i.in_stock
FROM menu_items i JOIN menu_categories c USING (category_id)
WHERE i.restaurant_id = 1 ORDER BY c.sort_order, i.name;

-- STEP 4  Add to cart (cart remembers the restaurant)
INSERT INTO carts (user_id, restaurant_id) VALUES (101, 1)
ON CONFLICT (user_id) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, updated_at = now()
RETURNING cart_id \gset
DELETE FROM cart_items WHERE cart_id = :cart_id;
INSERT INTO cart_items (cart_id, item_id, quantity, selected_addons) VALUES
  (:cart_id, 501, 2, '[801]'), (:cart_id, 506, 1, '[]');

-- STEP 5  Checkout + payment record in ONE transaction (all or nothing)
BEGIN;
  INSERT INTO orders (customer_id, restaurant_id, address_id, coupon_id, item_total, delivery_fee,
                      platform_fee, taxes, discount, total_amount, payment_mode, status)
  VALUES (101, 1, 11, NULL, 790, 30, 5, 39.50, 0, 864.50, 'CARD', 'PAYMENT_PENDING')
  RETURNING order_id \gset

  INSERT INTO order_items (order_id, item_id, item_name, quantity, price_at_order, addons, line_total)
  SELECT :order_id, i.item_id, i.name, ci.quantity, i.price,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('addon_id',a.addon_id,'name',a.name,'price',a.price))
                   FROM item_addons a WHERE a.addon_id IN (SELECT jsonb_array_elements_text(ci.selected_addons)::bigint)), '[]'),
         ci.quantity * (i.price + COALESCE((SELECT sum(a.price) FROM item_addons a
                         WHERE a.addon_id IN (SELECT jsonb_array_elements_text(ci.selected_addons)::bigint)),0))
  FROM cart_items ci JOIN menu_items i USING (item_id)
  WHERE ci.cart_id = :cart_id;

  INSERT INTO order_status_history (order_id, status, changed_by) VALUES (:order_id, 'PAYMENT_PENDING', 101);

  -- payment row: uses the SAVED CARD TOKEN (method 1). No card number, no CVV.
  INSERT INTO payments (order_id, user_id, gateway_id, method_type, saved_method_id, card_network, card_last4,
                        amount, status, idempotency_key, gateway_order_ref)
  VALUES (:order_id, 101, 1, 'CARD', 1, 'VISA', '1111', 864.50, 'CREATED',
          'walkthrough-' || :order_id, 'mock_order_' || :order_id)
  RETURNING payment_id \gset
COMMIT;

-- STEP 6  Gateway says "captured" (via API response or webhook)
BEGIN;
  INSERT INTO payment_transactions (payment_id, txn_type, amount, status, gateway_txn_ref, gateway_response)
  VALUES (:payment_id, 'CAPTURE', 864.50, 'SUCCESS', 'mock_pay_' || :order_id,
          jsonb_build_object('status','captured','card',jsonb_build_object('network','VISA','last4','1111')));
  UPDATE payments SET status = 'CAPTURED', gateway_payment_ref = 'mock_pay_' || :order_id WHERE payment_id = :payment_id;
  UPDATE orders   SET status = 'PLACED' WHERE order_id = :order_id;
  INSERT INTO order_status_history (order_id, status, changed_by) VALUES (:order_id, 'PLACED', NULL);
  DELETE FROM cart_items WHERE cart_id = :cart_id;
COMMIT;

-- STEP 7  Restaurant app: new orders, then accept (by owner 201)
SELECT order_id, total_amount, status FROM orders WHERE restaurant_id = 1 AND status = 'PLACED';
UPDATE orders SET status = 'ACCEPTED' WHERE order_id = :order_id;
INSERT INTO order_status_history (order_id, status, changed_by) VALUES (:order_id, 'ACCEPTED', 201);

-- STEP 8  System finds nearest online, verified, free partner and offers the order
SELECT dp.partner_id
FROM delivery_partners dp JOIN partner_locations pl USING (partner_id), restaurants r
WHERE r.restaurant_id = 1 AND dp.is_online AND dp.kyc_status = 'VERIFIED' AND dp.current_order_id IS NULL
ORDER BY (pl.latitude - r.latitude)^2 + (pl.longitude - r.longitude)^2
LIMIT 1 \gset
INSERT INTO delivery_assignments (order_id, partner_id) VALUES (:order_id, :partner_id) RETURNING assignment_id \gset

-- STEP 9  Partner accepts
BEGIN;
  UPDATE delivery_assignments SET status = 'ACCEPTED', responded_at = now() WHERE assignment_id = :assignment_id;
  UPDATE orders SET partner_id = :partner_id WHERE order_id = :order_id;
  UPDATE delivery_partners SET current_order_id = :order_id WHERE partner_id = :partner_id;
COMMIT;

-- STEP 10  Ready -> picked up -> live location -> delivered
UPDATE orders SET status = 'READY' WHERE order_id = :order_id;
INSERT INTO order_status_history (order_id, status, changed_by) VALUES (:order_id, 'READY', 204);
UPDATE orders SET status = 'PICKED_UP' WHERE order_id = :order_id;
INSERT INTO order_status_history (order_id, status, changed_by) VALUES (:order_id, 'PICKED_UP', :partner_id);
INSERT INTO partner_locations (partner_id, latitude, longitude) VALUES (:partner_id, 12.9280, 77.5830)
ON CONFLICT (partner_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = now();

BEGIN;
  UPDATE orders SET status = 'DELIVERED', delivered_at = now() WHERE order_id = :order_id;
  INSERT INTO order_status_history (order_id, status, changed_by) VALUES (:order_id, 'DELIVERED', :partner_id);
  UPDATE delivery_partners SET current_order_id = NULL WHERE partner_id = :partner_id;
  INSERT INTO partner_earnings (partner_id, order_id, base_pay, distance_pay) VALUES (:partner_id, :order_id, 25, 8);
  INSERT INTO restaurant_payouts (restaurant_id, order_id, order_amount, commission, payout_amount)
  SELECT restaurant_id, order_id, item_total, round(item_total * 0.18, 2), item_total - round(item_total * 0.18, 2)
  FROM orders WHERE order_id = :order_id;
COMMIT;

-- STEP 11  Rating
INSERT INTO ratings (order_id, user_id, food_rating, delivery_rating, comment) VALUES (:order_id, 101, 5, 5, 'Super fast!');

-- RESULT: the whole story of the order, following the IDs
SELECT o.order_id, cu.name AS customer, r.name AS restaurant, dp.name AS partner,
       o.total_amount, o.status, p.method_type, p.card_network || ' **** ' || p.card_last4 AS card, p.status AS payment
FROM orders o
JOIN users cu ON cu.user_id = o.customer_id
JOIN restaurants r ON r.restaurant_id = o.restaurant_id
LEFT JOIN users dp ON dp.user_id = o.partner_id
JOIN payments p ON p.order_id = o.order_id
WHERE o.order_id = :order_id;

SELECT status, changed_by, changed_at FROM order_status_history WHERE order_id = :order_id ORDER BY changed_at;
