'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import {
  OrganizationMember,
  OrganizationInvitation,
  OrganizationJoinRequest,
  MemberRole,
  MemberStatus,
} from '../../lib/types/crm';
import { hasPermission, isOrgAdmin } from '../../lib/permissions';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Send,
  X,
  LogOut,
  Loader2,
  Building,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TeamPage() {
  const {
    currentOrg,
    currentRole,
    currentStatus,
    currentUser,
    refreshWorkspace,
    effectiveOrgIds,
    isSuperAdmin: isSuper,
    isMultiOrgActive,
    memberships,
  } = useWorkspace();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [isLoading, setIsLoading] = useState(true);

  // Invite Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('Employee');
  const [inviteOrgId, setInviteOrgId] = useState<string>('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  const router = useRouter();

  const isAuthorized = isSuper || currentRole === 'Owner' || currentRole === 'Admin' || currentRole === 'Manager';
  const canManageMembers = isSuper || hasPermission(currentRole, currentStatus, 'members:manage_roles', currentUser);
  const canInvite = isSuper || hasPermission(currentRole, currentStatus, 'members:invite', currentUser);

  const orgIdsKey = effectiveOrgIds.join(',');

  const loadTeamData = useCallback(async () => {
    if (effectiveOrgIds.length === 0) return;
    setIsLoading(true);
    try {
      const memberList = await CRMService.getOrganizationMembers(effectiveOrgIds);
      setMembers(memberList);

      const targetOrg = currentOrg?.id || effectiveOrgIds[0];
      const invList = await CRMService.getOrganizationInvitations(targetOrg);
      setInvitations(invList);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [orgIdsKey, currentOrg?.id]);

  useEffect(() => {
    if (!isLoading && currentRole && !isAuthorized) {
      router.replace('/dashboard');
    }
  }, [currentRole, isLoading, isAuthorized, router]);

  useEffect(() => {
    if (effectiveOrgIds.length > 0 && isAuthorized) {
      loadTeamData();
    }
  }, [orgIdsKey, isAuthorized, loadTeamData]);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'primary';
    action?: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const handleRoleChange = async (memberId: string, memberOrgId: string | undefined, newRole: MemberRole) => {
    const orgId = memberOrgId || currentOrg?.id;
    if (!orgId) return;
    try {
      await CRMService.updateMemberRole(orgId, memberId, newRole);
      toast.success('Member role updated!');
      await loadTeamData();
      await refreshWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member role');
    }
  };

  const handleStatusChange = async (memberId: string, memberOrgId: string | undefined, newStatus: MemberStatus) => {
    const orgId = memberOrgId || currentOrg?.id;
    if (!orgId) return;
    try {
      await CRMService.updateMemberStatus(orgId, memberId, newStatus);
      toast.success(`Member status updated to ${newStatus}`);
      await loadTeamData();
      await refreshWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member status');
    }
  };

  const handleRemoveMember = (memberId: string, memberOrgId: string | undefined) => {
    const orgId = memberOrgId || currentOrg?.id;
    if (!orgId) return;
    setConfirmState({
      isOpen: true,
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the organization?',
      confirmText: 'Remove Member',
      variant: 'danger',
      action: async () => {
        // Optimistic UI update: instantly remove from state so user sees zero delay
        const prevMembers = members;
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        try {
          await CRMService.removeMember(orgId, memberId);
          toast.success('Member removed');
          await loadTeamData();
          await refreshWorkspace(true);
        } catch (err: any) {
          setMembers(prevMembers);
          toast.error(err.message || 'Failed to remove member');
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleLeaveOrganization = () => {
    if (!currentOrg || !currentUser) return;
    setConfirmState({
      isOpen: true,
      title: 'Leave Organization',
      message: `Are you sure you want to leave ${currentOrg.name}?`,
      confirmText: 'Leave',
      variant: 'danger',
      action: async () => {
        try {
          await CRMService.leaveOrganization(currentOrg.id, currentUser.id);
          toast.success(`Left ${currentOrg.name}`);
          await refreshWorkspace(true);
          router.push('/onboarding');
        } catch (err: any) {
          toast.error(err.message || 'Failed to leave organization');
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetOrgId = (isSuper && inviteOrgId) ? inviteOrgId : currentOrg?.id;
    if (!targetOrgId || !currentUser || !inviteEmail.trim() || isSubmittingInvite) return;
    setIsSubmittingInvite(true);
    try {
      const res = await CRMService.addMemberByEmail(targetOrgId, inviteEmail, inviteRole, currentUser.id);
      if (res.addedDirectly) {
        toast.success(`${inviteEmail} was added as ${inviteRole}!`);
      } else {
        toast.info(`${inviteEmail} invited. Will be active on their next sign-in.`);
      }
      setIsInviteOpen(false);
      setInviteEmail('');
      await loadTeamData();
      await refreshWorkspace(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleRevokeInvitation = (invitationId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Remove Pending Invitation',
      message: 'Remove this pending invite email?',
      confirmText: 'Remove',
      variant: 'danger',
      action: async () => {
        try {
          await CRMService.revokeInvitation(invitationId);
          toast.success('Invitation removed');
          await loadTeamData();
        } catch (err: any) {
          toast.error(err.message || 'Failed to remove');
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  if (!isAuthorized) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <p className="text-sm font-semibold text-slate-700">Access Restricted</p>
          <p className="text-xs text-slate-500 mt-1">The Team page is only accessible to Administrators and Managers.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#171B26]">Team</h1>
            <p className="text-[13px] text-[#697386] mt-0.5">
              Members and assigned roles for {currentOrg?.name}.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleLeaveOrganization}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md border border-[#E7EAF0] bg-white hover:bg-[#F1F3F7] text-[#171B26] text-[13px] font-medium shadow-xs transition-colors"
              title="Leave this organization"
            >
              <LogOut className="w-3.5 h-3.5 text-[#697386]" />
              <span>Leave Workspace</span>
            </button>
            {canInvite && (
              <button
                onClick={() => {
                  setInviteEmail('');
                  setInviteOrgId(currentOrg?.id || effectiveOrgIds[0] || '');
                  setIsInviteOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#3659C9] hover:bg-[#2B47A1] text-white text-[13px] font-medium shadow-xs transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Member</span>
              </button>
            )}
          </div>
        </div>

        {/* Team Onboarding Banner */}
        <div className="bg-white border border-[#E7EAF0] rounded-lg p-3.5 flex items-start space-x-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="w-7 h-7 rounded-md bg-[#F0F4FE] text-[#3659C9] flex items-center justify-center flex-shrink-0 mt-0.5">
            <UserPlus className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <h3 className="text-[12px] font-semibold text-[#171B26] uppercase tracking-wider">Zero-Friction Team Onboarding</h3>
            <p className="text-[12px] text-[#697386] mt-0.5 leading-relaxed">
              Add colleagues by typing their email. Active users gain immediate access, while new users are pre-attached and automatically see {currentOrg?.name || 'this workspace'} upon sign-up.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[#E7EAF0]">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab('members')}
              className={`py-2.5 px-1 border-b-2 text-[13px] font-medium transition-colors flex items-center space-x-2 ${activeTab === 'members'
                  ? 'border-[#3659C9] text-[#3659C9] font-semibold'
                  : 'border-transparent text-[#697386] hover:text-[#171B26]'
                }`}
            >
              <Users className="w-4 h-4" />
              <span>Active Members ({members.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('invitations')}
              className={`py-2.5 px-1 border-b-2 text-[13px] font-medium transition-colors flex items-center space-x-2 ${activeTab === 'invitations'
                  ? 'border-[#3659C9] text-[#3659C9] font-semibold'
                  : 'border-transparent text-[#697386] hover:text-[#171B26]'
                }`}
            >
              <Mail className="w-4 h-4" />
              <span>Pending Sign-ups ({invitations.length})</span>
            </button>
          </nav>
        </div>

        {/* TAB 1: MEMBERS */}
        {activeTab === 'members' && (
          <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#F7F8FA] border-b border-[#E7EAF0] text-[#697386] font-medium uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Member Name & Account</th>
                  {(isSuper || isMultiOrgActive || effectiveOrgIds.length > 1) && (
                    <th className="py-2.5 px-4">Organization</th>
                  )}
                  <th className="py-2.5 px-4">Organization Role</th>
                  <th className="py-2.5 px-4">Membership Status</th>
                  <th className="py-2.5 px-4">Joined Date</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EAF0]">
                {members.map((member) => {
                  const isSelf = member.user_id === currentUser?.id;
                  const memberOrgId = member.organization_id || currentOrg?.id;
                  return (
                    <tr key={member.id} className="hover:bg-[#F7F8FA] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-[#F1F3F7] border border-[#E7EAF0] flex items-center justify-center font-medium text-[#171B26] overflow-hidden text-xs">
                            {member.user?.avatar_url ? (
                              <img src={member.user.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              member.user?.full_name?.charAt(0) || 'U'
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-[#171B26] flex items-center space-x-1.5">
                              <span>{member.user?.full_name || 'Member'}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-[#F1F3F7] text-[#697386] px-1.5 py-0.2 rounded border border-[#E7EAF0]">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[12px] text-[#697386]">{member.user?.email}</div>
                          </div>
                        </div>
                      </td>

                      {(isSuper || isMultiOrgActive || effectiveOrgIds.length > 1) && (
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1.5 text-[12px] text-[#171B26] font-medium">
                            <Building className="w-3.5 h-3.5 text-[#9AA2B1]" />
                            <span className="truncate max-w-[150px]">
                              {member.organization?.name || '—'}
                            </span>
                          </div>
                        </td>
                      )}

                      <td className="py-3 px-4">
                        {canManageMembers && !isSelf ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, memberOrgId, e.target.value as MemberRole)}
                            className="text-[12px] rounded-md border border-[#E7EAF0] bg-white py-1 px-2.5 font-medium text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] shadow-2xs"
                          >
                            <option value="Owner">Owner</option>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="Employee">Employee</option>
                            <option value="Viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            member.role === 'Owner'
                              ? 'bg-[#F5F3FF] text-[#5B21B6] border-[#5B21B6]/20'
                              : member.role === 'Admin'
                              ? 'bg-[#F0F4FE] text-[#3659C9] border-[#3659C9]/20'
                              : member.role === 'Manager'
                              ? 'bg-[#FFFBEB] text-[#B45309] border-[#B45309]/20'
                              : member.role === 'Employee'
                              ? 'bg-[#ECFDF5] text-[#047857] border-[#047857]/20'
                              : 'bg-[#F1F3F7] text-[#697386] border-[#E7EAF0]'
                          }`}>
                            {member.role}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${member.status === 'approved'
                            ? 'bg-[#ECFDF5] text-[#047857] border border-[#047857]/20'
                            : member.status === 'pending'
                              ? 'bg-[#FFFBEB] text-[#B45309] border border-[#B45309]/20'
                              : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#B91C1C]/20'
                          }`}>
                          {member.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#697386] text-[12px] tabular-nums">
                        {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : 'Pending'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {canManageMembers && !isSelf && (
                          <div className="flex items-center justify-end space-x-2">
                            {member.status === 'approved' ? (
                              <button
                                onClick={() => handleStatusChange(member.id, memberOrgId, 'suspended')}
                                className="text-[12px] text-[#B45309] hover:text-[#92400E] font-medium hover:underline"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(member.id, memberOrgId, 'approved')}
                                className="text-[12px] text-[#047857] hover:text-[#065F46] font-medium hover:underline"
                              >
                                Re-activate
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveMember(member.id, memberOrgId)}
                              className="text-[#697386] hover:text-[#B91C1C] p-1 rounded hover:bg-[#FEF2F2] transition-colors"
                              title="Remove member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: PENDING SIGN-UPS */}
        {activeTab === 'invitations' && (
          <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
            {invitations.length === 0 ? (
              <div className="py-12 text-center">
                <Mail className="w-8 h-8 text-[#9AA2B1] mx-auto mb-2" />
                <p className="text-[13px] font-medium text-[#171B26]">No pending sign-ups</p>
                <p className="text-[12px] text-[#697386] mt-1">
                  When you add colleagues who haven&apos;t signed up yet, they will appear here until they log in.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#F7F8FA] border-b border-[#E7EAF0] text-[#697386] font-medium uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Email</th>
                    <th className="py-2.5 px-4">Assigned Role</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Added On</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EAF0]">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#F7F8FA] transition-colors">
                      <td className="py-3 px-4 font-medium text-[#171B26]">{inv.email}</td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-[#171B26] bg-[#F1F3F7] px-2 py-0.5 rounded text-[11px] border border-[#E7EAF0]">
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFFBEB] text-[#B45309] border border-[#B45309]/20">
                          Auto-joins on sign-up / login
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#697386] text-[12px] tabular-nums">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="text-[12px] text-[#B91C1C] hover:text-[#991B1B] font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Modal: Add Member */}
        {isInviteOpen && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E7EAF0] max-w-md w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-[#E7EAF0] flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[#171B26] text-sm">Add Team Member</h3>
                  <p className="text-[12px] text-[#697386] mt-0.5">Attach a colleague to {currentOrg?.name}</p>
                </div>
                <button onClick={() => setIsInviteOpen(false)} className="text-[#697386] hover:text-[#171B26] p-1 rounded-md hover:bg-[#F1F3F7] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddMember} className="p-5 space-y-4">
                {isSuper && memberships.length > 0 && (
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                      Target Organization * <span className="text-[11px] text-[#5B21B6] font-normal">(Super Admin)</span>
                    </label>
                    <select
                      value={inviteOrgId || currentOrg?.id}
                      onChange={(e) => setInviteOrgId(e.target.value)}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    >
                      {memberships.map((m) => (
                        <option key={m.organization.id} value={m.organization.id}>
                          {m.organization.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="colleague@domain.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  />
                  <p className="text-[11px] text-[#697386] mt-1.5">
                    If they already have an account, they are added immediately. If not, this organization will be ready when they log in or sign up.
                  </p>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Assigned Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  >
                    <option value="Admin">Admin (Full CRM + Member management)</option>
                    <option value="Manager">Manager (Manage CRM records & assign tasks)</option>
                    <option value="Employee">Employee (Create & update permitted records)</option>
                    <option value="Viewer">Viewer (Read-only access)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-[#E7EAF0] flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="px-3.5 py-2 text-[13px] font-medium text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingInvite}
                    className="px-4 py-2 text-[13px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmittingInvite ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add to Workspace</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* In-UI Confirmation Dialog */}
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          variant={confirmState.variant}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </AppShell>
  );
}

