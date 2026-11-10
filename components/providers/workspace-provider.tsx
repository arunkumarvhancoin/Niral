'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CRMService } from '../../lib/services/crm-service';
import { useOrganizationStore } from '../../lib/stores/organization-store';
import { UserProfile, Organization, MemberRole, MemberStatus } from '../../lib/types/crm';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

interface WorkspaceContextType {
  currentUser: UserProfile | null;
  currentOrg: Organization | null;
  currentRole: MemberRole | null;
  currentStatus: MemberStatus | null;
  memberships: { organization: Organization; role: MemberRole; status: MemberStatus }[];
  isLoading: boolean;
  setCurrentOrg: (org: Organization, role: MemberRole, status: MemberStatus) => void;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshWorkspace: (silent?: boolean, preferredOrgId?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const {
    currentOrg,
    currentRole,
    currentStatus,
    memberships,
    setCurrentOrg,
    setMemberships,
    reset,
  } = useOrganizationStore();

  // If currentOrg is already cached in localStorage via persist, don't show loading spinner!
  const [isLoading, setIsLoading] = useState(!currentOrg);

  const router = useRouter();
  const pathname = usePathname();

  const refreshWorkspace = useCallback(async (silent: boolean = false, preferredOrgId?: string) => {
    try {
      const user = await CRMService.getActiveUser();
      setCurrentUser(user);

      if (!user) {
        reset();
        // If on protected page and not logged in, redirect to login
        if (
          !pathname.startsWith('/auth') &&
          pathname !== '/login' &&
          pathname !== '/register' &&
          !pathname.startsWith('/invite')
        ) {
          router.push('/auth/login');
        }
        setIsLoading(false);
        return;
      }

      const userMemberships = await CRMService.getUserOrganizations(user.id);
      setMemberships(userMemberships);

      const approvedMemberships = userMemberships.filter((m) => m.status === 'approved');

      // Check preferredOrgId first, then cookie or previous active org
      const targetId = preferredOrgId || currentOrg?.id;
      let targetMembership = approvedMemberships.find((m) => m.organization.id === targetId);

      // If active org is invalid or not approved, pick first approved
      if (!targetMembership && approvedMemberships.length > 0) {
        targetMembership = approvedMemberships[0];
      }

      if (targetMembership) {
        setCurrentOrg(targetMembership.organization, targetMembership.role, targetMembership.status);
      } else {
        // If user has no approved orgs, check if they have a pending membership or should be routed to onboarding
        if (userMemberships.length > 0) {
          const firstPending = userMemberships[0];
          setCurrentOrg(firstPending.organization, firstPending.role, firstPending.status);
        } else if (
          !pathname.startsWith('/onboarding') &&
          !pathname.startsWith('/auth') &&
          !pathname.startsWith('/invite')
        ) {
          router.push('/onboarding');
        }
      }
    } catch (err) {
      console.error('Failed to initialize workspace:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, pathname, router, setCurrentOrg, setMemberships, reset]);

  useEffect(() => {
    // Initial fetch - silent if we already have an active org
    refreshWorkspace(Boolean(currentOrg));

    // Listen to Supabase auth state changes in real time
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        reset();
        router.push('/auth/login');
      } else if (event === 'SIGNED_IN') {
        refreshWorkspace(false);
      } else if (event === 'TOKEN_REFRESHED') {
        refreshWorkspace(true); // Silent revalidation
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const switchOrganization = async (orgId: string) => {
    let membership = memberships.find((m) => m.organization.id === orgId);

    // If not in local store yet, fetch fresh memberships directly from Supabase
    if (!membership) {
      const user = await CRMService.getActiveUser();
      if (user) {
        const freshMemberships = await CRMService.getUserOrganizations(user.id);
        setMemberships(freshMemberships);
        membership = freshMemberships.find((m) => m.organization.id === orgId);
      }
    }

    if (!membership) {
      throw new Error('Not a member of this organization');
    }

    if (membership.status !== 'approved') {
      throw new Error(`Your membership status in this organization is ${membership.status}`);
    }

    // Instant switch without full-screen blanking
    setCurrentOrg(membership.organization, membership.role, membership.status);
  };

  const signOut = async () => {
    await CRMService.signOut();
    reset();
    setCurrentUser(null);
    router.push('/auth/login');
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentUser,
        currentOrg,
        currentRole,
        currentStatus,
        memberships,
        isLoading,
        setCurrentOrg,
        switchOrganization,
        refreshWorkspace,
        signOut,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
