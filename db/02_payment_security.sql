-- =====================================================================
--  02_payment_security.sql (Beginner-Friendly Edition)
--
--  GOLDEN RULE:
--  Never store the CVV/CVC or full 16-digit card number in this database.
-- =====================================================================

SET search_path = public;


-- =====================================================================
-- STEP 1: Define what words are forbidden
-- Any column or JSON key named cvv, cvc, pan, or card_number is blocked.
-- =====================================================================
CREATE OR REPLACE FUNCTION forbidden_card_field_regex() 
RETURNS text 
LANGUAGE sql 
IMMUTABLE AS $$
  -- Matches words like: cvv, cvc, card_number, pan, security_code
  SELECT '(^|_)(cvv2?|cvc2?|csc|cid|security_?code|card_?number|card_?no|cardnum|pan|full_?pan)($|_)'
$$;


-- =====================================================================
-- LAYER 2: Block developers from creating a "cvv" column
-- If someone runs: "ALTER TABLE payments ADD COLUMN cvv TEXT;"
-- PostgreSQL automatically triggers this function and aborts the query.
-- =====================================================================
CREATE OR REPLACE FUNCTION block_card_secret_columns() 
RETURNS event_trigger 
LANGUAGE plpgsql AS $$
DECLARE 
  column_record record;
BEGIN
  -- Look for any newly created or modified column with a forbidden name
  FOR column_record IN
    SELECT 
      c.relname AS table_name, 
      a.attname AS column_name
    FROM pg_attribute a
    JOIN pg_class c     ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND a.attnum > 0 
      AND NOT a.attisdropped
      AND lower(a.attname) ~ forbidden_card_field_regex()
  LOOP
    RAISE EXCEPTION 'SECURITY ERROR: Column "%.%" is forbidden! Never store CVV or full card numbers.',
      column_record.table_name, column_record.column_name;
  END LOOP;
END $$;

-- Hook the event trigger to run after any CREATE or ALTER TABLE command
DROP EVENT TRIGGER IF EXISTS trg_block_card_secret_columns;
CREATE EVENT TRIGGER trg_block_card_secret_columns
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'ALTER TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'CREATE VIEW', 'CREATE MATERIALIZED VIEW')
  EXECUTE FUNCTION block_card_secret_columns();


-- =====================================================================
-- LAYER 3A: Luhn Algorithm (Checks if a number is a valid credit card)
-- Real card numbers pass this mathematical formula (summing doubled digits).
-- =====================================================================
CREATE OR REPLACE FUNCTION luhn_valid(digits text) 
RETURNS boolean 
LANGUAGE plpgsql 
IMMUTABLE AS $$
DECLARE 
  checksum int := 0; 
  digit int; 
  double_digit boolean := false; 
  idx int;
BEGIN
  -- Credit card numbers are 13 to 19 digits long
  IF digits !~ '^[0-9]{13,19}$' THEN 
    RETURN false; 
  END IF;

  -- Process digits backwards from right to left
  FOR idx IN REVERSE length(digits)..1 LOOP
    digit := substr(digits, idx, 1)::int;
    IF double_digit THEN 
      digit := digit * 2; 
      IF digit > 9 THEN 
        digit := digit - 9; 
      END IF; 
    END IF;
    checksum := checksum + digit; 
    double_digit := NOT double_digit;
  END LOOP;

  -- Valid card numbers end up with a multiple of 10
  RETURN (checksum % 10 = 0);
END $$;


-- =====================================================================
-- LAYER 3B: Recursive JSON Scanner
-- Inspects JSON payload received from payment gateways to make sure
-- the gateway response didn't accidentally include raw card secrets.
-- =====================================================================
CREATE OR REPLACE FUNCTION jsonb_has_card_secrets(data jsonb) 
RETURNS boolean 
LANGUAGE plpgsql 
IMMUTABLE AS $$
DECLARE 
  json_key text; 
  json_val jsonb; 
  array_element jsonb; 
  card_match text;
BEGIN
  IF data IS NULL THEN 
    RETURN false; 
  END IF;

  -- Check JSON Object: keys and values
  IF jsonb_typeof(data) = 'object' THEN
    FOR json_key, json_val IN SELECT * FROM jsonb_each(data) LOOP
      IF lower(json_key) ~ forbidden_card_field_regex() THEN 
        RETURN true; 
      END IF;
      IF jsonb_has_card_secrets(json_val) THEN 
        RETURN true; 
      END IF;
    END LOOP;

  -- Check JSON Array: inspect each item
  ELSIF jsonb_typeof(data) = 'array' THEN
    FOR array_element IN SELECT * FROM jsonb_array_elements(data) LOOP
      IF jsonb_has_card_secrets(array_element) THEN 
        RETURN true; 
      END IF;
    END LOOP;

  -- Check JSON Strings: extract 13-19 digit sequences and run Luhn check
  ELSIF jsonb_typeof(data) = 'string' THEN
    FOR card_match IN 
      SELECT regexp_replace(m[1], '[ -]', '', 'g')
      FROM regexp_matches(data #>> '{}', '((?:[0-9][ -]?){13,19})', 'g') AS m 
    LOOP
      IF luhn_valid(card_match) THEN 
        RETURN true; 
      END IF;
    END LOOP;
  END IF;

  RETURN false;
END $$;


-- =====================================================================
-- LAYER 3C: Triggers to enforce JSON & Text scanning on tables
-- =====================================================================

-- Trigger function for JSON columns (e.g., gateway_response, webhook payload)
CREATE OR REPLACE FUNCTION reject_card_secrets_in_json() 
RETURNS trigger 
LANGUAGE plpgsql AS $$
DECLARE 
  column_name text := TG_ARGV[0]; 
  column_value jsonb;
BEGIN
  EXECUTE format('SELECT ($1).%I', column_name) INTO column_value USING NEW;
  IF jsonb_has_card_secrets(column_value) THEN
    RAISE EXCEPTION 'SECURITY ERROR: %.% contains card secrets. Sanitize it before saving!',
      TG_TABLE_NAME, column_name;
  END IF;
  RETURN NEW;
END $$;

-- Trigger function for free-text fields (instructions, customer comments)
CREATE OR REPLACE FUNCTION reject_card_number_in_text() 
RETURNS trigger 
LANGUAGE plpgsql AS $$
DECLARE 
  column_name text := TG_ARGV[0]; 
  text_value text;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', column_name) INTO text_value USING NEW;
  IF text_value IS NOT NULL AND jsonb_has_card_secrets(to_jsonb(text_value)) THEN
    RAISE EXCEPTION 'SECURITY ERROR: Field %.% looks like a card number. Cards are not allowed in comments!', 
      TG_TABLE_NAME, column_name;
  END IF;
  RETURN NEW;
END $$;

-- Attach scanners to payment tables
DROP TRIGGER IF EXISTS trg_ptxn_no_card_secrets ON payment_transactions;
CREATE TRIGGER trg_ptxn_no_card_secrets
  BEFORE INSERT OR UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION reject_card_secrets_in_json('gateway_response');

DROP TRIGGER IF EXISTS trg_webhook_no_card_secrets ON payment_webhook_events;
CREATE TRIGGER trg_webhook_no_card_secrets
  BEFORE INSERT OR UPDATE ON payment_webhook_events
  FOR EACH ROW EXECUTE FUNCTION reject_card_secrets_in_json('payload');

DROP TRIGGER IF EXISTS trg_order_items_no_card_secrets ON order_items;
CREATE TRIGGER trg_order_items_no_card_secrets
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION reject_card_secrets_in_json('addons');

DROP TRIGGER IF EXISTS trg_orders_instr_no_pan ON orders;
CREATE TRIGGER trg_orders_instr_no_pan 
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION reject_card_number_in_text('special_instructions');

DROP TRIGGER IF EXISTS trg_ratings_comment_no_pan ON ratings;
CREATE TRIGGER trg_ratings_comment_no_pan 
  BEFORE INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION reject_card_number_in_text('comment');


-- =====================================================================
-- LAYER 4: Database logging rules
-- Instructs PostgreSQL never to print SQL values to log files
-- =====================================================================
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET log_parameter_max_length = 0', current_database());
  EXECUTE format('ALTER DATABASE %I SET log_parameter_max_length_on_error = 0', current_database());
  EXECUTE format('ALTER DATABASE %I SET log_statement = %L', current_database(), 'ddl');
END $$;


-- =====================================================================
-- LAYER 5: Create limited user for the FastAPI Backend
-- The Python app logs in as 'app_user', NOT 'postgres' superuser.
-- =====================================================================
DO $$
BEGIN
  -- Create role app_user if it does not already exist
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'change_me_in_env';
  END IF;
END $$;

-- Grant permissions needed by the app:
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT  USAGE  ON SCHEMA public TO app_user;
GRANT  SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT  USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Protect payment audit trail: the app cannot delete payment history
REVOKE DELETE ON payments, payment_transactions, refunds, payment_webhook_events FROM app_user;
REVOKE UPDATE ON payment_transactions, payment_webhook_events FROM app_user;
GRANT  UPDATE (processed_at, payment_id) ON payment_webhook_events TO app_user;

-- Prevent app_user query values from showing in server logs
ALTER ROLE app_user SET log_parameter_max_length = 0;
ALTER ROLE app_user SET log_parameter_max_length_on_error = 0;
