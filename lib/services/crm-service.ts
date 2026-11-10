import { createClient as createBrowserClient } from '../supabase/client';
import {
  UserProfile,
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  OrganizationJoinRequest,
  Contact,
  Lead,
  Pipeline,
  PipelineStage,
  Deal,
  Task,
  Activity,
  InAppNotification,
  MemberRole,
  MemberStatus,
} from '../types/crm';

export interface DashboardMetrics {
  totalContacts: number;
  totalLeads: number;
  openDeals: number;
  closedDeals: number;
  pipelineRevenue: number;
  wonRevenue: number;
  recentActivities: Activity[];
  upcomingTasks: Task[];
  leadConversionRate: number;
}

// In-memory CRM cache for fast, seamless navigation
const crmCache = new Map<string, { data: any; expiry: number }>();

function getCached<T>(key: string): T | null {
  const item = crmCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    crmCache.delete(key);
    return null;
  }
  return item.data as T;
}

function setCached(key: string, data: any, ttlMs: number = 30000) {
  crmCache.set(key, { data, expiry: Date.now() + ttlMs });
}

export function invalidateCRMCache(prefix?: string) {
  if (!prefix) {
    crmCache.clear();
  } else {
    for (const key of crmCache.keys()) {
      if (key.includes(prefix)) {
        crmCache.delete(key);
      }
    }
  }
}

// 100% Real Supabase Data Service
export const CRMService = {
  // 1. Current authenticated user profile
  getActiveUser: async (): Promise<UserProfile | null> => {
    const cachedUser = getCached<UserProfile>('active_user');
    if (cachedUser) return cachedUser;

    const supabase = createBrowserClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return null;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      const userProfile = profile as UserProfile;
      setCached('active_user', userProfile, 20000);
      return userProfile;
    }

    // If profile row doesn't exist yet, insert it from auth session
    const newProfile: UserProfile = {
      id: user.id,
      email: user.email || '',
      full_name: (user.user_metadata?.full_name as string) || (user.email ? user.email.split('@')[0] : 'User'),
      avatar_url: (user.user_metadata?.avatar_url as string) || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase.from('profiles').upsert(newProfile);
    setCached('active_user', newProfile, 20000);
    return newProfile;
  },

  signOut: async (): Promise<void> => {
    invalidateCRMCache();
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    if (typeof document !== 'undefined') {
      document.cookie = 'active_org_id=; path=/; max-age=0';
    }
  },

  updateProfile: async (
    userId: string,
    updates: {
      full_name?: string;
      avatar_url?: string | null;
    }
  ): Promise<UserProfile> => {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to update personal profile');
    }

    try {
      await supabase.auth.updateUser({
        data: {
          full_name: updates.full_name,
          avatar_url: updates.avatar_url,
        },
      });
    } catch (authErr) {
      console.warn('Auth user metadata update notice:', authErr);
    }

    invalidateCRMCache();
    return data as UserProfile;
  },

  updatePassword: async (newPassword: string): Promise<void> => {
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(error.message || 'Failed to update password');
    }
  },

  // 2. Organizations & Memberships
  getUserOrganizations: async (
    userId: string
  ): Promise<{ organization: Organization; role: MemberRole; status: MemberStatus }[]> => {
    const supabase = createBrowserClient();

    // Auto-claim any pending invitations for this user's email on login / check
    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      if (userProfile?.email) {
        const cleanEmail = userProfile.email.toLowerCase().trim();
        const { data: pendingInvs } = await supabase
          .from('organization_invitations')
          .select('*')
          .ilike('email', cleanEmail)
          .eq('status', 'pending');

        if (pendingInvs && pendingInvs.length > 0) {
          for (const inv of pendingInvs) {
            await supabase.from('organization_members').upsert(
              {
                organization_id: inv.organization_id,
                user_id: userId,
                role: inv.role,
                status: 'approved',
                invited_by: inv.invited_by,
                joined_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,organization_id' }
            );

            await supabase
              .from('organization_invitations')
              .update({ status: 'accepted', updated_at: new Date().toISOString() })
              .eq('id', inv.id);
          }
        }
      }
    } catch (claimErr) {
      console.warn('Auto-claim invitations notice:', claimErr);
    }

    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        role,
        status,
        organization:organizations (*)
      `)
      .eq('user_id', userId);

    if (error || !data) {
      console.error('Error fetching user organizations:', error);
      return [];
    }

    return data
      .filter((item: any) => item.organization)
      .map((item: any) => ({
        organization: item.organization as Organization,
        role: item.role as MemberRole,
        status: item.status as MemberStatus,
      }));
  },

  createOrganization: async (
    userId: string,
    params: {
      name: string;
      slug: string;
      industry?: string;
      company_size?: string;
      website?: string;
      description?: string;
      logo_url?: string;
    }
  ): Promise<{ organization: Organization; member: OrganizationMember }> => {
    const supabase = createBrowserClient();
    const cleanSlug = params.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: params.name,
        slug: cleanSlug,
        industry: params.industry || null,
        company_size: params.company_size || null,
        website: params.website || null,
        description: params.description || null,
        logo_url: params.logo_url || null,
        created_by: userId,
      })
      .select()
      .single();

    if (orgError) {
      throw new Error(orgError.message || 'Failed to create organization');
    }

    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .insert({
        user_id: userId,
        organization_id: org.id,
        role: 'Owner',
        status: 'approved',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (memberError) {
      throw new Error(memberError.message || 'Failed to assign owner membership');
    }

    // Automatically provision default sales pipeline and standard stages
    const { data: pipeline } = await supabase
      .from('pipelines')
      .insert({
        organization_id: org.id,
        name: 'Standard Sales Pipeline',
        is_default: true,
      })
      .select()
      .single();

    if (pipeline) {
      await supabase.from('pipeline_stages').insert([
        { organization_id: org.id, pipeline_id: pipeline.id, name: 'Lead Qualified', order_index: 0, probability: 20, color: '#3b82f6' },
        { organization_id: org.id, pipeline_id: pipeline.id, name: 'Proposal Sent', order_index: 1, probability: 50, color: '#8b5cf6' },
        { organization_id: org.id, pipeline_id: pipeline.id, name: 'Negotiation', order_index: 2, probability: 80, color: '#f59e0b' },
        { organization_id: org.id, pipeline_id: pipeline.id, name: 'Closed Won', order_index: 3, probability: 100, color: '#10b981' },
      ]);
    }

    // Create welcome notification
    await supabase.from('notifications').insert({
      organization_id: org.id,
      user_id: userId,
      title: `Welcome to ${org.name}`,
      message: 'Workspace created successfully with full Owner administrative privileges.',
      type: 'system',
      read: false,
      link: '/dashboard',
    });

    return { organization: org as Organization, member: member as OrganizationMember };
  },

  updateOrganization: async (orgId: string, updates: Partial<Organization>): Promise<Organization> => {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('organizations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Organization;
  },

  // 3. Organization Members Management
  getOrganizationMembers: async (orgId: string): Promise<OrganizationMember[]> => {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        *,
        user:profiles!organization_members_user_id_fkey (*)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      return data as OrganizationMember[];
    }

    // Resilient fallback: fetch members and profiles separately
    const { data: members, error: mErr } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (mErr || !members) return [];

    const userIds = members.map((m: any) => m.user_id).filter(Boolean);
    if (userIds.length === 0) return members as OrganizationMember[];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    return members.map((m: any) => ({
      ...m,
      user: profileMap.get(m.user_id) || null,
    })) as OrganizationMember[];
  },

  updateMemberRole: async (orgId: string, memberId: string, newRole: MemberRole): Promise<void> => {
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);
  },

  updateMemberStatus: async (orgId: string, memberId: string, newStatus: MemberStatus): Promise<void> => {
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from('organization_members')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);
  },

  removeMember: async (orgId: string, memberId: string): Promise<void> => {
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);
  },

  leaveOrganization: async (orgId: string, userId: string): Promise<void> => {
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  },

  // 4. Join Requests & Discovery
  searchOrganizations: async (query: string): Promise<Organization[]> => {
    const supabase = createBrowserClient();
    let queryBuilder = supabase.from('organizations').select('*');
    if (query && query.trim()) {
      const q = query.trim();
      queryBuilder = queryBuilder.or(`name.ilike.%${q}%,slug.ilike.%${q}%,industry.ilike.%${q}%`);
    }
    const { data, error } = await queryBuilder.limit(20);
    if (error) return [];
    return (data || []) as Organization[];
  },

  createJoinRequest: async (orgId: string, userId: string, message?: string): Promise<OrganizationJoinRequest> => {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('organization_join_requests')
      .insert({
        organization_id: orgId,
        user_id: userId,
        message: message || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Notify organization admins
    const { data: admins } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .in('role', ['Owner', 'Admin']);

    if (admins && admins.length > 0) {
      const notificationsToInsert = admins.map((admin) => ({
        organization_id: orgId,
        user_id: admin.user_id,
        title: 'New Membership Request',
        message: 'A user has requested access to join your company workspace.',
        type: 'membership_request',
        read: false,
        link: '/team',
      }));
      await supabase.from('notifications').insert(notificationsToInsert);
    }

    return data as OrganizationJoinRequest;
  },

  getJoinRequests: async (orgId: string): Promise<OrganizationJoinRequest[]> => {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('organization_join_requests')
      .select(`
        *,
        user:profiles!organization_join_requests_user_id_fkey (*)
      `)
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data as OrganizationJoinRequest[];
    }

    // Fallback: fetch requests and profiles separately
    const { data: requests } = await supabase
      .from('organization_join_requests')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!requests || requests.length === 0) return [];

    const userIds = requests.map((r: any) => r.user_id).filter(Boolean);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    return requests.map((r: any) => ({
      ...r,
      user: profileMap.get(r.user_id) || null,
    })) as OrganizationJoinRequest[];
  },

  getUserJoinRequests: async (userId: string): Promise<OrganizationJoinRequest[]> => {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('organization_join_requests')
      .select(`
        *,
        organization:organizations (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []) as OrganizationJoinRequest[];
  },

  reviewJoinRequest: async (
    requestId: string,
    status: 'approved' | 'rejected',
    reviewerId: string,
    assignedRole: MemberRole = 'Employee'
  ): Promise<void> => {
    const supabase = createBrowserClient();
    const { data: request, error: reqError } = await supabase
      .from('organization_join_requests')
      .update({
        status,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (reqError || !request) throw new Error(reqError?.message || 'Request update failed');

    if (status === 'approved') {
      // Upsert membership
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert(
          {
            organization_id: request.organization_id,
            user_id: request.user_id,
            role: assignedRole,
            status: 'approved',
            invited_by: reviewerId,
            joined_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,organization_id' }
        );

      if (memberError) throw new Error(memberError.message);

      // Notify the user
      await supabase.from('notifications').insert({
        organization_id: request.organization_id,
        user_id: request.user_id,
        title: 'Membership Request Approved!',
        message: 'Your request to join has been approved. You can now switch into this workspace.',
        type: 'membership_approved',
        read: false,
        link: '/dashboard',
      });
    } else {
      await supabase.from('notifications').insert({
        organization_id: request.organization_id,
        user_id: request.user_id,
        title: 'Membership Request Declined',
        message: 'Your request to join the organization was not accepted.',
        type: 'membership_rejected',
        read: false,
        link: '/onboarding',
      });
    }
  },

  // 5. Team Membership & Invitations System
  addMemberByEmail: async (
    orgId: string,
    email: string,
    role: MemberRole,
    inviterId: string
  ): Promise<{ addedDirectly: boolean; memberName?: string }> => {
    const supabase = createBrowserClient();
    const cleanEmail = email.trim().toLowerCase();

    // Check if a profile with this email already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      // User is already registered! Add directly to organization_members as 'approved'
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert(
          {
            organization_id: orgId,
            user_id: existingProfile.id,
            role,
            status: 'approved',
            invited_by: inviterId,
            joined_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,organization_id' }
        );

      if (memberError) throw new Error(memberError.message);

      invalidateCRMCache(orgId);
      return {
        addedDirectly: true,
        memberName: existingProfile.full_name || existingProfile.email,
      };
    } else {
      // User hasn't registered yet! Store in organization_invitations
      // The moment they sign up or log in, getUserOrganizations will automatically attach them!
      const token = `auto-${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
      const expiresAt = new Date(Date.now() + 60 * 86400000).toISOString();

      const { error: invError } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: orgId,
          email: cleanEmail,
          role,
          token,
          invited_by: inviterId,
          status: 'pending',
          expires_at: expiresAt,
        });

      if (invError) throw new Error(invError.message);

      invalidateCRMCache(orgId);
      return { addedDirectly: false };
    }
  },

  createInvitation: async (
    orgId: string,
    email: string,
    role: MemberRole,
    inviterId: string
  ): Promise<OrganizationInvitation> => {
    const supabase = createBrowserClient();
    const token = `inv-${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

    const { data, error } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: orgId,
        email: email.trim().toLowerCase(),
        role,
        token,
        invited_by: inviterId,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // If an existing registered user matches the email, notify them
    const { data: matchedProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email.trim())
      .maybeSingle();

    if (matchedProfile) {
      await supabase.from('notifications').insert({
        organization_id: orgId,
        user_id: matchedProfile.id,
        title: 'Organization Invitation',
        message: `You were invited to join as ${role}. Click to accept your invitation.`,
        type: 'invitation_received',
        read: false,
        link: `/invite/${token}`,
      });
    }

    return data as OrganizationInvitation;
  },

  getOrganizationInvitations: async (orgId: string): Promise<OrganizationInvitation[]> => {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []) as OrganizationInvitation[];
  },

  acceptInvitation: async (token: string, userId: string): Promise<{ organizationId: string }> => {
    const supabase = createBrowserClient();
    const { data: invitation, error: invError } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (invError || !invitation) {
      throw new Error('Invalid or expired invitation token.');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profile || profile.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error(`This invitation was issued to ${invitation.email}. You are currently signed in as ${profile?.email}.`);
    }

    // Mark invitation accepted
    await supabase
      .from('organization_invitations')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', invitation.id);

    // Upsert membership
    const { error: memberError } = await supabase
      .from('organization_members')
      .upsert(
        {
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
          status: 'approved',
          invited_by: invitation.invited_by,
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,organization_id' }
      );

    if (memberError) throw new Error(memberError.message);

    return { organizationId: invitation.organization_id };
  },

  revokeInvitation: async (invitationId: string): Promise<void> => {
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from('organization_invitations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', invitationId);

    if (error) throw new Error(error.message);
  },

  // 6. CRM Isolated Data Modules (Filtered strictly by organization_id)
  getDashboardMetrics: async (orgId: string): Promise<DashboardMetrics> => {
    const cacheKey = `metrics_${orgId}`;
    const cached = getCached<DashboardMetrics>(cacheKey);
    if (cached) return cached;

    const supabase = createBrowserClient();

    const [
      { count: totalContacts },
      { data: leadsData },
      { data: dealsData },
      { data: tasksData },
      { data: activitiesData },
    ] = await Promise.all([
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('leads').select('id, status').eq('organization_id', orgId),
      supabase.from('deals').select('id, value, status').eq('organization_id', orgId),
      supabase.from('tasks').select('*').eq('organization_id', orgId).neq('status', 'completed').order('created_at', { ascending: false }).limit(5),
      supabase.from('activities').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(5),
    ]);

    const leads = leadsData || [];
    const deals = dealsData || [];
    const openDeals = deals.filter((d) => d.status === 'open');
    const wonDeals = deals.filter((d) => d.status === 'won');

    const pipelineRevenue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const wonRevenue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

    const totalLeadsCount = leads.length;
    const convertedLeadsCount = leads.filter((l) => l.status === 'Converted').length;
    const conversionRate = totalLeadsCount > 0 ? Math.round((convertedLeadsCount / totalLeadsCount) * 100) : 0;

    const result: DashboardMetrics = {
      totalContacts: totalContacts || 0,
      totalLeads: totalLeadsCount,
      openDeals: openDeals.length,
      closedDeals: wonDeals.length,
      pipelineRevenue,
      wonRevenue,
      recentActivities: (activitiesData || []) as Activity[],
      upcomingTasks: (tasksData || []) as Task[],
      leadConversionRate: conversionRate,
    };

    setCached(cacheKey, result, 20000);
    return result;
  },

  // Contacts
  getContacts: async (orgId: string, search?: string, statusFilter?: string): Promise<Contact[]> => {
    const isDefaultQuery = !search?.trim() && (!statusFilter || statusFilter === 'all');
    const cacheKey = `contacts_${orgId}`;
    if (isDefaultQuery) {
      const cached = getCached<Contact[]>(cacheKey);
      if (cached) return cached;
    }

    const supabase = createBrowserClient();
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (search && search.trim()) {
      const q = search.trim();
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching contacts:', error);
      return [];
    }
    const list = (data || []) as Contact[];
    if (isDefaultQuery) {
      setCached(cacheKey, list, 25000);
    }
    return list;
  },

  createContact: async (orgId: string, contactData: Partial<Contact>, creatorId: string): Promise<Contact> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        organization_id: orgId,
        first_name: contactData.first_name,
        last_name: contactData.last_name,
        email: contactData.email || null,
        phone: contactData.phone || null,
        job_title: contactData.job_title || null,
        company_name: contactData.company_name || null,
        status: contactData.status || 'lead',
        notes: contactData.notes || null,
        assigned_to: contactData.assigned_to || creatorId,
        created_by: creatorId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Auto-record activity
    await supabase.from('activities').insert({
      organization_id: orgId,
      type: 'note',
      title: 'Created Contact',
      description: `Added ${data.first_name} ${data.last_name} (${data.company_name || 'No company'})`,
      performed_by: creatorId,
      related_type: 'contact',
      related_id: data.id,
    });

    return data as Contact;
  },

  updateContact: async (contactId: string, orgId: string, updates: Partial<Contact>): Promise<Contact> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('contacts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Contact;
  },

  deleteContact: async (contactId: string, orgId: string): Promise<void> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);
  },

  // Leads
  getLeads: async (orgId: string, search?: string, statusFilter?: string): Promise<Lead[]> => {
    const isDefaultQuery = !search?.trim() && (!statusFilter || statusFilter === 'all');
    const cacheKey = `leads_${orgId}`;
    if (isDefaultQuery) {
      const cached = getCached<Lead[]>(cacheKey);
      if (cached) return cached;
    }

    const supabase = createBrowserClient();
    let query = supabase
      .from('leads')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (search && search.trim()) {
      const q = search.trim();
      query = query.or(`title.ilike.%${q}%,company.ilike.%${q}%,first_name.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching leads:', error);
      return [];
    }
    const list = (data || []) as Lead[];
    if (isDefaultQuery) {
      setCached(cacheKey, list, 25000);
    }
    return list;
  },

  createLead: async (orgId: string, data: Partial<Lead>, creatorId: string): Promise<Lead> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        organization_id: orgId,
        title: data.title,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        source: data.source || 'Website',
        status: data.status || 'New',
        priority: data.priority || 'Medium',
        value: Number(data.value) || 0,
        assigned_to: data.assigned_to || creatorId,
        created_by: creatorId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return lead as Lead;
  },

  updateLead: async (leadId: string, orgId: string, updates: Partial<Lead>): Promise<Lead> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('leads')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Lead;
  },

  deleteLead: async (leadId: string, orgId: string): Promise<void> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);
  },

  convertLead: async (leadId: string, orgId: string, userId: string): Promise<{ contact: Contact; deal?: Deal }> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('organization_id', orgId)
      .single();

    if (leadError || !lead) throw new Error('Lead not found');

    // 1. Create Contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        organization_id: orgId,
        first_name: lead.first_name || lead.title,
        last_name: lead.last_name || '',
        email: lead.email,
        phone: lead.phone,
        company_name: lead.company,
        status: 'customer',
        notes: `Converted from lead "${lead.title}"`,
        assigned_to: lead.assigned_to || userId,
        created_by: userId,
      })
      .select()
      .single();

    if (contactError) throw new Error(contactError.message);

    // 2. Create Deal if value > 0
    let deal: Deal | undefined;
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_default', true)
      .maybeSingle();

    if (pipeline && lead.value > 0) {
      const { data: firstStage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', pipeline.id)
        .order('order_index', { ascending: true })
        .limit(1)
        .single();

      if (firstStage) {
        const { data: newDeal } = await supabase
          .from('deals')
          .insert({
            organization_id: orgId,
            pipeline_id: pipeline.id,
            stage_id: firstStage.id,
            contact_id: contact.id,
            title: lead.company ? `${lead.company} - Deal` : `${lead.title} - Deal`,
            value: lead.value,
            expected_close_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            status: 'open',
            owner_id: lead.assigned_to || userId,
            created_by: userId,
          })
          .select()
          .single();

        if (newDeal) deal = newDeal as Deal;
      }
    }

    // 3. Update Lead status
    await supabase
      .from('leads')
      .update({
        status: 'Converted',
        converted_contact_id: contact.id,
        converted_deal_id: deal ? deal.id : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    // 4. Record Activity
    await supabase.from('activities').insert({
      organization_id: orgId,
      type: 'note',
      title: 'Converted Lead',
      description: `Converted lead "${lead.title}" into customer contact and pipeline deal`,
      performed_by: userId,
      related_type: 'lead',
      related_id: lead.id,
    });

    return { contact: contact as Contact, deal };
  },

  // Deals & Pipelines
  getPipelines: async (orgId: string): Promise<(Pipeline & { stages: PipelineStage[] })[]> => {
    const cacheKey = `pipelines_${orgId}`;
    const cached = getCached<(Pipeline & { stages: PipelineStage[] })[]>(cacheKey);
    if (cached) return cached;

    const supabase = createBrowserClient();
    const { data: pipelines, error: pipeError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('organization_id', orgId);

    if (pipeError || !pipelines) return [];

    const { data: stages } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('organization_id', orgId)
      .order('order_index', { ascending: true });

    const allStages = stages || [];

    const result = pipelines.map((p) => ({
      ...p,
      stages: allStages.filter((s) => s.pipeline_id === p.id),
    }));
    setCached(cacheKey, result, 60000);
    return result;
  },

  getDeals: async (orgId: string): Promise<Deal[]> => {
    const cacheKey = `deals_${orgId}`;
    const cached = getCached<Deal[]>(cacheKey);
    if (cached) return cached;

    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        contact:contacts (*),
        stage:pipeline_stages (*)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching deals:', error);
      return [];
    }
    const list = (data || []) as Deal[];
    setCached(cacheKey, list, 25000);
    return list;
  },

  createDeal: async (orgId: string, data: Partial<Deal>, creatorId: string): Promise<Deal> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        organization_id: orgId,
        pipeline_id: data.pipeline_id,
        stage_id: data.stage_id,
        contact_id: data.contact_id || null,
        title: data.title,
        value: Number(data.value) || 0,
        expected_close_date: data.expected_close_date || null,
        status: data.status || 'open',
        owner_id: data.owner_id || creatorId,
        created_by: creatorId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return deal as Deal;
  },

  updateDeal: async (dealId: string, orgId: string, updates: Partial<Deal>): Promise<Deal> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('deals')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dealId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Deal;
  },

  deleteDeal: async (dealId: string, orgId: string): Promise<void> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', dealId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);
  },

  // Tasks
  getTasks: async (orgId: string, filter?: string): Promise<Task[]> => {
    const cacheKey = `tasks_${orgId}_${filter || 'all'}`;
    const cached = getCached<Task[]>(cacheKey);
    if (cached) return cached;

    const supabase = createBrowserClient();
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignee:profiles!tasks_assigned_to_fkey (*)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (filter === 'completed') {
      query = query.eq('status', 'completed');
    } else if (filter === 'pending') {
      query = query.neq('status', 'completed');
    }

    const { data, error } = await query;
    if (!error && data) {
      const list = data as Task[];
      setCached(cacheKey, list, 25000);
      return list;
    }

    // Fallback: fetch tasks and profiles separately to avoid ambiguous embedding error
    let fallbackQuery = supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (filter === 'completed') {
      fallbackQuery = fallbackQuery.eq('status', 'completed');
    } else if (filter === 'pending') {
      fallbackQuery = fallbackQuery.neq('status', 'completed');
    }

    const { data: tasks, error: taskErr } = await fallbackQuery;
    if (taskErr || !tasks) {
      return [];
    }

    const assigneeIds = tasks.map((t: any) => t.assigned_to).filter(Boolean);
    if (assigneeIds.length === 0) {
      setCached(cacheKey, tasks as Task[], 25000);
      return tasks as Task[];
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', assigneeIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const result = tasks.map((t: any) => ({
      ...t,
      assignee: profileMap.get(t.assigned_to) || null,
    })) as Task[];

    setCached(cacheKey, result, 25000);
    return result;
  },

  createTask: async (orgId: string, data: Partial<Task>, creatorId: string): Promise<Task> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        organization_id: orgId,
        title: data.title,
        description: data.description || null,
        due_date: data.due_date || null,
        priority: data.priority || 'medium',
        status: data.status || 'todo',
        assigned_to: data.assigned_to || creatorId,
        related_type: data.related_type || null,
        related_id: data.related_id || null,
        created_by: creatorId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (task.assigned_to && task.assigned_to !== creatorId) {
      await supabase.from('notifications').insert({
        organization_id: orgId,
        user_id: task.assigned_to,
        title: 'New Task Assigned',
        message: `You were assigned: ${task.title}`,
        type: 'task_assigned',
        read: false,
        link: '/tasks',
      });
    }

    return task as Task;
  },

  updateTask: async (taskId: string, orgId: string, updates: Partial<Task>): Promise<Task> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Task;
  },

  deleteTask: async (taskId: string, orgId: string): Promise<void> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);
  },

  // Activities
  getActivities: async (orgId: string): Promise<Activity[]> => {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        performer:profiles!activities_performed_by_fkey (*)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data as Activity[];
    }

    // Fallback: fetch activities and profiles separately
    const { data: activities, error: actErr } = await supabase
      .from('activities')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (actErr || !activities) return [];

    const performerIds = activities.map((a: any) => a.performed_by).filter(Boolean);
    if (performerIds.length === 0) return activities as Activity[];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', performerIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    return activities.map((a: any) => ({
      ...a,
      performer: profileMap.get(a.performed_by) || null,
    })) as Activity[];
  },

  createActivity: async (orgId: string, data: Partial<Activity>, performerId: string): Promise<Activity> => {
    invalidateCRMCache(orgId);
    const supabase = createBrowserClient();
    const { data: act, error } = await supabase
      .from('activities')
      .insert({
        organization_id: orgId,
        type: data.type || 'note',
        title: data.title,
        description: data.description || null,
        performed_by: performerId,
        related_type: data.related_type || null,
        related_id: data.related_id || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return act as Activity;
  },

  // Notifications
  getNotifications: async (userId: string, orgId?: string): Promise<InAppNotification[]> => {
    const supabase = createBrowserClient();
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (orgId) {
      query = query.or(`organization_id.eq.${orgId},organization_id.is.null`);
    }

    const { data, error } = await query.limit(20);
    if (error) return [];
    return (data || []) as InAppNotification[];
  },

  markNotificationRead: async (notificationId: string): Promise<void> => {
    const supabase = createBrowserClient();
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
  },

  markAllNotificationsRead: async (userId: string): Promise<void> => {
    const supabase = createBrowserClient();
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId);
  },
};
