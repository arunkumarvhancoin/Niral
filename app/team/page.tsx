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
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TeamPage() {
  const { currentOrg, currentRole, currentStatus, currentUser, refreshWorkspace } = useWorkspace();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [isLoading, setIsLoading] = useState(true);

  // Invite Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('Employee');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  const router = useRouter();

  const isAuthorized = currentRole === 'Owner' || currentRole === 'Admin' || currentRole === 'Manager';
  const canManageMembers = hasPermission(currentRole, currentStatus, 'members:manage_roles');
  const canInvite = hasPermission(currentRole, currentStatus, 'members:invite');

  const loadTeamData = useCallback(async () => {
    if (!currentOrg?.id) return;
    setIsLoading(true);
    try {
      const memberList = await CRMService.getOrganizationMembers(currentOrg.id);
      setMembers(memberList);

      const invList = await CRMService.getOrganizationInvitations(currentOrg.id);
      setInvitations(invList);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    if (!isLoading && currentRole && !isAuthorized) {
      router.replace('/dashboard');
    }
  }, [currentRole, isLoading, isAuthorized, router]);

  useEffect(() => {
    if (currentOrg?.id && isAuthorized) {
      loadTeamData();
    }
  }, [currentOrg?.id, isAuthorized, loadTeamData]);

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

  const handleRoleChange = async (memberId: string, newRole: MemberRole) => {
    if (!currentOrg) return;
    try {
      await CRMService.updateMemberRole(currentOrg.id, memberId, newRole);
      toast.success('Member role updated!');
      await loadTeamData();
      await refreshWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member role');
    }
  };

  const handleStatusChange = async (memberId: string, newStatus: MemberStatus) => {
    if (!currentOrg) return;
    try {
      await CRMService.updateMemberStatus(currentOrg.id, memberId, newStatus);
      toast.success(`Member status updated to ${newStatus}`);
      await loadTeamData();
      await refreshWorkspace();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member status');
    }
  };

  const handleRemoveMember = (memberId: string) => {
    if (!currentOrg) return;
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
          await CRMService.removeMember(currentOrg.id, memberId);
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
    if (!currentOrg || !currentUser || !inviteEmail.trim() || isSubmittingInvite) return;
    setIsSubmittingInvite(true);
    try {
      const res = await CRMService.addMemberByEmail(currentOrg.id, inviteEmail, inviteRole, currentUser.id);
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Members and assigned roles for {currentOrg?.name}.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleLeaveOrganization}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
              title="Leave this organization"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Leave Workspace</span>
            </button>
            {canInvite && (
              <button
                onClick={() => {
                  setInviteEmail('');
                  setIsInviteOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Member</span>
              </button>
            )}
          </div>
        </div>

        {/* Team Onboarding Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-4 flex items-start space-x-3.5 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <UserPlus className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">Zero-Friction Team Onboarding</h3>
            <p className="text-xs text-blue-800/90 mt-0.5 leading-relaxed">
              Add colleagues by typing their email. Active users gain immediate access, while new users are pre-attached and automatically see {currentOrg?.name || 'this workspace'} upon sign-up.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('members')}
              className={`py-3 px-1 border-b-2 text-xs font-semibold transition-colors flex items-center space-x-2 ${activeTab === 'members'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              <Users className="w-4 h-4" />
              <span>Active Members ({members.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('invitations')}
              className={`py-3 px-1 border-b-2 text-xs font-semibold transition-colors flex items-center space-x-2 ${activeTab === 'invitations'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              <Mail className="w-4 h-4" />
              <span>Pending Sign-ups ({invitations.length})</span>
            </button>
          </nav>
        </div>

        {/* TAB 1: MEMBERS */}
        {activeTab === 'members' && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Member Name & Account</th>
                  <th className="py-3 px-4">Organization Role</th>
                  <th className="py-3 px-4">Membership Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => {
                  const isSelf = member.user_id === currentUser?.id;
                  return (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-semibold text-slate-700 overflow-hidden">
                            {member.user?.avatar_url ? (
                              <img src={member.user.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              member.user?.full_name?.charAt(0) || 'U'
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                              <span>{member.user?.full_name || 'Member'}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-normal">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{member.user?.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {canManageMembers && !isSelf ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value as MemberRole)}
                            className="text-xs rounded-lg border border-slate-200 bg-white py-1 px-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-2xs"
                          >
                            <option value="Owner">Owner</option>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="Employee">Employee</option>
                            <option value="Viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            member.role === 'Owner'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : member.role === 'Admin'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : member.role === 'Manager'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : member.role === 'Employee'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {member.role}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${member.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : member.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                          {member.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : 'Pending'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {canManageMembers && !isSelf && (
                          <div className="flex items-center justify-end space-x-2">
                            {member.status === 'approved' ? (
                              <button
                                onClick={() => handleStatusChange(member.id, 'suspended')}
                                className="text-[11px] text-amber-600 hover:text-amber-800 hover:underline"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(member.id, 'approved')}
                                className="text-[11px] text-emerald-600 hover:text-emerald-800 hover:underline"
                              >
                                Re-activate
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded"
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
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            {invitations.length === 0 ? (
              <div className="py-12 text-center">
                <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No pending sign-ups</p>
                <p className="text-xs text-slate-400 mt-1">
                  When you add colleagues who haven&apos;t signed up yet, they will appear here until they log in.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Added On</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{inv.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Auto-joins on sign-up / login
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-medium"
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
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Add Team Member</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Attach a colleague to {currentOrg?.name}</p>
                </div>
                <button onClick={() => setIsInviteOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddMember} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="colleague@domain.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    If they already have an account, they are added immediately. If not, this organization will be ready when they log in or sign up.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="Admin">Admin (Full CRM + Member management)</option>
                    <option value="Manager">Manager (Manage CRM records & assign tasks)</option>
                    <option value="Employee">Employee (Create & update permitted records)</option>
                    <option value="Viewer">Viewer (Read-only access)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingInvite}
                    className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
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

