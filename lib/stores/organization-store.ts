import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Organization, MemberRole, MemberStatus } from '../types/crm';

interface UserOrgMembership {
  organization: Organization;
  role: MemberRole;
  status: MemberStatus;
}

interface OrganizationState {
  currentOrg: Organization | null;
  currentRole: MemberRole | null;
  currentStatus: MemberStatus | null;
  memberships: UserOrgMembership[];
  isLoading: boolean;
  setCurrentOrg: (org: Organization, role: MemberRole, status: MemberStatus) => void;
  setMemberships: (memberships: UserOrgMembership[]) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      currentOrg: null,
      currentRole: null,
      currentStatus: null,
      memberships: [],
      isLoading: false,
      setCurrentOrg: (org, role, status) => {
        if (typeof document !== 'undefined') {
          document.cookie = `active_org_id=${org.id}; path=/; max-age=2592000; SameSite=Lax`;
        }
        set({
          currentOrg: org,
          currentRole: role,
          currentStatus: status,
        });
      },
      setMemberships: (memberships) => set({ memberships }),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'active_org_id=; path=/; max-age=0';
        }
        set({ currentOrg: null, currentRole: null, currentStatus: null, memberships: [] });
      },
    }),
    {
      name: 'crm_active_organization',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentOrg: state.currentOrg,
        currentRole: state.currentRole,
        currentStatus: state.currentStatus,
        memberships: state.memberships,
      }),
    }
  )
);

