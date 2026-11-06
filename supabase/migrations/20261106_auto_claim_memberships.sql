-- Auto-claim pending invitations on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Insert or update global profile
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

    -- 2. Auto-attach any pending organization memberships added for this email!
    INSERT INTO public.organization_members (organization_id, user_id, role, status, invited_by, joined_at)
    SELECT 
        inv.organization_id,
        NEW.id,
        inv.role,
        'approved',
        inv.invited_by,
        NOW()
    FROM public.organization_invitations inv
    WHERE LOWER(TRIM(inv.email)) = LOWER(TRIM(NEW.email))
      AND inv.status = 'pending'
    ON CONFLICT (user_id, organization_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'approved',
        joined_at = COALESCE(public.organization_members.joined_at, NOW());

    -- 3. Mark those invitations as accepted
    UPDATE public.organization_invitations
    SET status = 'accepted', updated_at = NOW()
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
      AND status = 'pending';

    RETURN NEW;
END;
$$;

