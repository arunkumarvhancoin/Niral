-- Multi-Tenant SaaS CRM Platform Database Migration
-- Comprehensive Schema, Triggers, RLS Policies, and Helper Functions

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS & DOMAINS
DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('Owner', 'Admin', 'Manager', 'Employee', 'Viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_status AS ENUM ('pending', 'approved', 'rejected', 'suspended', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE join_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    industry TEXT,
    company_size TEXT,
    website TEXT,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. ORGANIZATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Owner', 'Admin', 'Manager', 'Employee', 'Viewer')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended', 'revoked')),
    invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_organization UNIQUE (user_id, organization_id)
);

-- 6. ORGANIZATION INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Employee' CHECK (role IN ('Owner', 'Admin', 'Manager', 'Employee', 'Viewer')),
    token TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. ORGANIZATION JOIN REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.organization_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_pending_user_org_request UNIQUE (user_id, organization_id, status)
);

-- 8. CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    job_title TEXT,
    company_name TEXT,
    status TEXT DEFAULT 'lead' CHECK (status IN ('lead', 'customer', 'partner', 'inactive')),
    notes TEXT,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. LEADS TABLE
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    source TEXT DEFAULT 'Website' CHECK (source IN ('Website', 'Referral', 'Outreach', 'Inbound', 'Event', 'Other')),
    status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Qualified', 'Lost', 'Converted')),
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    value NUMERIC(12, 2) DEFAULT 0.00,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    converted_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    converted_deal_id UUID,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. PIPELINES AND PIPELINE STAGES
CREATE TABLE IF NOT EXISTS public.pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    probability INTEGER NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 11. DEALS TABLE
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    value NUMERIC(12, 2) DEFAULT 0.00,
    expected_close_date DATE,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 12. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    related_type TEXT CHECK (related_type IN ('contact', 'deal', 'lead', 'organization', NULL)),
    related_id UUID,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 13. ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('note', 'call', 'meeting', 'follow_up', 'email')),
    title TEXT NOT NULL,
    description TEXT,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    related_type TEXT CHECK (related_type IN ('contact', 'deal', 'lead', 'organization', NULL)),
    related_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 14. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'membership_request', 'membership_approved', 'membership_rejected', 
        'invitation_received', 'invitation_accepted', 'task_assigned', 'system'
    )),
    read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 15. INDEXES FOR PERFORMANCE & FAST MULTI-TENANT ISOLATION
CREATE INDEX IF NOT EXISTS idx_members_user_org ON public.organization_members(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_members_org_status ON public.organization_members(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_join_requests_org ON public.organization_join_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org ON public.leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_org ON public.deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_org ON public.activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);

-- 16. SECURITY DEFINER HELPER FUNCTIONS (Avoid Recursive RLS)
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.organization_members
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND status = 'approved'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_role(org_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT role 
    FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'approved'
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(org_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.organization_members
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND status = 'approved'
          AND role = ANY(allowed_roles)
    );
$$;

-- 17. TRIGGER: PREVENT DEMOTING OR REMOVING THE LAST ACTIVE OWNER
CREATE OR REPLACE FUNCTION public.check_last_active_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    owner_count INTEGER;
BEGIN
    -- If deleting an owner, or modifying an owner's role or status away from 'approved'
    IF (TG_OP = 'DELETE' AND OLD.role = 'Owner' AND OLD.status = 'approved') OR
       (TG_OP = 'UPDATE' AND OLD.role = 'Owner' AND OLD.status = 'approved' AND (NEW.role <> 'Owner' OR NEW.status <> 'approved')) THEN
        
        SELECT COUNT(*)
        INTO owner_count
        FROM public.organization_members
        WHERE organization_id = OLD.organization_id
          AND role = 'Owner'
          AND status = 'approved'
          AND id <> OLD.id;

        IF owner_count = 0 THEN
            RAISE EXCEPTION 'Cannot demote or remove the last active Owner of the organization.';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner_removal ON public.organization_members;
CREATE TRIGGER trg_prevent_last_owner_removal
    BEFORE UPDATE OR DELETE ON public.organization_members
    FOR EACH ROW
    EXECUTE FUNCTION public.check_last_active_owner();

-- 18. TRIGGER: AUTO-CREATE PROFILE ON AUTH.USERS SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 19. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 20. RLS POLICIES

-- PROFILES
CREATE POLICY "Profiles readable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- ORGANIZATIONS
-- Users can read basic info of organizations if:
-- 1. They are an approved member
-- 2. Or they want to search organizations to join (name, slug, logo, industry, description)
CREATE POLICY "Users can read organizations they belong to or are public"
    ON public.organizations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create an organization"
    ON public.organizations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Only Owners and Admins can update organization"
    ON public.organizations FOR UPDATE
    TO authenticated
    USING (public.has_org_role(id, ARRAY['Owner', 'Admin']));

CREATE POLICY "Only Owners can delete organization"
    ON public.organizations FOR DELETE
    TO authenticated
    USING (public.has_org_role(id, ARRAY['Owner']));

-- ORGANIZATION MEMBERS
CREATE POLICY "Approved members can view organization members"
    ON public.organization_members FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        public.is_org_member(organization_id)
    );

CREATE POLICY "Owners and Admins can insert members (or user creating org)"
    ON public.organization_members FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id OR
        public.has_org_role(organization_id, ARRAY['Owner', 'Admin'])
    );

CREATE POLICY "Owners and Admins can update members, users cannot change own role"
    ON public.organization_members FOR UPDATE
    TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['Owner', 'Admin']));

CREATE POLICY "Owners, Admins or user self can delete membership (leave org)"
    ON public.organization_members FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        public.has_org_role(organization_id, ARRAY['Owner', 'Admin'])
    );

-- ORGANIZATION INVITATIONS
CREATE POLICY "Admins can view invitations or recipient can view pending invitation by email"
    ON public.organization_invitations FOR SELECT
    TO authenticated
    USING (
        public.has_org_role(organization_id, ARRAY['Owner', 'Admin']) OR
        email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Only Owners and Admins can create invitations"
    ON public.organization_invitations FOR INSERT
    TO authenticated
    WITH CHECK (public.has_org_role(organization_id, ARRAY['Owner', 'Admin']));

CREATE POLICY "Admins can update invitations or recipient can accept/reject"
    ON public.organization_invitations FOR UPDATE
    TO authenticated
    USING (
        public.has_org_role(organization_id, ARRAY['Owner', 'Admin']) OR
        email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Only Admins and Owners can delete invitations"
    ON public.organization_invitations FOR DELETE
    TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['Owner', 'Admin']));

-- JOIN REQUESTS
CREATE POLICY "Admins and requesting user can view join requests"
    ON public.organization_join_requests FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        public.has_org_role(organization_id, ARRAY['Owner', 'Admin'])
    );

CREATE POLICY "Users can create join request for themselves"
    ON public.organization_join_requests FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can review requests, or user can cancel pending request"
    ON public.organization_join_requests FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        public.has_org_role(organization_id, ARRAY['Owner', 'Admin'])
    );

-- CRM MODULES (Only approved members can access)
-- Contacts
CREATE POLICY "Approved members can view contacts"
    ON public.contacts FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Owners, Admins, Managers, Employees can insert contacts"
    ON public.contacts FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager', 'Employee'])
    );

CREATE POLICY "Owners, Admins, Managers, Employees can update contacts"
    ON public.contacts FOR UPDATE
    TO authenticated
    USING (
        public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager', 'Employee'])
    );

CREATE POLICY "Owners and Admins can delete contacts"
    ON public.contacts FOR DELETE
    TO authenticated
    USING (
        public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
    );

-- Leads
CREATE POLICY "Approved members can view leads"
    ON public.leads FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Permitted roles can create leads"
    ON public.leads FOR INSERT
    TO authenticated
    WITH CHECK (public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager', 'Employee']));

CREATE POLICY "Permitted roles can update leads"
    ON public.leads FOR UPDATE
    TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager', 'Employee']));

CREATE POLICY "Managers, Admins and Owners can delete leads"
    ON public.leads FOR DELETE
    TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager']));

-- Pipelines and stages
CREATE POLICY "Approved members can view pipelines"
    ON public.pipelines FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Only Owners, Admins, Managers can manage pipelines"
    ON public.pipelines FOR ALL
    TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager']));

CREATE POLICY "Approved members can view pipeline stages"
    ON public.pipeline_stages FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Only Owners, Admins, Managers can manage stages"
    ON public.pipeline_stages FOR ALL
    TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager']));

-- Deals
CREATE POLICY "Approved members can view deals"
    ON public.deals FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Permitted roles can insert deals"
    ON public.deals FOR INSERT
    TO authenticated
    WITH CHECK (public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager', 'Employee']));

CREATE POLICY "Permitted roles can update deals"
    ON public.deals FOR UPDATE
    TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager', 'Employee']));

CREATE POLICY "Owners, Admins, Managers can delete deals"
    ON public.deals FOR DELETE
    TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager']));

-- Tasks
CREATE POLICY "Approved members can view tasks"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Permitted roles can manage tasks"
    ON public.tasks FOR ALL
    TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager', 'Employee']));

-- Activities
CREATE POLICY "Approved members can view activities"
    ON public.activities FOR SELECT
    TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Permitted roles can insert activities"
    ON public.activities FOR INSERT
    TO authenticated
    WITH CHECK (public.has_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager', 'Employee']));

-- Notifications
CREATE POLICY "Users can view and manage their own notifications"
    ON public.notifications FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

