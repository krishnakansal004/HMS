-- Migration: 0039
-- Purpose: Two infrastructure improvements, both applied generically via
-- information_schema introspection rather than a hardcoded column list (less
-- error-prone, and automatically covers every table already created):
--
-- 1. Convert every TIMESTAMP (timezone-naive) column to TIMESTAMPTZ. This is
--    a greenfield database with no data yet, so the conversion is safe and
--    assumes existing (empty) columns are UTC. Doing this now avoids ambiguity
--    later if the app or its users ever span more than one timezone --
--    TIMESTAMPTZ stores UTC internally and converts on display, TIMESTAMP does
--    not store timezone info at all and is a common source of subtle bugs.
--    (DATE columns like expiry_date/admitted_date are left as-is -- a pure
--    calendar date has no timezone component to get wrong.)
--
-- 2. A generic trigger function that auto-updates updated_at on every UPDATE,
--    attached to every table that has an updated_at column. Right now
--    updated_at only gets set once via DEFAULT at INSERT time -- nothing
--    updates it afterwards, so it's currently meaningless as an "last
--    modified" indicator. This guarantees consistency across every service
--    that writes to the DB, instead of relying on every route/service
--    remembering to set updated_at = NOW() by hand.

-- Part 1: TIMESTAMP -> TIMESTAMPTZ ---------------------------------------

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'timestamp without time zone'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC'';',
            r.table_name, r.column_name, r.column_name
        );
    END LOOP;
END $$;

-- Part 2: automatic updated_at trigger -----------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'updated_at'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
            r.table_name, r.table_name
        );
    END LOOP;
END $$;
