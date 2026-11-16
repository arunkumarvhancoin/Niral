'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { Lead } from '../../lib/types/crm';
import { hasPermission, isBharatPlay, isSuperAdmin } from '../../lib/permissions';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import {
  Target,
  Plus,
  Search,
  Filter,
  DollarSign,
  ArrowRightLeft,
  CheckCircle,
  X,
  Trash2,
  Edit,
  Mail,
  Building,
  AlertCircle,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Ticket,
  ChevronRight,
  Shield,
  Check,
  Layers,
  ChevronDown,
  CheckSquare,
  Phone,
  Eye,
  ExternalLink,
} from 'lucide-react';

export default function LeadsPage() {
  const {
    currentOrg,
    currentRole,
    currentStatus,
    currentUser,
    memberships,
    effectiveOrgIds: globalOrgIds,
    isSuperAdmin: isSuper,
    isAllOrgsSelected,
    isMultiOrgActive,
  } = useWorkspace();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Sync org filter if currentOrg changes
  useEffect(() => {
    if (!isSuper && currentOrg?.id) {
      setOrgFilter(currentOrg.id);
    }
  }, [currentOrg?.id, isSuper]);

  // Determine active query org IDs based on orgFilter
  const effectiveOrgIds =
    orgFilter !== 'all'
      ? [orgFilter]
      : globalOrgIds.length > 0
      ? globalOrgIds
      : currentOrg?.id
      ? [currentOrg.id]
      : [];

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({
    organization_id: currentOrg?.id || '',
    title: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    source: 'Website' as Lead['source'],
    status: 'New' as Lead['status'],
    priority: 'Medium' as Lead['priority'],
    value: 10000,
  });

  // Lead Details Pop-up state
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);

  // Task for Lead state
  const [taskLead, setTaskLead] = useState<Lead | null>(null);
  const [leadTaskTitle, setLeadTaskTitle] = useState('');
  const [leadTaskDueDate, setLeadTaskDueDate] = useState('');
  const [leadTaskPriority, setLeadTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isSavingLeadTask, setIsSavingLeadTask] = useState(false);

  const canCreate = isSuper || hasPermission(currentRole, currentStatus, 'crm:leads:create', currentUser);
  const canUpdate = isSuper || hasPermission(currentRole, currentStatus, 'crm:leads:update', currentUser);
  const canDelete = isSuper || hasPermission(currentRole, currentStatus, 'crm:leads:delete', currentUser);

  const orgIdsKey = effectiveOrgIds.join(',');

  const loadLeads = useCallback(async () => {
    if (effectiveOrgIds.length === 0) {
      setLeads([]);
      setIsLoading(false);
      return;
    }
    if (leads.length === 0) {
      setIsLoading(true);
    }
    try {
      const data = await CRMService.getLeads(effectiveOrgIds, search, statusFilter);
      setLeads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [orgIdsKey, search, statusFilter, leads.length]);

  useEffect(() => {
    if (effectiveOrgIds.length > 0) {
      loadLeads();
    }
  }, [orgIdsKey, loadLeads]);

  const handleOpenCreate = () => {
    setEditingLead(null);
    setFormData({
      organization_id: currentOrg?.id || effectiveOrgIds[0] || (memberships[0]?.organization.id ?? ''),
      title: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company: '',
      source: 'Website',
      status: 'New',
      priority: 'Medium',
      value: 15000,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      organization_id: lead.organization_id,
      title: lead.title,
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      source: lead.source,
      status: lead.status,
      priority: lead.priority,
      value: lead.value,
    });
    setIsModalOpen(true);
  };

  const handleOpenTaskForLead = (lead: Lead) => {
    setTaskLead(lead);
    const contactName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
    setLeadTaskTitle(`Follow up with ${contactName || lead.title}`);
    setLeadTaskDueDate(new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]);
    setLeadTaskPriority(lead.priority === 'Urgent' ? 'urgent' : lead.priority === 'High' ? 'high' : 'medium');
  };

  const handleCreateLeadTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskLead || !currentUser) return;
    const targetOrgId = taskLead.organization_id || currentOrg?.id;
    if (!targetOrgId) return;

    setIsSavingLeadTask(true);
    try {
      await CRMService.createTask(
        targetOrgId,
        {
          title: leadTaskTitle.trim(),
          due_date: leadTaskDueDate ? new Date(leadTaskDueDate).toISOString() : null,
          priority: leadTaskPriority,
          status: 'todo',
          assigned_to: currentUser.id,
          related_type: 'lead',
          related_id: taskLead.id,
        },
        currentUser.id
      );
      toast.success('Task created and connected to lead!');
      setTaskLead(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    } finally {
      setIsSavingLeadTask(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetOrgId = editingLead?.organization_id || formData.organization_id || currentOrg?.id;
    if (!targetOrgId || !currentUser) return;
    try {
      if (editingLead) {
        await CRMService.updateLead(editingLead.id, targetOrgId, formData);
        toast.success(`Lead "${formData.title}" updated successfully!`);
      } else {
        await CRMService.createLead(targetOrgId, formData, currentUser.id);
        toast.success(`Lead "${formData.title || formData.first_name}" created successfully!`);
      }
      setIsModalOpen(false);
      await loadLeads();
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while saving lead');
    }
  };

  const handleConvert = (lead: Lead) => {
    const orgId = lead.organization_id || currentOrg?.id;
    if (!orgId || !currentUser) return;
    setConfirmState({
      isOpen: true,
      title: 'Convert Lead',
      message: 'Are you sure you want to convert this lead into an active customer contact and pipeline deal?',
      confirmText: 'Convert Lead',
      variant: 'primary',
      action: async () => {
        try {
          await CRMService.convertLead(lead.id, orgId, currentUser.id);
          toast.success('Lead converted to contact and deal!');
          await loadLeads();
        } catch (err: any) {
          toast.error(err.message || 'Conversion failed');
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDelete = (lead: Lead) => {
    const orgId = lead.organization_id || currentOrg?.id;
    if (!orgId) return;
    setConfirmState({
      isOpen: true,
      title: 'Delete Lead',
      message: 'Are you sure you want to permanently delete this lead? This cannot be undone.',
      confirmText: 'Delete Lead',
      variant: 'danger',
      action: async () => {
        try {
          await CRMService.deleteLead(lead.id, orgId);
          toast.success('Lead deleted successfully');
          await loadLeads();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete lead');
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Dedicated Bharat Play check
  const hasBPSelected = isSuper
    ? effectiveOrgIds.some((id) => {
        const org = memberships.find((m) => m.organization.id === id)?.organization;
        return isBharatPlay(org);
      })
    : isBharatPlay(currentOrg);

  const isBharatPlayRegistration = (lead: Lead) => {
    const leadOrg = lead.organization || memberships.find((m) => m.organization.id === lead.organization_id)?.organization;
    const isLeadBP = isBharatPlay(leadOrg);
    return isLeadBP && (
      lead.company === 'Bharat Play' ||
      lead.source === 'Event' ||
      lead.title?.toLowerCase().startsWith('bharat play:')
    );
  };

  const displayLeads = leads
    .filter((l) => !isBharatPlayRegistration(l))
    .filter((l) => (orgFilter === 'all' ? true : l.organization_id === orgFilter));
  const bharatPlayCount = hasBPSelected ? leads.filter(isBharatPlayRegistration).length : 0;

  const newLeadsCount = displayLeads.filter((l) => l.status === 'New').length;
  const qualifiedCount = displayLeads.filter((l) => l.status === 'Qualified').length;
  const convertedCount = displayLeads.filter((l) => l.status === 'Converted').length;
  const highPriorityCount = displayLeads.filter((l) => l.priority === 'High' || l.priority === 'Urgent').length;

  // Show organization column whenever Super Admin is viewing or multiple orgs are loaded
  const showOrgColumn = isSuper || effectiveOrgIds.length > 1 || memberships.length > 1;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Dedicated Bharat Play Navigation Banner */}
        {hasBPSelected && bharatPlayCount > 0 && (
          <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/70 rounded-xl p-3 sm:px-4 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center flex-shrink-0">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-blue-950">
                  {bharatPlayCount} Bharat Play Workshop {bharatPlayCount === 1 ? 'Registration' : 'Registrations'}
                </p>
                <p className="text-[12px] text-blue-700/90 mt-0.5">
                  Managed separately in the dedicated Bharat Play page with group size, time slots, and WhatsApp messaging.
                </p>
              </div>
            </div>
            <Link
              href="/registrations"
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              <span>View Registrations</span>
              <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Leads Pipeline</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {isSuper
                ? `Prospects, inbound inquiries, and qualification across ${
                    orgFilter !== 'all'
                      ? memberships.find((m) => m.organization.id === orgFilter)?.organization.name || 'selected organization'
                      : 'all organizations'
                  }.`
                : `Prospects, inbound inquiries, and qualification for ${currentOrg?.name}.`}
            </p>
          </div>
          {canCreate && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Capture Lead</span>
            </button>
          )}
        </div>

        {/* Leads KPI Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-blue-100/90 shadow-xs hover:border-blue-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Leads</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{displayLeads.length}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-100/90 shadow-xs hover:border-rose-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/70 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">High / Urgent</p>
              <p className="text-2xl font-bold text-rose-600 tabular-nums">{highPriorityCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-100/90 shadow-xs hover:border-purple-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 border border-purple-200/70 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Qualified Leads</p>
              <p className="text-2xl font-bold text-purple-700 tabular-nums">{qualifiedCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-100/90 shadow-xs hover:border-emerald-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/70 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Converted to Deal</p>
              <p className="text-2xl font-bold text-emerald-600 tabular-nums">{convertedCount}</p>
            </div>
          </div>
        </div>

        {/* Filters & Organization Filter Bar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search leads by title, company, contact..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              />
            </div>

            {/* Organization Dropdown Filter */}
            {(isSuper || memberships.length > 1) && (
              <div className="relative min-w-[200px]">
                <select
                  value={orgFilter}
                  onChange={(e) => setOrgFilter(e.target.value)}
                  className="w-full text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-800 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 cursor-pointer transition-colors"
                >
                  <option value="all">
                    {isSuper ? `All Organizations (${memberships.length})` : 'All My Organizations'}
                  </option>
                  {memberships.map((m) => (
                    <option key={m.organization.id} value={m.organization.id}>
                      {m.organization.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All', activeBg: 'bg-slate-900 text-white' },
              { id: 'New', label: 'New', activeBg: 'bg-blue-600 text-white' },
              { id: 'Contacted', label: 'Contacted', activeBg: 'bg-amber-600 text-white' },
              { id: 'Qualified', label: 'Qualified', activeBg: 'bg-purple-600 text-white' },
              { id: 'Converted', label: 'Converted', activeBg: 'bg-emerald-600 text-white' },
              { id: 'Lost', label: 'Lost', activeBg: 'bg-rose-600 text-white' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                  statusFilter === pill.id
                    ? `${pill.activeBg} shadow-xs`
                    : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  {showOrgColumn && <th className="py-3.5 px-4">Organization</th>}
                  <th className="py-3.5 px-4">Lead & Company</th>
                  <th className="py-3.5 px-4">Contact Person</th>
                  <th className="py-3.5 px-4">Estimated Value</th>
                  <th className="py-3.5 px-4">Status & Priority</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={showOrgColumn ? 6 : 5} className="py-12 text-center text-slate-400">
                      Loading leads...
                    </td>
                  </tr>
                ) : displayLeads.length === 0 ? (
                  <tr>
                    <td colSpan={showOrgColumn ? 6 : 5} className="py-12 text-center">
                      <Target className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                      <p className="text-base font-semibold text-slate-800">No leads found</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {orgFilter !== 'all'
                          ? 'No leads recorded for this organization.'
                          : 'Capture new leads to drive pipeline growth.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  displayLeads.map((lead) => {
                    const orgName =
                      lead.organization?.name ||
                      memberships.find((m) => m.organization.id === lead.organization_id)?.organization.name ||
                      'Organization';
                    const orgLogo = lead.organization?.logo_url;
                    const contactFullName =
                      lead.first_name || lead.last_name
                        ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                        : 'Direct Inbound';

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setViewingLead(lead)}
                        className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                      >
                        {/* Organization Name Column for Super Admin / Multi-Org View */}
                        {showOrgColumn && (
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-6 h-6 rounded-md bg-[#F1F3F7] border border-[#E7EAF0] flex items-center justify-center text-[#3659C9] text-xs font-bold overflow-hidden flex-shrink-0">
                                {orgLogo ? (
                                  <img src={orgLogo} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  orgName.charAt(0).toUpperCase()
                                )}
                              </div>
                              <span className="font-medium text-[#171B26] text-sm truncate max-w-[160px]">
                                {orgName}
                              </span>
                            </div>
                          </td>
                        )}

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#171B26] text-sm group-hover:text-[#3659C9] transition-colors flex items-center space-x-1.5">
                            <span>{lead.title}</span>
                            <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-[#3659C9]" />
                          </div>
                          <div className="text-xs text-[#697386] mt-0.5">
                            {lead.company || 'Private Entity'} • Captured {new Date(lead.created_at).toLocaleDateString()}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-[#171B26] font-medium text-sm">
                            {contactFullName}
                          </div>
                          <div className="text-xs text-[#697386] truncate max-w-[200px]">
                            {lead.email || lead.phone || 'No direct contact'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-[#171B26] text-sm tabular-nums">
                          ₹{Number(lead.value).toLocaleString('en-IN')}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${
                                lead.status === 'Converted'
                                  ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                                  : lead.status === 'Qualified'
                                  ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                                  : lead.status === 'Contacted'
                                  ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                                  : lead.status === 'Lost'
                                  ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                                  : 'bg-[#F5F3FF] text-[#5B21B6] border border-[#DDD6FE]'
                              }`}
                            >
                              {lead.status}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                lead.priority === 'Urgent'
                                  ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                                  : lead.priority === 'High'
                                  ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                                  : 'bg-[#F7F8FA] text-[#697386] border border-[#E7EAF0]'
                              }`}
                            >
                              {lead.priority}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1">
                            {lead.status !== 'Converted' && canUpdate && (
                              <button
                                onClick={() => handleConvert(lead)}
                                className="px-2.5 py-1 text-xs font-medium bg-[#ECFDF5] text-[#047857] hover:bg-[#D1FAE5] border border-[#A7F3D0] rounded-md flex items-center space-x-1 transition-colors"
                                title="Convert to Contact & Deal"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>Convert</span>
                              </button>
                            )}
                            {canUpdate && (
                              <button
                                onClick={() => handleOpenTaskForLead(lead)}
                                className="p-1.5 text-[#697386] hover:text-[#3659C9] rounded-md hover:bg-[#F0F4FE] transition-colors"
                                title="Add task for this lead"
                              >
                                <CheckSquare className="w-4 h-4" />
                              </button>
                            )}
                            {canUpdate && (
                              <button
                                onClick={() => handleOpenEdit(lead)}
                                className="p-1.5 text-[#697386] hover:text-[#171B26] rounded-md hover:bg-[#F1F3F7] transition-colors"
                                title="Edit Lead"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(lead)}
                                className="p-1.5 text-[#697386] hover:text-[#B91C1C] rounded-md hover:bg-[#FEF2F2] transition-colors"
                                title="Delete Lead"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-center justify-between flex-shrink-0 bg-[#F8FAFC]">
                <h3 className="font-semibold text-[#171B26] text-sm">
                  {editingLead ? 'Edit Lead' : 'Create New Lead'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#697386] hover:text-[#171B26] p-1 rounded-md hover:bg-[#F1F3F7] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar">
                {/* Organization Selector for Super Admin */}
                {isSuper && !editingLead && (
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                      Organization *
                    </label>
                    <select
                      value={formData.organization_id}
                      onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
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
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Lead Title / Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp Inbound"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Lead Contact First Name</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Last Name</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Company Name</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Est. Deal Value (₹)</label>
                    <input
                      type="number"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] tabular-nums focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Source</label>
                    <select
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    >
                      <option value="Website">Website</option>
                      <option value="Referral">Referral</option>
                      <option value="Outreach">Outreach</option>
                      <option value="Inbound">Inbound</option>
                      <option value="Event">Event</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Lost">Lost</option>
                      <option value="Converted">Converted</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[#E7EAF0] bg-slate-50 flex items-center justify-end space-x-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-[13px] font-medium text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[13px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-xs transition-colors"
                >
                  {editingLead ? 'Update Lead' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        {/* Quick Task for Lead Modal */}
        {taskLead && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-center justify-between flex-shrink-0 bg-[#F8FAFC]">
                <div>
                  <h3 className="font-semibold text-[#171B26] text-sm">Add Task for Lead</h3>
                  <p className="text-[12px] text-[#3659C9] font-medium mt-0.5 truncate max-w-[280px]">
                    {taskLead.title} {taskLead.company ? `(${taskLead.company})` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setTaskLead(null)}
                  className="text-[#697386] hover:text-[#171B26] p-1 rounded-md hover:bg-[#F1F3F7] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateLeadTask} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar">
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Task Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Call lead back to discuss pricing"
                      value={leadTaskTitle}
                      onChange={(e) => setLeadTaskTitle(e.target.value)}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9]"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Due Date</label>
                      <input
                        type="date"
                        value={leadTaskDueDate}
                        onChange={(e) => setLeadTaskDueDate(e.target.value)}
                        className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] tabular-nums focus:outline-none focus:border-[#3659C9]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Priority</label>
                      <select
                        value={leadTaskPriority}
                        onChange={(e) => setLeadTaskPriority(e.target.value as any)}
                        className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9]"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#E7EAF0] bg-slate-50 flex items-center justify-end space-x-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setTaskLead(null)}
                    className="px-3.5 py-2 text-[13px] font-medium text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingLeadTask || !leadTaskTitle.trim()}
                    className="px-4 py-2 text-[13px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isSavingLeadTask ? 'Adding...' : 'Connect & Add Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lead Details Pop-up Modal */}
        {viewingLead && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-start justify-between bg-[#F8FAFC] flex-shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#3659C9] border border-blue-200">
                      Lead Overview
                    </span>
                    {viewingLead.organization?.name && (
                      <span className="text-xs text-[#697386] font-medium">
                        • {viewingLead.organization.name}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[#171B26] leading-snug">
                    {viewingLead.title}
                  </h3>
                  <p className="text-xs text-[#697386]">
                    Captured on {new Date(viewingLead.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </p>
                </div>
                <button
                  onClick={() => setViewingLead(null)}
                  className="text-[#697386] hover:text-[#171B26] p-1.5 rounded-md hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 no-scrollbar">
                {/* Value & Status Grid */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-[#F8FAFC] rounded-lg border border-[#E7EAF0]">
                  <div>
                    <span className="text-xs font-medium text-[#697386] uppercase tracking-wider">Estimated Value</span>
                    <div className="text-xl font-bold text-[#171B26] tabular-nums mt-0.5">
                      ₹{Number(viewingLead.value).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[#697386] uppercase tracking-wider">Status & Priority</span>
                    <div className="flex items-center space-x-1.5 mt-1">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${
                          viewingLead.status === 'Converted'
                            ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                            : viewingLead.status === 'Qualified'
                            ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                            : viewingLead.status === 'Contacted'
                            ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                            : viewingLead.status === 'Lost'
                            ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                            : 'bg-[#F5F3FF] text-[#5B21B6] border border-[#DDD6FE]'
                        }`}
                      >
                        {viewingLead.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          viewingLead.priority === 'Urgent'
                            ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                            : viewingLead.priority === 'High'
                            ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                            : 'bg-[#F7F8FA] text-[#697386] border border-[#E7EAF0]'
                        }`}
                      >
                        {viewingLead.priority}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact & Company Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Contact Information
                  </h4>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-[#697386] font-medium">Contact Person:</span>
                      <span className="font-semibold text-[#171B26]">
                        {viewingLead.first_name || viewingLead.last_name
                          ? `${viewingLead.first_name || ''} ${viewingLead.last_name || ''}`.trim()
                          : 'Direct Inbound / Unassigned'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-[#697386] font-medium">Company / Organization:</span>
                      <span className="font-semibold text-[#171B26]">
                        {viewingLead.company || 'Private Entity'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-[#697386] font-medium">Email Address:</span>
                      {viewingLead.email ? (
                        <a
                          href={`mailto:${viewingLead.email}`}
                          className="font-medium text-[#3659C9] hover:underline flex items-center space-x-1"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{viewingLead.email}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">Not provided</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-[#697386] font-medium">Phone Number:</span>
                      {viewingLead.phone ? (
                        <a
                          href={`tel:${viewingLead.phone}`}
                          className="font-medium text-[#3659C9] hover:underline flex items-center space-x-1"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{viewingLead.phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">Not provided</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[#697386] font-medium">Acquisition Source:</span>
                      <span className="px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800">
                        {viewingLead.source}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer with Actions */}
              <div className="px-6 py-4 border-t border-[#E7EAF0] bg-slate-50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center space-x-2">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingLead;
                        setViewingLead(null);
                        handleDelete(target);
                      }}
                      className="px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                  {viewingLead.status !== 'Converted' && canUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingLead;
                        setViewingLead(null);
                        handleConvert(target);
                      }}
                      className="px-3 py-2 text-xs font-medium bg-[#ECFDF5] text-[#047857] hover:bg-[#D1FAE5] border border-[#A7F3D0] rounded-md transition-colors flex items-center space-x-1"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Convert</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingLead;
                        setViewingLead(null);
                        handleOpenTaskForLead(target);
                      }}
                      className="px-3.5 py-2 text-xs font-medium text-[#171B26] bg-white border border-[#E7EAF0] hover:bg-slate-100 rounded-md transition-colors flex items-center space-x-1.5 shadow-2xs"
                    >
                      <CheckSquare className="w-4 h-4 text-[#3659C9]" />
                      <span>Add Task</span>
                    </button>
                  )}
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingLead;
                        setViewingLead(null);
                        handleOpenEdit(target);
                      }}
                      className="px-4 py-2 text-xs font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md transition-colors flex items-center space-x-1.5 shadow-2xs"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Lead</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingLead(null)}
                    className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors"
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
          onConfirm={() => confirmState.action?.()}
          onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </AppShell>
  );
}

