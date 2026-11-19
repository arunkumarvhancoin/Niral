'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { Contact, Lead } from '../../lib/types/crm';
import { hasPermission } from '../../lib/permissions';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { TableSkeleton } from '../../components/ui/skeleton';
import {
  Users2,
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  Building,
  MoreVertical,
  Trash2,
  Edit,
  FileText,
  X,
  Check,
  Target,
  ArrowRight,
  Briefcase,
  ShieldCheck,
  UserCheck,
  CheckSquare,
  Eye,
} from 'lucide-react';
import Link from 'next/link';

export default function ContactsPage() {
  const {
    currentOrg,
    currentRole,
    currentStatus,
    currentUser,
    effectiveOrgIds: globalOrgIds,
    isSuperAdmin: isSuper,
    isAllOrgsSelected,
    isMultiOrgActive,
    memberships,
    isLoading: isWorkspaceLoading,
  } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Debounce search query to prevent hammering Supabase on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  // Sync org filter if currentOrg changes
  useEffect(() => {
    if (currentOrg?.id) {
      setOrgFilter(currentOrg.id);
    }
  }, [currentOrg?.id]);

  const effectiveOrgIds =
    orgFilter !== 'all'
      ? [orgFilter]
      : globalOrgIds.length > 0
      ? globalOrgIds
      : currentOrg?.id
      ? [currentOrg.id]
      : [];

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    organization_id: currentOrg?.id || '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    company_name: '',
    status: 'lead' as Contact['status'],
    notes: '',
    // Lead fields when status === 'lead'
    lead_value: 15000,
    lead_source: 'Website' as Lead['source'],
    lead_status: 'New' as Lead['status'],
    lead_priority: 'Medium' as Lead['priority'],
  });

  // Sync formData organization_id when currentOrg changes
  useEffect(() => {
    if (currentOrg?.id) {
      setFormData((prev) => ({
        ...prev,
        organization_id: currentOrg.id,
      }));
    }
  }, [currentOrg?.id]);

  // Contact Details Pop-up state
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

  // Task for Contact state
  const [taskContact, setTaskContact] = useState<Contact | null>(null);
  const [contactTaskTitle, setContactTaskTitle] = useState('');
  const [contactTaskDueDate, setContactTaskDueDate] = useState('');
  const [contactTaskPriority, setContactTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isSavingContactTask, setIsSavingContactTask] = useState(false);

  const canCreate = isSuper || hasPermission(currentRole, currentStatus, 'crm:contacts:create', currentUser);
  const canUpdate = isSuper || hasPermission(currentRole, currentStatus, 'crm:contacts:update', currentUser);
  const canDelete = isSuper || hasPermission(currentRole, currentStatus, 'crm:contacts:delete', currentUser);

  const orgIdsKey = effectiveOrgIds.join(',');

  const loadContacts = useCallback(async () => {
    if (isWorkspaceLoading) return;
    if (effectiveOrgIds.length === 0) {
      setContacts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await CRMService.getContacts(effectiveOrgIds, debouncedSearch, statusFilter);
      setContacts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [isWorkspaceLoading, orgIdsKey, debouncedSearch, statusFilter]);

  useEffect(() => {
    if (!isWorkspaceLoading && effectiveOrgIds.length > 0) {
      loadContacts();
    }
  }, [isWorkspaceLoading, orgIdsKey, loadContacts]);

  const handleOpenCreate = () => {
    setEditingContact(null);
    setFormData({
      organization_id: currentOrg?.id || effectiveOrgIds[0] || (memberships[0]?.organization.id ?? ''),
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      job_title: '',
      company_name: '',
      status: 'lead',
      notes: '',
      lead_value: 15000,
      lead_source: 'Website',
      lead_status: 'New',
      lead_priority: 'Medium',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      organization_id: contact.organization_id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      job_title: contact.job_title || '',
      company_name: contact.company_name || '',
      status: contact.status,
      notes: contact.notes || '',
      lead_value: 15000,
      lead_source: 'Website',
      lead_status: 'New',
      lead_priority: 'Medium',
    });
    setIsModalOpen(true);
  };

  const handleOpenTaskForContact = (contact: Contact) => {
    setTaskContact(contact);
    setContactTaskTitle(`Follow up with ${contact.first_name} ${contact.last_name}`);
    setContactTaskDueDate(new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]);
    setContactTaskPriority('medium');
  };

  const handleCreateContactTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskContact || !currentUser) return;
    const targetOrgId = taskContact.organization_id || currentOrg?.id;
    if (!targetOrgId) return;

    setIsSavingContactTask(true);
    try {
      await CRMService.createTask(
        targetOrgId,
        {
          title: contactTaskTitle.trim(),
          due_date: contactTaskDueDate ? new Date(contactTaskDueDate).toISOString() : null,
          priority: contactTaskPriority,
          status: 'todo',
          assigned_to: currentUser.id,
          related_type: 'contact',
          related_id: taskContact.id,
        },
        currentUser.id
      );
      toast.success('Task created and connected to contact!');
      setTaskContact(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    } finally {
      setIsSavingContactTask(false);
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
    const targetOrgId = editingContact?.organization_id || formData.organization_id || currentOrg?.id;
    if (!targetOrgId || !currentUser) return;

    try {
      const contactPayload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        job_title: formData.job_title || null,
        company_name: formData.company_name || null,
        status: formData.status,
        notes: formData.notes || null,
      };

      if (editingContact) {
        await CRMService.updateContact(editingContact.id, targetOrgId, contactPayload);
        toast.success(`Contact "${formData.first_name} ${formData.last_name}" updated!`);
      } else {
        await CRMService.createContact(targetOrgId, contactPayload, currentUser.id);

        // If marked as lead, automatically create corresponding Lead
        if (formData.status === 'lead') {
          const leadTitle = formData.company_name
            ? `${formData.first_name} ${formData.last_name} (${formData.company_name})`
            : `${formData.first_name} ${formData.last_name}`;
          await CRMService.createLead(
            targetOrgId,
            {
              title: leadTitle,
              first_name: formData.first_name,
              last_name: formData.last_name,
              email: formData.email || null,
              phone: formData.phone || null,
              company: formData.company_name || null,
              source: formData.lead_source,
              status: formData.lead_status,
              priority: formData.lead_priority,
              value: Number(formData.lead_value) || 0,
              assigned_to: currentUser.id,
            },
            currentUser.id
          );
        }
        toast.success(`Contact "${formData.first_name} ${formData.last_name}" created successfully!`);
      }

      setIsModalOpen(false);
      await loadContacts();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleDelete = (contact: Contact) => {
    const targetOrgId = contact.organization_id || currentOrg?.id;
    if (!targetOrgId) return;
    setConfirmState({
      isOpen: true,
      title: 'Delete Contact',
      message: 'Are you sure you want to permanently delete this contact? This cannot be undone.',
      confirmText: 'Delete Contact',
      variant: 'danger',
      action: async () => {
        try {
          await CRMService.deleteContact(contact.id, targetOrgId);
          toast.success('Contact deleted successfully');
          await loadContacts();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete contact');
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-violet-500 to-purple-600',
      'from-amber-500 to-orange-600',
      'from-rose-500 to-pink-600',
      'from-cyan-500 to-blue-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const customerCount = contacts.filter((c) => c.status === 'customer').length;
  const leadCount = contacts.filter((c) => c.status === 'lead').length;
  const partnerCount = contacts.filter((c) => c.status === 'partner').length;

  const showOrgColumn = isSuper || effectiveOrgIds.length > 1;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#171B26]">Contacts Directory</h1>
            <p className="text-[13px] text-[#697386] mt-0.5">
              {isSuper && isMultiOrgActive
                ? `Manage customers, leads, and partner contacts across ${
                    isAllOrgsSelected ? 'all organizations' : `${effectiveOrgIds.length} selected organizations`
                  }.`
                : `Manage customers, leads, and partner contacts for ${currentOrg?.name}.`}
            </p>
          </div>
          {canCreate && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#3659C9] hover:bg-[#2B47A1] text-white text-[13px] font-medium shadow-[0_1px_2px_rgba(54,89,201,0.2)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Contact</span>
            </button>
          )}
        </div>

        {/* Contacts KPI Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-blue-100/90 shadow-xs hover:border-blue-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center justify-center flex-shrink-0">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Directory</p>
              {isWorkspaceLoading || isLoading ? (
                <div className="h-7 w-14 bg-slate-200/80 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{contacts.length}</p>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-100/90 shadow-xs hover:border-emerald-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/70 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Customers</p>
              {isWorkspaceLoading || isLoading ? (
                <div className="h-7 w-14 bg-slate-200/80 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold text-emerald-600 tabular-nums">{customerCount}</p>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-100/90 shadow-xs hover:border-amber-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Prospect Leads</p>
              {isWorkspaceLoading || isLoading ? (
                <div className="h-7 w-14 bg-slate-200/80 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold text-amber-600 tabular-nums">{leadCount}</p>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-100/90 shadow-xs hover:border-purple-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 border border-purple-200/70 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Partners & Affiliates</p>
              {isWorkspaceLoading || isLoading ? (
                <div className="h-7 w-14 bg-slate-200/80 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold text-purple-700 tabular-nums">{partnerCount}</p>
              )}
            </div>
          </div>
        </div>

        {/* Filter Bar with Search, Organization Filter, and Segmented Status Control */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, company, email..."
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

          <div className="flex items-center space-x-1 bg-[#F1F3F7] p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'all', label: 'All Contacts' },
              { id: 'customer', label: 'Customers' },
              { id: 'lead', label: 'Leads' },
              { id: 'partner', label: 'Partners' },
              { id: 'inactive', label: 'Inactive' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-[#171B26] shadow-xs font-semibold'
                    : 'text-[#697386] hover:text-[#171B26]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table with Dedicated Inner Scroll & Sticky Header */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="inner-table-container">
            <table className="w-full text-left text-sm">
              <thead className="sticky-table-header text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  {showOrgColumn && <th className="py-3 px-4">Organization</th>}
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Email & Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isWorkspaceLoading || isLoading ? (
                  <TableSkeleton columns={showOrgColumn ? 6 : 5} rows={6} />
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={showOrgColumn ? 6 : 5} className="py-12 text-center">
                      <Users2 className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                      <p className="text-base font-semibold text-slate-800">No contacts found</p>
                      <p className="text-sm text-slate-500 mt-1">Get started by creating your first contact record.</p>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => {
                    const orgName =
                      contact.organization?.name ||
                      memberships.find((m) => m.organization.id === contact.organization_id)?.organization.name ||
                      'Organization';
                    const orgLogo = contact.organization?.logo_url;
                    const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();

                    return (
                      <tr
                        key={contact.id}
                        onClick={() => setViewingContact(contact)}
                        className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                      >
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
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-[#E2EAFA] text-[#3659C9] font-semibold flex items-center justify-center text-xs flex-shrink-0 border border-blue-100">
                              {initials || <Users2 className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="font-semibold text-[#171B26] text-sm group-hover:text-[#3659C9] transition-colors flex items-center space-x-1.5">
                                <span>{contact.first_name} {contact.last_name}</span>
                                <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-[#3659C9]" />
                              </div>
                              <div className="text-xs text-[#697386]">
                                {contact.job_title || 'No Title'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-[#171B26] font-medium text-sm">
                            {contact.company_name || '—'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5 text-xs">
                            {contact.email ? (
                              <div className="flex items-center text-[#171B26] font-medium">
                                <Mail className="w-3.5 h-3.5 text-[#697386] mr-1.5 flex-shrink-0" />
                                <span className="truncate max-w-[180px]">{contact.email}</span>
                              </div>
                            ) : null}
                            {contact.phone ? (
                              <div className="flex items-center text-[#697386]">
                                <Phone className="w-3.5 h-3.5 text-[#697386] mr-1.5 flex-shrink-0" />
                                <span>{contact.phone}</span>
                              </div>
                            ) : null}
                            {!contact.email && !contact.phone && (
                              <span className="text-slate-400">No contact info</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border capitalize ${
                              contact.status === 'customer'
                                ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                                : contact.status === 'partner'
                                ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                                : contact.status === 'lead'
                                ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                                : 'bg-[#F7F8FA] text-[#697386] border-[#E7EAF0]'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                contact.status === 'customer'
                                  ? 'bg-[#047857]'
                                  : contact.status === 'partner'
                                  ? 'bg-[#1D4ED8]'
                                  : contact.status === 'lead'
                                  ? 'bg-[#B45309]'
                                  : 'bg-[#697386]'
                              }`} />
                              {contact.status}
                            </span>
                            {contact.status === 'lead' && (
                              <Link
                                href="/leads"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-[#3659C9] hover:underline font-medium flex items-center"
                              >
                                <span>Lead Pipeline</span>
                                <ArrowRight className="w-3 h-3 ml-0.5" />
                              </Link>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1">
                            {canUpdate && (
                              <button
                                onClick={() => handleOpenTaskForContact(contact)}
                                className="p-1.5 text-[#697386] hover:text-[#3659C9] rounded-md hover:bg-[#F0F4FE] transition-colors"
                                title="Add task for this contact"
                              >
                                <CheckSquare className="w-4 h-4" />
                              </button>
                            )}
                            {canUpdate && (
                              <button
                                onClick={() => handleOpenEdit(contact)}
                                className="p-1.5 text-[#697386] hover:text-[#171B26] rounded-md hover:bg-[#F1F3F7] transition-colors"
                                title="Edit Contact"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(contact)}
                                className="p-1.5 text-[#697386] hover:text-[#B91C1C] rounded-md hover:bg-[#FEF2F2] transition-colors"
                                title="Delete Contact"
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

        {/* Create / Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-center justify-between flex-shrink-0 bg-[#F8FAFC]">
                <h3 className="font-semibold text-[#171B26] text-sm">
                  {editingContact ? 'Edit Contact' : 'Create New Contact'}
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
                {isSuper && !editingContact && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Organization *
                    </label>
                    <select
                      value={formData.organization_id}
                      onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    >
                      {memberships.filter((m) => m.status === 'approved').map((m) => (
                        <option key={m.organization.id} value={m.organization.id}>
                          {m.organization.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Job Title</label>
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 font-medium focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="lead">Lead (Prospective Customer)</option>
                    <option value="customer">Customer (Active Account)</option>
                    <option value="partner">Partner</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* LEAD DETAILS SECTION: Appears when marked as 'lead' */}
                {formData.status === 'lead' && (
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900">Lead Pipeline Details</h4>
                      <p className="text-[11px] text-slate-500">
                        Initial qualification details for this contact in your pipeline.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Est. Deal Value (₹) *
                        </label>
                        <input
                          type="number"
                          value={formData.lead_value}
                          onChange={(e) => setFormData({ ...formData, lead_value: Number(e.target.value) })}
                          className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none font-medium text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Source
                        </label>
                        <select
                          value={formData.lead_source}
                          onChange={(e) => setFormData({ ...formData, lead_source: e.target.value as any })}
                          className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
                        >
                          <option value="Website">Website</option>
                          <option value="Referral">Referral</option>
                          <option value="Outreach">Outreach</option>
                          <option value="Inbound">Inbound</option>
                          <option value="Event">Event</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Lead Status
                        </label>
                        <select
                          value={formData.lead_status}
                          onChange={(e) => setFormData({ ...formData, lead_status: e.target.value as any })}
                          className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Qualified">Qualified</option>
                          <option value="Lost">Lost</option>
                          <option value="Converted">Converted</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Priority
                        </label>
                        <select
                          value={formData.lead_priority}
                          onChange={(e) => setFormData({ ...formData, lead_priority: e.target.value as any })}
                          className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Internal Notes</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    placeholder="Key account details, pain points, or preferences..."
                  />
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
                    {editingContact ? 'Save Changes' : formData.status === 'lead' ? 'Save Contact & Create Lead' : 'Create Contact'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Quick Task for Contact Modal */}
        {taskContact && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-center justify-between flex-shrink-0 bg-[#F8FAFC]">
                <div>
                  <h3 className="font-semibold text-[#171B26] text-sm">Add Task for Contact</h3>
                  <p className="text-[12px] text-[#3659C9] font-medium mt-0.5 truncate max-w-[280px]">
                    {taskContact.first_name} {taskContact.last_name} {taskContact.company_name ? `(${taskContact.company_name})` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setTaskContact(null)}
                  className="text-[#697386] hover:text-[#171B26] p-1 rounded-md hover:bg-[#F1F3F7] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateContactTask} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar">
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Task Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Schedule product demo call"
                      value={contactTaskTitle}
                      onChange={(e) => setContactTaskTitle(e.target.value)}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9]"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Due Date</label>
                      <input
                        type="date"
                        value={contactTaskDueDate}
                        onChange={(e) => setContactTaskDueDate(e.target.value)}
                        className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] tabular-nums focus:outline-none focus:border-[#3659C9]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Priority</label>
                      <select
                        value={contactTaskPriority}
                        onChange={(e) => setContactTaskPriority(e.target.value as any)}
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
                    onClick={() => setTaskContact(null)}
                    className="px-3.5 py-2 text-[13px] font-medium text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingContactTask || !contactTaskTitle.trim()}
                    className="px-4 py-2 text-[13px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isSavingContactTask ? 'Adding...' : 'Connect & Add Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Contact Details Pop-up Modal */}
        {viewingContact && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-start justify-between bg-[#F8FAFC] flex-shrink-0">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-full bg-[#E2EAFA] text-[#3659C9] font-bold flex items-center justify-center text-base border border-blue-100 flex-shrink-0">
                    {`${viewingContact.first_name?.[0] || ''}${viewingContact.last_name?.[0] || ''}`.toUpperCase() || (
                      <Users2 className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#3659C9] border border-blue-200">
                        Contact Details
                      </span>
                      {viewingContact.organization?.name && (
                        <span className="text-xs text-[#697386] font-medium">
                          • {viewingContact.organization.name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-[#171B26] leading-snug mt-0.5">
                      {viewingContact.first_name} {viewingContact.last_name}
                    </h3>
                    <p className="text-xs text-[#697386]">
                      {viewingContact.job_title || 'No Job Title'} {viewingContact.company_name ? `at ${viewingContact.company_name}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingContact(null)}
                  className="text-[#697386] hover:text-[#171B26] p-1.5 rounded-md hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 no-scrollbar">
                {/* Status & Company Overview */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-[#F8FAFC] rounded-lg border border-[#E7EAF0]">
                  <div>
                    <span className="text-xs font-medium text-[#697386] uppercase tracking-wider">Company</span>
                    <div className="text-base font-semibold text-[#171B26] mt-0.5">
                      {viewingContact.company_name || 'Independent / Individual'}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[#697386] uppercase tracking-wider">Relationship</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border capitalize ${
                          viewingContact.status === 'customer'
                            ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                            : viewingContact.status === 'partner'
                            ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                            : viewingContact.status === 'lead'
                            ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                            : 'bg-[#F7F8FA] text-[#697386] border-[#E7EAF0]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          viewingContact.status === 'customer'
                            ? 'bg-[#047857]'
                            : viewingContact.status === 'partner'
                            ? 'bg-[#1D4ED8]'
                            : viewingContact.status === 'lead'
                            ? 'bg-[#B45309]'
                            : 'bg-[#697386]'
                        }`} />
                        {viewingContact.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Reach Out
                  </h4>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-[#697386] font-medium">Email Address:</span>
                      {viewingContact.email ? (
                        <a
                          href={`mailto:${viewingContact.email}`}
                          className="font-medium text-[#3659C9] hover:underline flex items-center space-x-1.5"
                        >
                          <Mail className="w-4 h-4" />
                          <span>{viewingContact.email}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">Not provided</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-[#697386] font-medium">Phone Number:</span>
                      {viewingContact.phone ? (
                        <a
                          href={`tel:${viewingContact.phone}`}
                          className="font-medium text-[#3659C9] hover:underline flex items-center space-x-1.5"
                        >
                          <Phone className="w-4 h-4" />
                          <span>{viewingContact.phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">Not provided</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-[#697386] font-medium">Created On:</span>
                      <span className="font-medium text-[#171B26]">
                        {new Date(viewingContact.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                {viewingContact.notes && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Notes & Context
                    </h4>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-sm text-[#171B26] leading-relaxed whitespace-pre-wrap">
                      {viewingContact.notes}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer with Actions */}
              <div className="px-6 py-4 border-t border-[#E7EAF0] bg-slate-50 flex items-center justify-between flex-shrink-0">
                <div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingContact;
                        setViewingContact(null);
                        handleDelete(target);
                      }}
                      className="px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingContact;
                        setViewingContact(null);
                        handleOpenTaskForContact(target);
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
                        const target = viewingContact;
                        setViewingContact(null);
                        handleOpenEdit(target);
                      }}
                      className="px-4 py-2 text-xs font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md transition-colors flex items-center space-x-1.5 shadow-2xs"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Contact</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingContact(null)}
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
