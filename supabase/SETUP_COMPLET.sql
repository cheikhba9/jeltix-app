-- ==============================================================================
-- FOUTATICKET & JËL TIX - PostgreSQL & Supabase Database Migration
-- Script Idempotent (Exécutable plusieurs fois sans erreur)
-- Architecture Anti-Fraude, RBAC & Procédures Atomiques
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enumerations (Création sécurisée sans doublon)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ORGANIZER', 'EVENT_MANAGER', 'SELLER', 'CONTROLLER', 'FINANCE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
        CREATE TYPE event_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('VALID', 'USED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('WAVE', 'ORANGE_MONEY', 'FREE_MONEY', 'CASH');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scan_result') THEN
        CREATE TYPE scan_result AS ENUM ('VALID', 'ALREADY_SCANNED', 'INVALID');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_channel') THEN
        CREATE TYPE sales_channel AS ENUM ('ONLINE', 'POS_GUICHET');
    END IF;
END $$;

-- 3. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role user_role NOT NULL DEFAULT 'ORGANIZER',
    avatar_url TEXT,
    organization VARCHAR(255),
    organization_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Events Table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    location_details VARCHAR(255),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    banner_image TEXT,
    description TEXT,
    status event_status NOT NULL DEFAULT 'DRAFT',
    total_capacity INTEGER NOT NULL DEFAULT 0,
    sold_capacity INTEGER NOT NULL DEFAULT 0,
    organizer_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Ticket Types Table (Categories & Pricing)
CREATE TABLE IF NOT EXISTS ticket_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    badge VARCHAR(50),
    description TEXT,
    total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
    sold_quantity INTEGER NOT NULL DEFAULT 0 CHECK (sold_quantity <= total_quantity),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference VARCHAR(50) UNIQUE NOT NULL,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
    payment_method payment_method NOT NULL,
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    seller_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    channel sales_channel NOT NULL DEFAULT 'ONLINE',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tickets Table (Anti-fraud constraints)
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_code VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
    gate_recommendation VARCHAR(100),
    seat_number VARCHAR(50),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    price_paid INTEGER NOT NULL,
    status ticket_status NOT NULL DEFAULT 'VALID',
    qr_data TEXT NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_gate VARCHAR(100),
    used_by_controller UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Scans Table (Audit trail of every gate scan attempt)
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    ticket_code VARCHAR(50) NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    gate VARCHAR(100) NOT NULL,
    controller_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    result scan_result NOT NULL,
    error_message TEXT,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Withdrawals Table (Organizer Payouts)
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL CHECK (amount > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    payout_method payment_method NOT NULL,
    payout_destination VARCHAR(255) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- ATOMIC STORED PROCEDURE (Anti-Double-Scan & Concurrency Lock)
-- ==============================================================================

CREATE OR REPLACE FUNCTION validate_ticket_atomic(
    p_ticket_code VARCHAR(50),
    p_gate VARCHAR(100),
    p_controller_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_ticket RECORD;
    v_result scan_result;
    v_error_msg TEXT := NULL;
BEGIN
    -- 1. Find ticket with row lock
    SELECT * INTO v_ticket 
    FROM tickets 
    WHERE ticket_code = p_ticket_code 
    FOR UPDATE;

    -- Case A: Ticket not found
    IF NOT FOUND THEN
        v_result := 'INVALID';
        v_error_msg := 'Billet introuvable ou faux code';
        
        INSERT INTO scans (ticket_code, event_id, gate, controller_id, result, error_message)
        VALUES (p_ticket_code, NULL, p_gate, p_controller_id, v_result, v_error_msg);

        RETURN jsonb_build_object(
            'success', FALSE,
            'result', v_result,
            'message', v_error_msg
        );
    END IF;

    -- Case B: Ticket already used (Fraud / Double Validation)
    IF v_ticket.status = 'USED' THEN
        v_result := 'ALREADY_SCANNED';
        v_error_msg := format('Billet déjà validé le %s à %s', v_ticket.used_at, v_ticket.used_gate);
        
        INSERT INTO scans (ticket_id, ticket_code, event_id, gate, controller_id, result, error_message)
        VALUES (v_ticket.id, v_ticket.ticket_code, v_ticket.event_id, p_gate, p_controller_id, v_result, v_error_msg);

        RETURN jsonb_build_object(
            'success', FALSE,
            'result', v_result,
            'message', v_error_msg,
            'ticket', jsonb_build_object(
                'ticketCode', v_ticket.ticket_code,
                'customerName', v_ticket.customer_name,
                'usedAt', v_ticket.used_at,
                'usedGate', v_ticket.used_gate
            )
        );
    END IF;

    -- Case C: Ticket is valid -> Update atomically
    UPDATE tickets 
    SET 
        status = 'USED',
        used_at = NOW(),
        used_gate = p_gate,
        used_by_controller = p_controller_id
    WHERE id = v_ticket.id;

    v_result := 'VALID';
    INSERT INTO scans (ticket_id, ticket_code, event_id, gate, controller_id, result)
    VALUES (v_ticket.id, v_ticket.ticket_code, v_ticket.event_id, p_gate, p_controller_id, v_result);

    RETURN jsonb_build_object(
        'success', TRUE,
        'result', v_result,
        'message', 'Billet validé avec succès',
        'ticket', jsonb_build_object(
            'ticketCode', v_ticket.ticket_code,
            'customerName', v_ticket.customer_name,
            'gateRecommendation', v_ticket.gate_recommendation,
            'seatNumber', v_ticket.seat_number
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to prevent duplicate policy errors)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Public can view published events" ON events;
DROP POLICY IF EXISTS "Organizers can manage their own events" ON events;
DROP POLICY IF EXISTS "Public can view active ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Organizers can manage their ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Organizers can view orders for their events" ON orders;
DROP POLICY IF EXISTS "Controllers and Organizers can view tickets" ON tickets;
DROP POLICY IF EXISTS "Controllers can insert scans" ON scans;
DROP POLICY IF EXISTS "Organizers and Admins can view scan history" ON scans;

-- 1. Profiles Policies
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- 2. Events Policies
CREATE POLICY "Public can view published events"
ON events FOR SELECT
USING (status = 'PUBLISHED');

CREATE POLICY "Organizers can manage their own events"
ON events FOR ALL
USING (auth.uid() = organizer_id);

-- 3. Ticket Types Policies
CREATE POLICY "Public can view active ticket types"
ON ticket_types FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "Organizers can manage their ticket types"
ON ticket_types FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM events
        WHERE events.id = ticket_types.event_id
        AND events.organizer_id = auth.uid()
    )
);

-- 4. Orders Policies
CREATE POLICY "Organizers can view orders for their events"
ON orders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events
        WHERE events.id = orders.event_id
        AND events.organizer_id = auth.uid()
    )
);

-- 5. Tickets Policies
CREATE POLICY "Controllers and Organizers can view tickets"
ON tickets FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('SUPER_ADMIN', 'ORGANIZER', 'EVENT_MANAGER', 'CONTROLLER')
    )
);

-- 6. Scans Policies
CREATE POLICY "Controllers can insert scans"
ON scans FOR INSERT
WITH CHECK (auth.uid() = controller_id);

CREATE POLICY "Organizers and Admins can view scan history"
ON scans FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events
        WHERE events.id = scans.event_id
        AND (events.organizer_id = auth.uid() OR EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'SUPER_ADMIN'
        ))
    )
);
-- ==============================================================================
-- Migration 002 — Team Management: Add organization_id to profiles
-- Idempotent (safe to run multiple times)
-- ==============================================================================

-- Add organization_id column to profiles table
-- This links SELLER/CONTROLLER team members to their Organizer's profile id
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for fast team member lookups by organizer
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);

-- ==============================================================================
-- RLS Policy: Organizers can read their own team members
-- ==============================================================================

DROP POLICY IF EXISTS "Organizers can read their team members" ON profiles;
CREATE POLICY "Organizers can read their team members"
ON profiles FOR SELECT
USING (
  -- User can see their own profile
  auth.uid() = id
  OR
  -- Organizer can see members of their team (where organization_id = organizer's id)
  organization_id = auth.uid()
  OR
  -- Super Admin sees everyone
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.id = auth.uid()
    AND p.role = 'SUPER_ADMIN'
  )
);

-- ==============================================================================
-- RLS Policy: Only SUPER_ADMIN and ORGANIZER can insert team members
-- ==============================================================================

DROP POLICY IF EXISTS "Organizers can create team members" ON profiles;
CREATE POLICY "Organizers can create team members"
ON profiles FOR INSERT
WITH CHECK (
  -- The inserting user is SUPER_ADMIN
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.id = auth.uid()
    AND p.role = 'SUPER_ADMIN'
  )
  OR
  -- The inserting user is an ORGANIZER and is linking the new member to themselves
  (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
      AND p.role = 'ORGANIZER'
    )
    AND organization_id = auth.uid()
    AND role IN ('SELLER', 'CONTROLLER')
  )
);

-- ==============================================================================
-- RLS Policy: Organizers can update their own team members status
-- ==============================================================================

DROP POLICY IF EXISTS "Organizers can update their team members" ON profiles;
CREATE POLICY "Organizers can update their team members"
ON profiles FOR UPDATE
USING (
  -- Own profile
  auth.uid() = id
  OR
  -- Organizer managing their team
  (
    organization_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
      AND p.role IN ('ORGANIZER', 'SUPER_ADMIN')
    )
  )
  OR
  -- Super Admin can update everything
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.id = auth.uid()
    AND p.role = 'SUPER_ADMIN'
  )
);
-- ==============================================================================
-- JËL TIX & FOUTATICKET - Nettoyage intégral des données fictives & Déblocage Supabase
-- Exécuter ce script dans : Supabase Dashboard > SQL Editor > New query > Run
-- ==============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scans') THEN
        TRUNCATE TABLE scans, tickets, orders, ticket_types, events CASCADE;
    END IF;
END $$;

-- 2. Suppression de toutes les anciennes politiques RLS (y compris récursion 42P17)
DROP POLICY IF EXISTS "Organizers can read their team members" ON profiles;
DROP POLICY IF EXISTS "Organizers can create team members" ON profiles;
DROP POLICY IF EXISTS "Organizers can update their team members" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Public full access profiles" ON profiles;

DROP POLICY IF EXISTS "Public can view published events" ON events;
DROP POLICY IF EXISTS "Organizers can manage their own events" ON events;
DROP POLICY IF EXISTS "Public full access events" ON events;

DROP POLICY IF EXISTS "Public can view active ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Organizers can manage their ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Public full access ticket_types" ON ticket_types;

DROP POLICY IF EXISTS "Organizers can view orders for their events" ON orders;
DROP POLICY IF EXISTS "Public full access orders" ON orders;

DROP POLICY IF EXISTS "Controllers and Organizers can view tickets" ON tickets;
DROP POLICY IF EXISTS "Public full access tickets" ON tickets;

DROP POLICY IF EXISTS "Controllers can insert scans" ON scans;
DROP POLICY IF EXISTS "Organizers and Admins can view scan history" ON scans;
DROP POLICY IF EXISTS "Public full access scans" ON scans;

-- 3. Configuration des droits complets (Autorise lecture/écriture publique & admin sur localhost et en ligne)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access ticket_types" ON ticket_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access tickets" ON tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access scans" ON scans FOR ALL USING (true) WITH CHECK (true);

-- 4. Insertion des 4 comptes administrateurs officiels réels
INSERT INTO profiles (id, email, full_name, phone, role, organization, is_active)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'admin@jeltix.sn', 'Admin Jël Tix', '+221 76 402 74 68', 'SUPER_ADMIN', 'Jël Tix SAS', TRUE),
  ('a0000000-0000-0000-0000-000000000002', 'admin@foutaticket.sn', 'Super Administrateur', '+221 76 402 74 68', 'SUPER_ADMIN', 'Jël Tix & FoutaTicket', TRUE),
  ('a0000000-0000-0000-0000-000000000003', 'mamadoucheikhba9@gmail.com', 'Mamadou Cheikh Ba', '+221 76 402 74 68', 'SUPER_ADMIN', 'Jël Tix SAS', TRUE),
  ('a0000000-0000-0000-0000-000000000004', 'mcbfd9@gmail.com', 'Mamadou Cheikh Ba', '+221 76 402 74 68', 'SUPER_ADMIN', 'Jël Tix SAS', TRUE)
ON CONFLICT (email) DO UPDATE SET 
  phone = EXCLUDED.phone, 
  role = 'SUPER_ADMIN',
  is_active = TRUE;
