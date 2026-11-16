'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { CRMService, invalidateCRMCache } from '../../lib/services/crm-service';
import { useOrganizationStore } from '../../lib/stores/organization-store';
import { UserProfile, Organization, MemberRole, MemberStatus } from '../../lib/types/crm';
import { isSuperAdmin } from '../../lib/permissions';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

interface WorkspaceContextType {
  currentUser: UserProfile | null;
  currentOrg: Organization | null;
  currentRole: MemberRole | null;
  currentStatus: MemberStatus | null;
  memberships: { organization: Organization; role: MemberRole; status: MemberStatus }[];
  isLoading: boolean;
  isSwitchingOrg: boolean;
  switchingOrgName: string | null;
  setCurrentOrg: (org: Organization, role: MemberRole, status: MemberStatus) => void;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshWorkspace: (silent?: boolean, preferredOrgId?: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Super Admin Multi-Organization Oversight
  isSuperAdmin: boolean;
  selectedOrgIds: string[];
  effectiveOrgIds: string[];
  isAllOrgsSelected: boolean;
  isMultiOrgActive: boolean;
  setSelectedOrgIds: (ids: string[]) => void;
  toggleOrgSelection: (orgId: string) => void;
  selectAllOrgs: () => void;
  selectCurrentOrgOnly: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

function getStoredActiveOrgId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)active_org_id=([^;]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  try {
    const raw = localStorage.getItem('crm_active_organization');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.currentOrg?.id) {
        return parsed.state.currentOrg.id;
      }
    }
  } catch {}
  return null;
}

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
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);
  const [switchingOrgName, setSwitchingOrgName] = useState<string | null>(null);

  // Super Admin Multi-Organization Oversight
  const isSuper = isSuperAdmin(currentUser);

  const [selectedOrgIds, setSelectedOrgIdsState] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('crm_super_admin_selected_orgs');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const setSelectedOrgIds = useCallback((ids: string[]) => {
    setSelectedOrgIdsState(ids);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('crm_super_admin_selected_orgs', JSON.stringify(ids));
      } catch {}
    }
  }, []);

  const approvedMemberships = memberships.filter((m) => m.status === 'approved');

  // If Super Admin has no selection saved, auto-select all organizations
  useEffect(() => {
    if (isSuper && approvedMemberships.length > 0 && selectedOrgIds.length === 0) {
      setSelectedOrgIds(approvedMemberships.map((m) => m.organization.id));
    }
  }, [isSuper, approvedMemberships.length, selectedOrgIds.length, setSelectedOrgIds]);

  const effectiveOrgIds = isSuper
    ? selectedOrgIds.length > 0
      ? selectedOrgIds
      : currentOrg?.id
      ? [currentOrg.id]
      : []
    : currentOrg?.id
    ? [currentOrg.id]
    : [];

  const isAllOrgsSelected = isSuper && approvedMemberships.length > 0 && selectedOrgIds.length === approvedMemberships.length;
  const isMultiOrgActive = isSuper && (selectedOrgIds.length > 1 || (selectedOrgIds.length === 1 && selectedOrgIds[0] !== currentOrg?.id));

  const toggleOrgSelection = useCallback((orgId: string) => {
    setSelectedOrgIdsState((prev) => {
      let next: string[];
      if (prev.includes(orgId)) {
        if (prev.length === 1) return prev;
        next = prev.filter((id) => id !== orgId);
      } else {
        next = [...prev, orgId];
      }
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('crm_super_admin_selected_orgs', JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  }, []);

  const selectAllOrgs = useCallback(() => {
    const allIds = approvedMemberships.map((m) => m.organization.id);
    setSelectedOrgIds(allIds);
  }, [approvedMemberships, setSelectedOrgIds]);

  const selectCurrentOrgOnly = useCallback(() => {
    if (currentOrg?.id) {
      setSelectedOrgIds([currentOrg.id]);
    }
  }, [currentOrg?.id, setSelectedOrgIds]);

  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = React.useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const refreshWorkspace = useCallback(async (silent: boolean = false, preferredOrgId?: string) => {
    try {
      const user = await CRMService.getActiveUser();
      setCurrentUser(user);

      if (!user) {
        reset();
        const currentPath = pathnameRef.current;
        if (
          !currentPath.startsWith('/auth') &&
          currentPath !== '/login' &&
          currentPath !== '/register' &&
          !currentPath.startsWith('/invite') &&
          currentPath !== '/' &&
          !currentPath.startsWith('/onboarding')
        ) {
          router.push('/onboarding');
        }
        setIsLoading(false);
        return;
      }

      const userMemberships = await CRMService.getUserOrganizations(user.id);
      setMemberships(userMemberships);

      const approvedMemberships = userMemberships.filter((m) => m.status === 'approved');

      // Preserve the user's currently chosen organization strictly!
      // Check: 1) preferredOrgId, 2) Zustand store currentOrg, 3) cookie active_org_id, 4) localStorage
      const activeOrg = useOrganizationStore.getState().currentOrg;
      const storedOrgId = activeOrg?.id || getStoredActiveOrgId();
      const targetId = preferredOrgId || storedOrgId;

      let targetMembership = targetId
        ? approvedMemberships.find((m) => m.organization.id === targetId)
        : null;

      // If the current organization is pending, keep it without auto-switching away!
      if (!targetMembership && targetId) {
        const pending = userMemberships.find((m) => m.organization.id === targetId);
        if (pending) {
          targetMembership = pending;
        }
      }

      // ONLY if there is NO active organization recorded anywhere (e.g. brand new user login),
      // pick the first available organization
      if (!targetMembership && !targetId && approvedMemberships.length > 0) {
        targetMembership = approvedMemberships[0];
      }

      if (targetMembership) {
        const storeOrg = useOrganizationStore.getState().currentOrg;
        const storeRole = useOrganizationStore.getState().currentRole;
        const storeStatus = useOrganizationStore.getState().currentStatus;

        // CRUCIAL: Only update if organization details, role, or status have actually changed
        // Never trigger an organization change or re-render if the user is already in this org!
        const hasChanged =
          !storeOrg ||
          storeOrg.id !== targetMembership.organization.id ||
          storeRole !== targetMembership.role ||
          storeStatus !== targetMembership.status ||
          storeOrg.name !== targetMembership.organization.name ||
          storeOrg.logo_url !== targetMembership.organization.logo_url;

        if (hasChanged) {
          setCurrentOrg(targetMembership.organization, targetMembership.role, targetMembership.status);
        }
      } else if (userMemberships.length === 0) {
        const currentPath = pathnameRef.current;
        if (
          currentPath !== '/' &&
          !currentPath.startsWith('/onboarding') &&
          !currentPath.startsWith('/auth') &&
          !currentPath.startsWith('/invite')
        ) {
          router.push('/onboarding');
        }
      }
    } catch (err) {
      console.error('Failed to initialize workspace:', err);
    } finally {
      setIsLoading(false);
    }
  }, [router, setCurrentOrg, setMemberships, reset]);

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

    setIsSwitchingOrg(true);
    setSwitchingOrgName(membership.organization.name);

    // Invalidate CRM cache so the dashboard and modules load exclusively fresh data for the new organization
    invalidateCRMCache();

    // Instant switch in Zustand store & cookie
    setCurrentOrg(membership.organization, membership.role, membership.status);

    // Land on the dashboard of the newly chosen organization
    router.push('/dashboard');

    setTimeout(() => {
      setIsSwitchingOrg(false);
      setSwitchingOrgName(null);
    }, 400);
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
        isSwitchingOrg,
        switchingOrgName,
        setCurrentOrg,
        switchOrganization,
        refreshWorkspace,
        signOut,
        // Super Admin Multi-Org Oversight
        isSuperAdmin: isSuper,
        selectedOrgIds,
        effectiveOrgIds,
        isAllOrgsSelected,
        isMultiOrgActive,
        setSelectedOrgIds,
        toggleOrgSelection,
        selectAllOrgs,
        selectCurrentOrgOnly,
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
