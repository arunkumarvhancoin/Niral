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
  Link2,
  Eye,
  ExternalLink,
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
  const [addToCrmApp, setAddToCrmApp] = useState(true);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  // Shareable link state when a user is invited
  const [createdShareLink, setCreatedShareLink] = useState<{
    link: string;
    email: string;
    role: MemberRole;
    addedDirectly: boolean;
    orgName: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [inspectingInvite, setInspectingInvite] = useState<OrganizationInvitation | null>(null);

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

      const targetOrgIds = effectiveOrgIds.length > 0 ? effectiveOrgIds : (currentOrg ? [currentOrg.id] : []);
      const invList = await CRMService.getOrganizationInvitations(targetOrgIds, isSuper);
      setInvitations(invList);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [orgIdsKey, currentOrg?.id, effectiveOrgIds, isSuper]);

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
      
      const targetOrg = memberships.find((m) => m.organization.id === targetOrgId)?.organization || currentOrg;
      const orgName = targetOrg?.name || 'Workspace';
      const mode = res.addedDirectly ? 'signin' : 'signup';
      const link = `${window.location.origin}/onboarding?mode=${mode}&email=${encodeURIComponent(inviteEmail.trim())}`;

      setCreatedShareLink({
        link,
        email: inviteEmail.trim(),
        role: inviteRole,
        addedDirectly: res.addedDirectly,
        orgName,
      });

      if (res.addedDirectly) {
        toast.success(`${inviteEmail} was added as ${inviteRole}!`);
      } else {
        toast.success(`Invitation created for ${inviteEmail}!`);
      }

      await loadTeamData();
      await refreshWorkspace(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleCopyShareLink = (url: string, id?: string) => {
    navigator.clipboard.writeText(url);
    if (id) {
      setCopiedRowId(id);
      setTimeout(() => setCopiedRowId(null), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
    toast.success('Link copied to clipboard!');
  };

  const handleCopyInviteMessage = (item: { link: string; email: string; role: string; orgName: string }) => {
    const message = `Hi! You've been invited to join the ${item.orgName} CRM application workspace as ${item.role}.\n\nAccess the CRM application here:\n${item.link}`;
    navigator.clipboard.writeText(message);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
    toast.success('Full invite message copied to clipboard!');
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
                    <th className="py-2.5 px-4">Workspace</th>
                    <th className="py-2.5 px-4">Assigned Role</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Invitation Link</th>
                    <th className="py-2.5 px-4">Added On</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EAF0]">
                  {invitations.map((inv) => {
                    const inviteUrl = `${window.location.origin}/onboarding?mode=signup&email=${encodeURIComponent(inv.email)}`;
                    return (
                      <tr key={inv.id} className="hover:bg-[#F7F8FA] transition-colors">
                        <td className="py-3 px-4 font-medium text-[#171B26]">
                          <button
                            type="button"
                            onClick={() => setInspectingInvite(inv)}
                            className="text-[#171B26] hover:text-[#3659C9] font-medium text-left transition-colors cursor-pointer"
                            title="Click to view full invitation link"
                          >
                            {inv.email}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-xs text-[#697386]">
                          {inv.organization?.name || currentOrg?.name || 'CRM Workspace'}
                        </td>
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
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setInspectingInvite(inv)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#F1F3F7] hover:bg-blue-50 text-slate-700 hover:text-[#3659C9] border border-[#E7EAF0] text-xs font-mono transition-colors group cursor-pointer"
                            title="Click to view and resend joining link"
                          >
                            <Link2 className="w-3 h-3 text-[#3659C9]" />
                            <span className="truncate max-w-[130px] sm:max-w-[180px]">
                              {`/onboarding?email=${inv.email}`}
                            </span>
                            <ExternalLink className="w-2.5 h-2.5 text-[#9AA2B1] group-hover:text-[#3659C9]" />
                          </button>
                        </td>
                        <td className="py-3 px-4 text-[#697386] text-[12px] tabular-nums">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setInspectingInvite(inv)}
                              className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#3659C9] hover:text-[#2B47A1] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
                              title="Show invitation link and message"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Link</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyShareLink(inviteUrl, inv.id)}
                              className="inline-flex items-center space-x-1 text-[11px] font-semibold text-slate-700 hover:text-black bg-slate-100 hover:bg-slate-200 border border-[#BAC0CE] px-2 py-1 rounded-md transition-colors cursor-pointer"
                              title="Quick copy invitation link"
                            >
                              {copiedRowId === inv.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleRevokeInvitation(inv.id)}
                              className="text-[12px] text-[#B91C1C] hover:text-[#991B1B] font-medium px-1 py-0.5 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Modal: Add Member & Shareable Invite Link */}
        {isInviteOpen && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-center justify-between flex-shrink-0 bg-[#F8FAFC]">
                <div>
                  <h3 className="font-semibold text-[#171B26] text-sm">
                    {createdShareLink ? 'Invitation Link Ready' : 'Add Team Member'}
                  </h3>
                  <p className="text-[12px] text-[#697386] mt-0.5">
                    {createdShareLink ? 'Share with user to sign in or create account' : `Attach a colleague to ${currentOrg?.name}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsInviteOpen(false);
                    setCreatedShareLink(null);
                  }}
                  className="text-[#697386] hover:text-[#171B26] p-1 rounded-md hover:bg-[#F1F3F7] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createdShareLink ? (
                <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                    <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>
                        {createdShareLink.addedDirectly
                          ? `${createdShareLink.email} added to ${createdShareLink.orgName}!`
                          : `Invitation created for ${createdShareLink.email}!`}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      {createdShareLink.addedDirectly
                        ? `An account already exists for ${createdShareLink.email}. Share this direct link so they can sign in and access the workspace.`
                        : `Share this direct link with ${createdShareLink.email} to sign up and join ${createdShareLink.orgName} as ${createdShareLink.role}.`}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#171B26]">
                      Direct Shareable Link
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={createdShareLink.link}
                        className="flex-1 text-xs bg-slate-50 border border-[#BAC0CE] px-3 py-2 rounded-lg text-slate-800 font-mono select-all focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyShareLink(createdShareLink.link)}
                        className="px-3.5 py-2 bg-[#3659C9] hover:bg-[#2B47A1] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer flex-shrink-0 shadow-xs"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-[#F7F8FA] border border-[#E7EAF0] rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#697386] uppercase tracking-wider">
                        Ready-to-send Message
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyInviteMessage(createdShareLink)}
                        className="text-xs text-[#3659C9] hover:underline font-medium inline-flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedMessage ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedMessage ? 'Copied' : 'Copy message'}</span>
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-700 font-mono whitespace-pre-wrap bg-white p-2.5 rounded-lg border border-[#E7EAF0]">
                      {`Hi! You've been invited to join the ${createdShareLink.orgName} CRM application workspace as ${createdShareLink.role}.\n\nAccess the CRM application here:\n${createdShareLink.link}`}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[#E7EAF0]">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatedShareLink(null);
                        setInviteEmail('');
                      }}
                      className="text-xs font-medium text-[#3659C9] hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Another Member</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsInviteOpen(false);
                        setCreatedShareLink(null);
                        setInviteEmail('');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#171B26] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddMember} className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar">
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
                        A direct link will be generated after clicking Add to easily share with them to sign in or sign up.
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

                    <div>
                      <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                        Application Access
                      </label>
                      <div className="p-3 bg-[#F8FAFC] border border-[#E7EAF0] rounded-lg">
                        <label className="flex items-start space-x-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addToCrmApp}
                            onChange={(e) => setAddToCrmApp(e.target.checked)}
                            className="w-4 h-4 rounded text-[#3659C9] focus:ring-[#3659C9] border-[#BAC0CE] mt-0.5 accent-[#3659C9]"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-[#171B26] block">
                              Add to CRM Application
                            </span>
                            <span className="text-[#697386] text-[11px] leading-relaxed">
                              Member will be added directly to the CRM workspace to manage leads, contacts, deals, tasks, and sales pipelines.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-[#E7EAF0] bg-slate-50 flex items-center justify-end space-x-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsInviteOpen(false);
                        setCreatedShareLink(null);
                      }}
                      className="px-3.5 py-2 text-[13px] font-medium text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingInvite}
                      className="px-4 py-2 text-[13px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSubmittingInvite ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating Link...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add & Generate Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
        {/* Modal: View & Resend Invitation Link */}
        {inspectingInvite && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-center justify-between flex-shrink-0 bg-[#F8FAFC]">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#3659C9] flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#171B26] text-sm">Invitation Link Details</h3>
                    <p className="text-[12px] text-[#697386]">Pending Sign-up for {inspectingInvite.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setInspectingInvite(null)}
                  className="text-[#697386] hover:text-[#171B26] p-1 rounded-md hover:bg-[#F1F3F7] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-2 text-amber-900 font-semibold text-xs">
                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Awaiting User Registration</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    This user has not registered yet. Share this direct link so they can sign up with this email and automatically enter the CRM application.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-[#F8FAFC] border border-[#E7EAF0] rounded-xl text-xs">
                  <div>
                    <span className="text-[11px] text-[#697386] block">Invitee Email</span>
                    <span className="font-semibold text-[#171B26] truncate block">{inspectingInvite.email}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#697386] block">Target Workspace</span>
                    <span className="font-semibold text-[#171B26] truncate block">
                      {inspectingInvite.organization?.name || currentOrg?.name || 'CRM Workspace'}
                    </span>
                  </div>
                </div>

                {/* Direct Link Box */}
                {(() => {
                  const shareUrl = `${window.location.origin}/onboarding?mode=signup&email=${encodeURIComponent(inspectingInvite.email)}`;
                  const orgName = inspectingInvite.organization?.name || currentOrg?.name || 'Workspace';
                  const readyMessage = `Hi! You've been invited to join the ${orgName} CRM application workspace as ${inspectingInvite.role}.\n\nAccess the CRM application here:\n${shareUrl}`;

                  return (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[#171B26]">
                          Direct Invitation & Sign-up Link
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            className="flex-1 text-xs bg-slate-50 border border-[#BAC0CE] px-3 py-2 rounded-lg text-slate-800 font-mono select-all focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopyShareLink(shareUrl)}
                            className="px-3.5 py-2 bg-[#3659C9] hover:bg-[#2B47A1] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer flex-shrink-0 shadow-xs"
                          >
                            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-[#F7F8FA] border border-[#E7EAF0] rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#697386] uppercase tracking-wider">
                            Ready-to-send Message
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(readyMessage);
                              setCopiedMessage(true);
                              setTimeout(() => setCopiedMessage(false), 2000);
                              toast.success('Full invite message copied!');
                            }}
                            className="text-xs text-[#3659C9] hover:underline font-medium inline-flex items-center space-x-1 cursor-pointer"
                          >
                            {copiedMessage ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedMessage ? 'Copied' : 'Copy message'}</span>
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-700 font-mono whitespace-pre-wrap bg-white p-2.5 rounded-lg border border-[#E7EAF0]">
                          {readyMessage}
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div className="pt-2 flex items-center justify-between border-t border-[#E7EAF0]">
                  <button
                    type="button"
                    onClick={() => {
                      const idToRevoke = inspectingInvite.id;
                      setInspectingInvite(null);
                      handleRevokeInvitation(idToRevoke);
                    }}
                    className="text-xs font-medium text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                  >
                    Remove Invitation
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectingInvite(null)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#171B26] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
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

