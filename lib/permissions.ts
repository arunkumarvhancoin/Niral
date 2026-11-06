import { MemberRole, MemberStatus } from './types/crm';

export type Permission =
  | 'org:delete'
  | 'org:settings:update'
  | 'org:billing:manage'
  | 'org:transfer_ownership'
  | 'members:view'
  | 'members:invite'
  | 'members:manage_roles'
  | 'members:remove'
  | 'join_requests:review'
  | 'crm:read'
  | 'crm:contacts:create'
  | 'crm:contacts:update'
  | 'crm:contacts:delete'
  | 'crm:leads:create'
  | 'crm:leads:update'
  | 'crm:leads:delete'
  | 'crm:deals:create'
  | 'crm:deals:update'
  | 'crm:deals:delete'
  | 'crm:tasks:create'
  | 'crm:tasks:update'
  | 'crm:tasks:delete'
  | 'crm:activities:create';

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  Owner: [
    'org:delete',
    'org:settings:update',
    'org:billing:manage',
    'org:transfer_ownership',
    'members:view',
    'members:invite',
    'members:manage_roles',
    'members:remove',
    'join_requests:review',
    'crm:read',
    'crm:contacts:create',
    'crm:contacts:update',
    'crm:contacts:delete',
    'crm:leads:create',
    'crm:leads:update',
    'crm:leads:delete',
    'crm:deals:create',
    'crm:deals:update',
    'crm:deals:delete',
    'crm:tasks:create',
    'crm:tasks:update',
    'crm:tasks:delete',
    'crm:activities:create',
  ],
  Admin: [
    'org:settings:update',
    'members:view',
    'members:invite',
    'members:manage_roles',
    'members:remove',
    'join_requests:review',
    'crm:read',
    'crm:contacts:create',
    'crm:contacts:update',
    'crm:contacts:delete',
    'crm:leads:create',
    'crm:leads:update',
    'crm:leads:delete',
    'crm:deals:create',
    'crm:deals:update',
    'crm:deals:delete',
    'crm:tasks:create',
    'crm:tasks:update',
    'crm:tasks:delete',
    'crm:activities:create',
  ],
  Manager: [
    'members:view',
    'members:invite',
    'crm:read',
    'crm:contacts:create',
    'crm:contacts:update',
    'crm:contacts:delete',
    'crm:leads:create',
    'crm:leads:update',
    'crm:leads:delete',
    'crm:deals:create',
    'crm:deals:update',
    'crm:deals:delete',
    'crm:tasks:create',
    'crm:tasks:update',
    'crm:tasks:delete',
    'crm:activities:create',
  ],
  Employee: [
    'members:view',
    'crm:read',
    'crm:contacts:create',
    'crm:contacts:update',
    'crm:leads:create',
    'crm:leads:update',
    'crm:deals:create',
    'crm:deals:update',
    'crm:tasks:create',
    'crm:tasks:update',
    'crm:activities:create',
  ],
  Viewer: [
    'members:view',
    'crm:read',
  ],
};

/**
 * Checks if a role and membership status has a specific permission.
 * Suspended, pending, rejected, or revoked members have NO permissions.
 */
export function hasPermission(
  role: MemberRole | null | undefined,
  status: MemberStatus | null | undefined,
  permission: Permission
): boolean {
  if (!role || status !== 'approved') {
    return false;
  }
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Checks if a member has any of the given roles with approved status.
 */
export function hasAnyRole(
  role: MemberRole | null | undefined,
  status: MemberStatus | null | undefined,
  allowedRoles: MemberRole[]
): boolean {
  if (!role || status !== 'approved') return false;
  return allowedRoles.includes(role);
}

/**
 * Checks if a user is an Owner or Admin
 */
export function isOrgAdmin(role: MemberRole | null | undefined, status: MemberStatus | null | undefined): boolean {
  return hasAnyRole(role, status, ['Owner', 'Admin']);
}

