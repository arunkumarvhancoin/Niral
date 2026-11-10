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

-- 2. Allow reading the Bharat Play organization
DROP POLICY IF EXISTS "Allow public read for Bharat Play organization" ON public.organizations;
CREATE POLICY "Allow public read for Bharat Play organization"
ON public.organizations
FOR SELECT
TO anon, authenticated
USING (slug = 'bharat-play');

-- 3. Allow inserting leads strictly for Bharat Play
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

-- 4. Allow reading leads for Bharat Play (for the Registrations viewing dashboard)
DROP POLICY IF EXISTS "Allow read for Bharat Play leads" ON public.leads;
CREATE POLICY "Allow read for Bharat Play leads"
ON public.leads
FOR SELECT
TO anon, authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'bharat-play'
  )
);

-- 5. Allow deleting leads for Bharat Play (for the Registrations delete button)
DROP POLICY IF EXISTS "Allow delete for Bharat Play leads" ON public.leads;
CREATE POLICY "Allow delete for Bharat Play leads"
ON public.leads
FOR DELETE
TO anon, authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'bharat-play'
  )
);

-- 6. Allow inserting contacts strictly for Bharat Play
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

-- 7. Allow reading contacts for Bharat Play (to retrieve payment proof screenshot notes)
DROP POLICY IF EXISTS "Allow read for Bharat Play contacts" ON public.contacts;
CREATE POLICY "Allow read for Bharat Play contacts"
ON public.contacts
FOR SELECT
TO anon, authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'bharat-play'
  )
);

-- 8. Allow deleting contacts for Bharat Play
DROP POLICY IF EXISTS "Allow delete for Bharat Play contacts" ON public.contacts;
CREATE POLICY "Allow delete for Bharat Play contacts"
ON public.contacts
FOR DELETE
TO anon, authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'bharat-play'
  )
);

-- 9. Allow inserting activities strictly for Bharat Play
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

-- 10. Grant all registered CRM users Approved Owner access to the Bharat Play organization
INSERT INTO public.organization_members (user_id, organization_id, role, status)
SELECT 
  p.id as user_id, 
  o.id as organization_id, 
  'Owner' as role, 
  'approved' as status
FROM public.profiles p
CROSS JOIN public.organizations o
WHERE o.slug = 'bharat-play'
ON CONFLICT (user_id, organization_id) DO UPDATE
SET role = 'Owner', status = 'approved';
