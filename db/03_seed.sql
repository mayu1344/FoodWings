-- =====================================================================
--  03_seed.sql : sample data for learning and testing
--  IDs are chosen to be easy to follow:
--     1xx = customers, 2xx = restaurant people, 3xx = delivery partners,
--     4xx = admin, 5xx = menu items, 8xx = add-ons, 9xxx = orders
--  NOTE: no card number or CVV appears anywhere - only gateway tokens + last4.
-- =====================================================================
SET search_path = public;
BEGIN;

-- ---------------- ROLES ----------------
INSERT INTO roles (role_id, role_name) VALUES
 (1,'CUSTOMER'), (2,'RESTAURANT_OWNER'), (3,'RESTAURANT_STAFF'), (4,'DELIVERY_PARTNER'), (5,'ADMIN');

-- ---------------- USERS ----------------
INSERT INTO users (user_id, phone, name, email) VALUES
 (101,'9845011111','Ravi Kumar',      'ravi@example.com'),
 (102,'9845011112','Ananya Rao',      'ananya@example.com'),
 (103,'9845011113','Mohammed Irfan',  'irfan@example.com'),
 (104,'9845011114','Sneha Patil',     'sneha@example.com'),
 (105,'9845011115','Kiran Desai',     'kiran@example.com'),      -- customer AND delivery partner
 (201,'9845022221','Manjunath Gowda', 'manju@spiceroute.example'),
 (202,'9845022222','Lakshmi Iyer',    'lakshmi@udupigrand.example'),
 (203,'9845022223','Arjun Shetty',    'arjun@slicestreet.example'),
 (204,'9845022224','Deepa N',         'deepa@spiceroute.example'),
 (205,'9845022225','Shivanand Hiremath','shiva@nandini.example'),
 (301,'9845033331','Suresh B',        NULL),
 (302,'9845033332','Prakash Naik',    NULL),
 (303,'9845033333','Venkatesh R',     NULL),
 (304,'9845033334','Imran Khan',      NULL),
 (401,'9845044441','Ops Admin',       'admin@example.com');

INSERT INTO user_roles (user_id, role_id) VALUES
 (101,1),(102,1),(103,1),(104,1),(105,1),
 (105,4),                                  -- Kiran also delivers on weekends
 (201,2),(202,2),(203,2),(205,2),(204,3),
 (301,4),(302,4),(303,4),(304,4),
 (401,5);

-- ---------------- RESTAURANTS (Bengaluru) ----------------
INSERT INTO restaurants (restaurant_id, name, address_line, city, latitude, longitude, cuisines,
                         fssai_no, gst_no, status, is_open, avg_rating, rating_count, avg_prep_mins, commission_pct) VALUES
 (1,'Spice Route Biryani House','12, 11th Main, Jayanagar 4th Block','Bengaluru',12.925400,77.583800,'Biryani, Andhra, North Indian',
    '11221333000101','29ABCDE1234F1Z5','ACTIVE',TRUE,4.4,1250,20,18.00),
 (2,'Udupi Grand Veg','45, Bull Temple Road, Basavanagudi','Bengaluru',12.942100,77.575300,'South Indian, Beverages',
    '11221333000102','29ABCDE1234F2Z4','ACTIVE',TRUE,4.6,3400,12,15.00),
 (3,'Slice Street Pizza','80 Feet Road, Koramangala 4th Block','Bengaluru',12.935200,77.624500,'Pizza, Italian, Fast Food',
    '11221333000103','29ABCDE1234F3Z3','ACTIVE',TRUE,4.1,860,25,20.00),
 (4,'Nandini Tiffin Centre','3rd Cross, JP Nagar 2nd Phase','Bengaluru',12.910800,77.585900,'South Indian',
    '11221333000104',NULL,'PENDING',FALSE,0,0,15,15.00);       -- still being verified

INSERT INTO restaurant_staff (restaurant_id, user_id, staff_role) VALUES
 (1,201,'OWNER'), (1,204,'MANAGER'), (2,202,'OWNER'), (3,203,'OWNER'), (4,205,'OWNER');

-- opening hours for all 7 days
INSERT INTO restaurant_timings (restaurant_id, day_of_week, open_time, close_time)
SELECT r.id, d, r.o, r.c
FROM (VALUES (1,'11:00'::time,'23:30'::time), (2,'06:30','22:00'), (3,'11:00','23:59'), (4,'07:00','21:00')) AS r(id,o,c),
     generate_series(1,7) AS d;

-- ---------------- MENU ----------------
INSERT INTO menu_categories (category_id, restaurant_id, name, sort_order) VALUES
 (11,1,'Biryani',1),(12,1,'Starters',2),(13,1,'Desserts',3),
 (21,2,'South Indian',1),(22,2,'Beverages',2),
 (31,3,'Pizzas',1),(32,3,'Sides',2),
 (41,4,'Breakfast',1);

INSERT INTO menu_items (item_id, restaurant_id, category_id, name, description, price, is_veg, in_stock) VALUES
 (501,1,11,'Chicken Dum Biryani','Slow-cooked basmati with tender chicken',320,FALSE,TRUE),
 (502,1,11,'Mutton Biryani','Hyderabadi style mutton biryani',420,FALSE,TRUE),
 (503,1,11,'Veg Biryani','Mixed vegetables and basmati rice',240,TRUE,TRUE),
 (504,1,12,'Chicken 65','Spicy deep-fried chicken',260,FALSE,TRUE),
 (505,1,12,'Paneer 65','Spicy fried paneer cubes',230,TRUE,FALSE),        -- sold out today
 (506,1,13,'Gulab Jamun (2 pcs)','Warm and soft',90,TRUE,TRUE),
 (511,2,21,'Masala Dosa','Crispy dosa with potato masala',110,TRUE,TRUE),
 (512,2,21,'Idli Vada','2 idli + 1 vada with chutney & sambar',80,TRUE,TRUE),
 (513,2,21,'Rava Idli','Served with sagu',90,TRUE,TRUE),
 (514,2,22,'Filter Coffee','Strong South Indian coffee',40,TRUE,TRUE),
 (521,3,31,'Margherita Pizza (Medium)','Classic cheese and tomato',299,TRUE,TRUE),
 (522,3,31,'Farmhouse Pizza (Medium)','Onion, capsicum, mushroom, tomato',399,TRUE,TRUE),
 (523,3,31,'Chicken Tikka Pizza (Medium)','Tandoori chicken tikka topping',449,FALSE,TRUE),
 (524,3,32,'Garlic Bread','With cheese dip',149,TRUE,TRUE),
 (531,4,41,'Set Dosa','3 soft dosas',70,TRUE,TRUE);

INSERT INTO item_addons (addon_id, item_id, name, price) VALUES
 (801,501,'Extra Raita',30), (802,501,'Extra Chicken Piece',90),
 (803,511,'Extra Chutney',0), (804,521,'Extra Cheese',60), (805,522,'Extra Cheese',60);

-- ---------------- CUSTOMER DATA ----------------
INSERT INTO addresses (address_id, user_id, label, address_line, landmark, city, latitude, longitude, is_default) VALUES
 (11,101,'Home','221, 9th Cross, Jayanagar 3rd Block','Near Cool Joint','Bengaluru',12.929300,77.582100,TRUE),
 (12,101,'Work','Prestige Tech Park, Koramangala','Gate 2','Bengaluru',12.936900,77.626600,FALSE),
 (13,102,'Home','14, Gandhi Bazaar Main Road, Basavanagudi',NULL,'Bengaluru',12.945000,77.573500,TRUE),
 (14,103,'Home','56, 5th Block, Koramangala','Opp. Forum Mall','Bengaluru',12.934000,77.618000,TRUE),
 (15,104,'Home','90, 30th Cross, Jayanagar 4th T Block',NULL,'Bengaluru',12.921000,77.587000,TRUE),
 (16,105,'Home','7, JP Nagar 3rd Phase',NULL,'Bengaluru',12.908000,77.590000,TRUE);

INSERT INTO coupons (coupon_id, code, description, discount_type, discount_value, min_order_value, max_discount, valid_from, valid_till, is_active) VALUES
 (1,'WELCOME50','50% off up to Rs 100 on your order','PERCENT',50,149,100, now() - interval '30 days', now() + interval '1 year', TRUE),
 (2,'FLAT75','Flat Rs 75 off on orders above Rs 299','FLAT',75,299,NULL, now() - interval '30 days', now() + interval '6 months', TRUE),
 (3,'DIWALI20','Expired festival offer','PERCENT',20,199,80, now() - interval '400 days', now() - interval '300 days', FALSE);

-- Ananya has something in her cart right now (from Udupi Grand)
INSERT INTO carts (cart_id, user_id, restaurant_id) VALUES (1,102,2);
INSERT INTO cart_items (cart_id, item_id, quantity, selected_addons) VALUES
 (1,511,2,'[803]'), (1,514,2,'[]');

-- ---------------- DELIVERY PARTNERS ----------------
INSERT INTO delivery_partners (partner_id, vehicle_type, vehicle_no, licence_no, city, kyc_status, is_online, rating) VALUES
 (301,'BIKE',   'KA05AB1234','KA0520190012345','Bengaluru','VERIFIED',   TRUE, 4.7),
 (302,'SCOOTER','KA01CD5678','KA0120180098765','Bengaluru','VERIFIED',   TRUE, 4.5),
 (303,'EV',     'KA51EV0001','KA5120210011111','Bengaluru','VERIFIED',   FALSE,4.8),
 (304,'BIKE',   'KA03XY4321','KA0320230022222','Bengaluru','PENDING_KYC',FALSE,0),
 (105,'BIKE',   'KA05KD7777','KA0520220033333','Bengaluru','VERIFIED',   FALSE,4.6);

INSERT INTO partner_documents (partner_id, doc_type, file_url, verified, verified_at) VALUES
 (301,'LICENCE','s3://partner-docs/301/licence.jpg',TRUE, now() - interval '200 days'),
 (301,'RC',     's3://partner-docs/301/rc.jpg',     TRUE, now() - interval '200 days'),
 (302,'LICENCE','s3://partner-docs/302/licence.jpg',TRUE, now() - interval '150 days'),
 (302,'RC',     's3://partner-docs/302/rc.jpg',     TRUE, now() - interval '150 days'),
 (303,'LICENCE','s3://partner-docs/303/licence.jpg',TRUE, now() - interval '90 days'),
 (304,'LICENCE','s3://partner-docs/304/licence.jpg',FALSE,NULL),
 (304,'ID_PROOF','s3://partner-docs/304/id.jpg',    FALSE,NULL),
 (105,'LICENCE','s3://partner-docs/105/licence.jpg',TRUE, now() - interval '60 days');

INSERT INTO partner_locations (partner_id, latitude, longitude) VALUES
 (301,12.926800,77.585000),     -- ~200 m from Spice Route
 (302,12.940500,77.578000),     -- near Udupi Grand
 (303,12.915000,77.600000),
 (105,12.908100,77.590100);

-- ---------------- PAYMENT GATEWAYS ----------------
INSERT INTO payment_gateways (gateway_id, code, display_name, supports_card, supports_upi, is_active, priority) VALUES
 (1,'MOCKPAY', 'MockPay (local test gateway)',TRUE,TRUE,TRUE, 1),
 (2,'RAZORPAY','Razorpay',                    TRUE,TRUE,FALSE,2),
 (3,'STRIPE',  'Stripe',                      TRUE,FALSE,FALSE,3);

-- Saved cards = TOKEN + brand + last4 + expiry. No card number. No CVV.
INSERT INTO saved_payment_methods (method_id, user_id, gateway_id, method_type, gateway_token,
                                   card_network, card_last4, card_expiry_month, card_expiry_year, upi_vpa_masked, is_default) VALUES
 (1,101,1,'CARD','tok_mock_7f3a9c1e2b4d','VISA','1111',12,2029,NULL,TRUE),
 (2,101,1,'UPI', 'tok_mock_upi_51ac0e9d', NULL,NULL,NULL,NULL,'ra****@okaxis',FALSE),
 (3,102,1,'CARD','tok_mock_88d1e0f4a6c2','MASTERCARD','4444',8,2028,NULL,TRUE);

-- =====================================================================
-- PAST ORDERS (so every table has realistic rows)
-- =====================================================================

-- ---- Order 9001: Ravi, Spice Route, paid by saved VISA card, DELIVERED yesterday ----
INSERT INTO orders (order_id, customer_id, restaurant_id, partner_id, address_id, coupon_id,
                    item_total, delivery_fee, platform_fee, taxes, discount, total_amount,
                    payment_mode, status, placed_at, delivered_at) VALUES
 (9001,101,1,301,11,NULL, 440,30,5,22,0,497,'CARD','DELIVERED',
  now() - interval '1 day 2 hours', now() - interval '1 day 1 hour 25 minutes');
INSERT INTO order_items (order_id, item_id, item_name, quantity, price_at_order, addons, line_total) VALUES
 (9001,501,'Chicken Dum Biryani',1,320,'[{"addon_id":801,"name":"Extra Raita","price":30}]',350),
 (9001,506,'Gulab Jamun (2 pcs)',1,90,'[]',90);
INSERT INTO order_status_history (order_id, status, changed_by, changed_at) VALUES
 (9001,'PAYMENT_PENDING',101,now() - interval '1 day 2 hours'),
 (9001,'PLACED',        NULL,now() - interval '1 day 1 hour 59 minutes'),
 (9001,'ACCEPTED',      201,now() - interval '1 day 1 hour 58 minutes'),
 (9001,'READY',         204,now() - interval '1 day 1 hour 40 minutes'),
 (9001,'PICKED_UP',     301,now() - interval '1 day 1 hour 38 minutes'),
 (9001,'DELIVERED',     301,now() - interval '1 day 1 hour 25 minutes');
INSERT INTO payments (payment_id, order_id, user_id, gateway_id, method_type, saved_method_id, card_network, card_last4,
                      amount, status, idempotency_key, gateway_order_ref, gateway_payment_ref, created_at) VALUES
 (6001,9001,101,1,'CARD',1,'VISA','1111',497,'CAPTURED','idem-9001-1','mock_order_9001','mock_pay_9001',
  now() - interval '1 day 2 hours');
INSERT INTO payment_transactions (payment_id, txn_type, amount, status, gateway_txn_ref, gateway_response, created_at) VALUES
 (6001,'CREATE_ORDER',497,'SUCCESS','mock_order_9001','{"id":"mock_order_9001","status":"created","amount":49700}', now() - interval '1 day 2 hours'),
 (6001,'CAPTURE',     497,'SUCCESS','mock_pay_9001',  '{"id":"mock_pay_9001","status":"captured","card":{"network":"VISA","last4":"1111"}}', now() - interval '1 day 1 hour 59 minutes');
INSERT INTO payment_webhook_events (gateway_id, gateway_event_id, event_type, payment_id, signature_valid, payload, received_at, processed_at) VALUES
 (1,'evt_mock_0001','payment.captured',6001,TRUE,'{"payment_id":"mock_pay_9001","status":"captured"}',
  now() - interval '1 day 1 hour 59 minutes', now() - interval '1 day 1 hour 59 minutes');
INSERT INTO delivery_assignments (order_id, partner_id, status, offered_at, responded_at) VALUES
 (9001,302,'REJECTED',now() - interval '1 day 1 hour 57 minutes', now() - interval '1 day 1 hour 56 minutes'),
 (9001,301,'ACCEPTED',now() - interval '1 day 1 hour 56 minutes', now() - interval '1 day 1 hour 55 minutes');
INSERT INTO partner_earnings (partner_id, order_id, base_pay, distance_pay, tip, payout_status) VALUES (301,9001,25,10,20,'PAID');
INSERT INTO restaurant_payouts (restaurant_id, order_id, order_amount, commission, payout_amount, payout_status) VALUES (1,9001,440,79.20,360.80,'PAID');
INSERT INTO ratings (order_id, user_id, food_rating, delivery_rating, comment) VALUES (9001,101,5,4,'Biryani was hot and tasty!');

-- ---- Order 9002: Ananya, Udupi Grand, Cash on Delivery, DELIVERED 3 days ago ----
INSERT INTO orders (order_id, customer_id, restaurant_id, partner_id, address_id, item_total, delivery_fee, platform_fee,
                    taxes, discount, total_amount, payment_mode, status, placed_at, delivered_at) VALUES
 (9002,102,2,302,13,300,25,5,15,0,345,'COD','DELIVERED', now() - interval '3 days', now() - interval '3 days' + interval '28 minutes');
INSERT INTO order_items (order_id, item_id, item_name, quantity, price_at_order, addons, line_total) VALUES
 (9002,511,'Masala Dosa',2,110,'[]',220), (9002,514,'Filter Coffee',2,40,'[]',80);
INSERT INTO order_status_history (order_id, status, changed_by, changed_at) VALUES
 (9002,'PLACED',102,now() - interval '3 days'),
 (9002,'ACCEPTED',202,now() - interval '3 days' + interval '1 minute'),
 (9002,'READY',202,now() - interval '3 days' + interval '12 minutes'),
 (9002,'PICKED_UP',302,now() - interval '3 days' + interval '15 minutes'),
 (9002,'DELIVERED',302,now() - interval '3 days' + interval '28 minutes');
INSERT INTO payments (payment_id, order_id, user_id, gateway_id, method_type, amount, status, idempotency_key, created_at) VALUES
 (6002,9002,102,NULL,'COD',345,'COD_COLLECTED','idem-9002-1', now() - interval '3 days');
INSERT INTO delivery_assignments (order_id, partner_id, status, offered_at, responded_at) VALUES
 (9002,302,'ACCEPTED',now() - interval '3 days' + interval '2 minutes', now() - interval '3 days' + interval '2 minutes');
INSERT INTO partner_earnings (partner_id, order_id, base_pay, distance_pay, tip) VALUES (302,9002,25,5,0);
INSERT INTO restaurant_payouts (restaurant_id, order_id, order_amount, commission, payout_amount) VALUES (2,9002,300,45.00,255.00);
INSERT INTO ratings (order_id, user_id, food_rating, delivery_rating) VALUES (9002,102,5,5);

-- ---- Order 9003: Irfan, Slice Street, UPI payment FAILED ----
INSERT INTO orders (order_id, customer_id, restaurant_id, address_id, coupon_id, item_total, delivery_fee, platform_fee,
                    taxes, discount, total_amount, payment_mode, status, placed_at) VALUES
 (9003,103,3,14,2,449,40,5,22.45,75,441.45,'UPI','PAYMENT_FAILED', now() - interval '5 hours');
INSERT INTO order_items (order_id, item_id, item_name, quantity, price_at_order, line_total) VALUES
 (9003,523,'Chicken Tikka Pizza (Medium)',1,449,449);
INSERT INTO order_status_history (order_id, status, changed_by, note, changed_at) VALUES
 (9003,'PAYMENT_PENDING',103,NULL,now() - interval '5 hours'),
 (9003,'PAYMENT_FAILED',NULL,'UPI request declined by user',now() - interval '4 hours 57 minutes');
INSERT INTO payments (payment_id, order_id, user_id, gateway_id, method_type, amount, status, idempotency_key,
                      gateway_order_ref, failure_code, failure_reason, created_at) VALUES
 (6003,9003,103,1,'UPI',441.45,'FAILED','idem-9003-1','mock_order_9003','UPI_DECLINED','User declined the collect request', now() - interval '5 hours');
INSERT INTO payment_transactions (payment_id, txn_type, amount, status, gateway_txn_ref, gateway_response) VALUES
 (6003,'CREATE_ORDER',441.45,'SUCCESS','mock_order_9003','{"id":"mock_order_9003","status":"created"}'),
 (6003,'AUTHORIZE',   441.45,'FAILED', NULL,             '{"error":"UPI_DECLINED"}');

-- ---- Order 9004: Sneha, Spice Route, paid by UPI, PLACED (waiting for restaurant to accept) ----
INSERT INTO orders (order_id, customer_id, restaurant_id, address_id, coupon_id, item_total, delivery_fee, platform_fee,
                    taxes, discount, total_amount, payment_mode, status, special_instructions, placed_at) VALUES
 (9004,104,1,15,1,680,30,5,34,100,649,'UPI','PLACED','Less spicy please', now() - interval '3 minutes');
INSERT INTO order_items (order_id, item_id, item_name, quantity, price_at_order, addons, line_total) VALUES
 (9004,502,'Mutton Biryani',1,420,'[]',420), (9004,504,'Chicken 65',1,260,'[]',260);
INSERT INTO order_status_history (order_id, status, changed_by, changed_at) VALUES
 (9004,'PAYMENT_PENDING',104,now() - interval '4 minutes'),
 (9004,'PLACED',NULL,now() - interval '3 minutes');
INSERT INTO payments (payment_id, order_id, user_id, gateway_id, method_type, amount, status, idempotency_key,
                      gateway_order_ref, gateway_payment_ref, created_at) VALUES
 (6004,9004,104,1,'UPI',649,'CAPTURED','idem-9004-1','mock_order_9004','mock_pay_9004', now() - interval '4 minutes');
INSERT INTO payment_transactions (payment_id, txn_type, amount, status, gateway_txn_ref, gateway_response) VALUES
 (6004,'CREATE_ORDER',649,'SUCCESS','mock_order_9004','{"id":"mock_order_9004","status":"created"}'),
 (6004,'CAPTURE',     649,'SUCCESS','mock_pay_9004',  '{"id":"mock_pay_9004","status":"captured","vpa":"sn****@okhdfc"}');

-- ---------------------------------------------------------------------
-- Move every ID sequence past the hand-picked IDs above,
-- so new rows created by the API get fresh numbers.
-- ---------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.is_identity = 'YES'
  LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L,%L), GREATEST((SELECT COALESCE(MAX(%I),0) FROM %I), 1))',
      r.table_name, r.column_name, r.column_name, r.table_name);
  END LOOP;
END $$;

COMMIT;
