-- ==============================================================================
-- Migration: Super Admin Universal Access & Organization Creation Invitations
-- Date: 2026-11-17
-- ==============================================================================

-- 1. Table: organization_creation_invites
-- Stores invitations created by Super Admins allowing selected users to create an organization workspace
CREATE TABLE IF NOT EXISTS public.organization_creation_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'revoked', 'expired')),
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_creation_invites_email ON public.organization_creation_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_org_creation_invites_token ON public.organization_creation_invites (token);

-- 2. Trigger Function: Enforce 1-Organization-Per-Person (Exempting Super Admins)
CREATE OR REPLACE FUNCTION public.check_user_org_creation_limit()
RETURNS TRIGGER AS $$
DECLARE
  creator_email TEXT;
  existing_org_count INT;
BEGIN
  -- Look up creator email from auth.users or profiles
  SELECT email INTO creator_email FROM auth.users WHERE id = NEW.created_by;
  IF creator_email IS NULL THEN
    SELECT email INTO creator_email FROM public.profiles WHERE id = NEW.created_by;
  END IF;
  
  -- Platform Super Admins are exempt from the 1-organization limit
  IF creator_email ILIKE 'arunkumar@vhanbe.com' OR creator_email ILIKE 'arunkumar@vhan.co.in' THEN
    RETURN NEW;
  END IF;

  -- Count existing organizations created by this authenticated user
  SELECT COUNT(*) INTO existing_org_count 
  FROM public.organizations 
  WHERE created_by = NEW.created_by;

  IF existing_org_count >= 1 THEN
    RAISE EXCEPTION 'Organization creation limit reached: You can only create 1 organization of your own. You may still join existing organizations if invited.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach Trigger to organizations table
DROP TRIGGER IF EXISTS trg_check_user_org_creation_limit ON public.organizations;
CREATE TRIGGER trg_check_user_org_creation_limit
BEFORE INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.check_user_org_creation_limit();

-- 3. Row Level Security for organization_creation_invites
ALTER TABLE public.organization_creation_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage org creation invites" ON public.organization_creation_invites;
CREATE POLICY "Super admins manage org creation invites"
ON public.organization_creation_invites
FOR ALL
TO authenticated
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) ILIKE 'arunkumar@vhanbe.com'
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) ILIKE 'arunkumar@vhan.co.in'
  OR lower(email) = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
);

-- 4. Automatically auto-claim pending memberships when a new user signs up or logs in
CREATE OR REPLACE FUNCTION public.auto_claim_pending_invitations()
RETURNS TRIGGER AS $$
DECLARE
  pending_inv RECORD;
BEGIN
  FOR pending_inv IN
    SELECT * FROM public.organization_invitations
    WHERE lower(email) = lower(NEW.email)
      AND status = 'pending'
  LOOP
    -- Insert approved organization member
    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      role,
      status,
      invited_by,
      joined_at,
      updated_at
    ) VALUES (
      pending_inv.organization_id,
      NEW.id,
      pending_inv.role,
      'approved',
      pending_inv.invited_by,
      now(),
      now()
    )
    ON CONFLICT (user_id, organization_id) DO NOTHING;

    -- Update invitation status to accepted
    UPDATE public.organization_invitations
    SET status = 'accepted', updated_at = now()
    WHERE id = pending_inv.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users when a user signs up
DROP TRIGGER IF EXISTS trg_auto_claim_pending_invitations ON auth.users;
CREATE TRIGGER trg_auto_claim_pending_invitations
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_claim_pending_invitations();

