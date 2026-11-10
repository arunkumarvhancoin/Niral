-- ============================================================================
-- Migration: Strict Organization Isolation & RBAC Protection
-- Guarantees that accounts CANNOT access organizations they are not members of.
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

-- 2. REVOKE all blanket public/anonymous reading & deleting policies
-- An organization must NEVER be visible to all users or the public!
DROP POLICY IF EXISTS "Allow read for Bharat Play leads" ON public.leads;
DROP POLICY IF EXISTS "Allow delete for Bharat Play leads" ON public.leads;
DROP POLICY IF EXISTS "Allow read for Bharat Play contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow delete for Bharat Play contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow public read for Bharat Play organization" ON public.organizations;

-- 3. CLEAN UP ORGANIZATION MEMBERSHIP
-- Remove any users who were added to Bharat Play via blanket cross joins.
-- Only keep members who were the organization creator or explicitly invited.
DELETE FROM public.organization_members
WHERE organization_id IN (SELECT id FROM public.organizations WHERE slug = 'bharat-play')
  AND user_id NOT IN (
    SELECT created_by FROM public.organizations WHERE slug = 'bharat-play' AND created_by IS NOT NULL
  )
  AND invited_by IS NULL;

-- 4. Ensure the organization creator is an Approved Owner
INSERT INTO public.organization_members (user_id, organization_id, role, status)
SELECT 
  o.created_by as user_id, 
  o.id as organization_id, 
  'Owner' as role, 
  'approved' as status
FROM public.organizations o
WHERE o.slug = 'bharat-play'
  AND o.created_by IS NOT NULL
ON CONFLICT (user_id, organization_id) DO UPDATE
SET role = 'Owner', status = 'approved';

-- 5. STRICT RLS: Only approved members can view an organization
DROP POLICY IF EXISTS "Approved members can view their organizations" ON public.organizations;
CREATE POLICY "Approved members can view their organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'approved'
  )
  OR created_by = auth.uid()
);

-- 6. STRICT RLS: Only approved members can view leads of their organization
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

-- 7. STRICT RLS: Only Managers, Admins and Owners can delete leads of their organization
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

-- 8. STRICT RLS: Only approved members can view contacts of their organization
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

-- 9. ALLOW PUBLIC WEBHOOK TO INSERT BOOKINGS ONLY (No SELECT, No DELETE)
-- The Bharat Play website registration form needs to record new bookings.
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
