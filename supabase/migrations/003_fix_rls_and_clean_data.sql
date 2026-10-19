-- ==============================================================================
-- JËL TIX & FOUTATICKET - Nettoyage intégral des données fictives & Déblocage Supabase
-- Exécuter ce script dans : Supabase Dashboard > SQL Editor > New query > Run
-- ==============================================================================

-- 1. Nettoyage intégral de toutes les anciennes données de test / fictives
TRUNCATE TABLE scans, tickets, orders, ticket_types, events CASCADE;

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
