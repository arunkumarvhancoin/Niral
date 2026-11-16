-- ============================================================================
-- Migration: Super Admin Access for arunkumar@vhan.co.in
-- Universal multi-organization visibility, management, and real-time oversight.
-- ============================================================================

-- 1. Helper function to check if a user is the platform Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin_uid(user_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = user_uid
          AND lower(email) = 'arunkumar@vhan.co.in'
    );
$$;

-- 2. Enhance is_org_member to grant Super Admin access to all organizations
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT (
        public.is_super_admin_uid(auth.uid())
        OR EXISTS (
            SELECT 1 
            FROM public.organization_members
            WHERE organization_id = org_id
              AND user_id = auth.uid()
              AND status = 'approved'
        )
    );
$$;

-- 3. Enhance has_org_role to grant Super Admin access to all roles
CREATE OR REPLACE FUNCTION public.has_org_role(org_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT (
        public.is_super_admin_uid(auth.uid())
        OR EXISTS (
            SELECT 1 
            FROM public.organization_members
            WHERE organization_id = org_id
              AND user_id = auth.uid()
              AND status = 'approved'
              AND role = ANY(allowed_roles)
        )
    );
$$;

-- 4. Automatically add arunkumar@vhan.co.in to any existing organization as Owner
DO $$
DECLARE
    super_admin_id UUID;
    org RECORD;
BEGIN
    SELECT id INTO super_admin_id
    FROM public.profiles
    WHERE lower(email) = 'arunkumar@vhan.co.in'
    LIMIT 1;

    IF super_admin_id IS NOT NULL THEN
        FOR org IN SELECT id FROM public.organizations LOOP
            INSERT INTO public.organization_members (
                organization_id,
                user_id,
                role,
                status,
                joined_at
            )
            VALUES (
                org.id,
                super_admin_id,
                'Owner',
                'approved',
                NOW()
            )
            ON CONFLICT (user_id, organization_id)
            DO UPDATE SET
                role = 'Owner',
                status = 'approved',
                updated_at = NOW();
        END LOOP;
    END IF;
END $$;

-- 5. Trigger: Automatically attach arunkumar@vhan.co.in as Owner to any future organization created
CREATE OR REPLACE FUNCTION public.auto_assign_super_admin_to_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    super_admin_id UUID;
BEGIN
    SELECT id INTO super_admin_id
    FROM public.profiles
    WHERE lower(email) = 'arunkumar@vhan.co.in'
    LIMIT 1;

    IF super_admin_id IS NOT NULL THEN
        INSERT INTO public.organization_members (
            organization_id,
            user_id,
            role,
            status,
            joined_at
        )
        VALUES (
            NEW.id,
            super_admin_id,
            'Owner',
            'approved',
            NOW()
        )
        ON CONFLICT (user_id, organization_id)
        DO UPDATE SET
            role = 'Owner',
            status = 'approved',
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_super_admin ON public.organizations;
CREATE TRIGGER trg_auto_assign_super_admin
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_super_admin_to_org();

