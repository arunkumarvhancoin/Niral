-- ============================================================================
-- Migration: Strict Organization Isolation & RBAC Protection
-- Guarantees that only approved members of an organization can view its data.
-- ============================================================================

-- 1. Ensure Bharat Play organization exists
INSERT INTO public.organizations (name, slug, industry, company_size, description)
VALUES (
  'Bharat Play',
  'bharat-play',
  'Events & Entertainment',
  '1-10 employees',
  'Bharat Play workshop registrations, serious tabletop gaming, and attendee pipeline.'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 2. Allow public / anonymous webhook client to read the Bharat Play organization
DROP POLICY IF EXISTS "Allow public read for Bharat Play organization" ON public.organizations;
CREATE POLICY "Allow public read for Bharat Play organization"
ON public.organizations
FOR SELECT
TO anon, authenticated
USING (slug = 'bharat-play');

-- 3. Allow members of the organization to view all registrations (leads)
DROP POLICY IF EXISTS "Approved members can view leads" ON public.leads;
CREATE POLICY "Approved members can view leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = leads.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'approved'
  )
);

-- 4. Allow Managers, Admins and Owners to delete registrations
DROP POLICY IF EXISTS "Managers, Admins and Owners can delete leads" ON public.leads;
CREATE POLICY "Managers, Admins and Owners can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = leads.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('Owner', 'Admin', 'Manager')
      AND organization_members.status = 'approved'
  )
);

-- 5. Allow members of the organization to view contacts & payment proof screenshots
DROP POLICY IF EXISTS "Approved members can view contacts" ON public.contacts;
CREATE POLICY "Approved members can view contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = contacts.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'approved'
  )
);

-- 6. Allow public website to save new bookings (INSERT only)
DROP POLICY IF EXISTS "Allow public webhook lead submission for Bharat Play" ON public.leads;
CREATE POLICY "Allow public webhook lead submission for Bharat Play"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'bharat-play'
  )
);

DROP POLICY IF EXISTS "Allow public webhook contact submission for Bharat Play" ON public.contacts;
CREATE POLICY "Allow public webhook contact submission for Bharat Play"
ON public.contacts
FOR INSERT
TO anon, authenticated
WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'bharat-play'
  )
);

DROP POLICY IF EXISTS "Allow public webhook activity logging for Bharat Play" ON public.activities;
CREATE POLICY "Allow public webhook activity logging for Bharat Play"
ON public.activities
FOR INSERT
TO anon, authenticated
WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'bharat-play'
  )
);

-- 7. Allow public webhook to update leads & contacts (e.g. flipping UNPAID to PAID)
DROP POLICY IF EXISTS "Allow public webhook lead update for Bharat Play" ON public.leads;
CREATE POLICY "Allow public webhook lead update for Bharat Play"
ON public.leads
FOR UPDATE
TO anon, authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'bharat-play'
  )
);

DROP POLICY IF EXISTS "Allow public webhook contact update for Bharat Play" ON public.contacts;
CREATE POLICY "Allow public webhook contact update for Bharat Play"
ON public.contacts
FOR UPDATE
TO anon, authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'bharat-play'
  )
);
