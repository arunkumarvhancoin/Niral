-- ============================================================================
-- Migration: Bharat Play CRM Integration & Strict Organization Isolation
-- ============================================================================

-- 1. Insert or ensure the Bharat Play organization exists
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

-- 3. Allow public / webhook registration form to insert leads strictly for Bharat Play
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

-- 4. Allow public / webhook registration form to insert contacts strictly for Bharat Play
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

-- 5. Allow public / webhook registration form to log activities strictly for Bharat Play
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
