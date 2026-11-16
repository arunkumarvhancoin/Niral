'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { Contact, Lead } from '../../lib/types/crm';
import { hasPermission } from '../../lib/permissions';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
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
  Sparkles,
  ShieldCheck,
  UserCheck,
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
  } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
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

  const canCreate = isSuper || hasPermission(currentRole, currentStatus, 'crm:contacts:create', currentUser);
  const canUpdate = isSuper || hasPermission(currentRole, currentStatus, 'crm:contacts:update', currentUser);
  const canDelete = isSuper || hasPermission(currentRole, currentStatus, 'crm:contacts:delete', currentUser);

  const orgIdsKey = effectiveOrgIds.join(',');

  const loadContacts = useCallback(async () => {
    if (effectiveOrgIds.length === 0) {
      setContacts([]);
      setIsLoading(false);
      return;
    }
    if (contacts.length === 0) {
      setIsLoading(true);
    }
    try {
      const data = await CRMService.getContacts(effectiveOrgIds, search, statusFilter);
      setContacts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [orgIdsKey, search, statusFilter, contacts.length]);

  useEffect(() => {
    if (effectiveOrgIds.length > 0) {
      loadContacts();
    }
  }, [orgIdsKey, loadContacts]);

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
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{contacts.length}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-100/90 shadow-xs hover:border-emerald-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/70 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Customers</p>
              <p className="text-2xl font-bold text-emerald-600 tabular-nums">{customerCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-100/90 shadow-xs hover:border-amber-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Prospect Leads</p>
              <p className="text-2xl font-bold text-amber-600 tabular-nums">{leadCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-100/90 shadow-xs hover:border-purple-300 transition-all flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 border border-purple-200/70 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Partners & Affiliates</p>
              <p className="text-2xl font-bold text-purple-700 tabular-nums">{partnerCount}</p>
            </div>
          </div>
        </div>

        {/* Filter Bar with Search, Organization Filter, and Quick Pills */}
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

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All', activeBg: 'bg-slate-900 text-white' },
              { id: 'customer', label: 'Customers', activeBg: 'bg-emerald-600 text-white' },
              { id: 'lead', label: 'Leads', activeBg: 'bg-amber-600 text-white' },
              { id: 'partner', label: 'Partners', activeBg: 'bg-purple-600 text-white' },
              { id: 'inactive', label: 'Inactive', activeBg: 'bg-slate-600 text-white' },
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

        {/* Table */}
        <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFAFC] border-b border-[#E7EAF0] text-[#697386] font-medium uppercase tracking-wider text-[11px]">
                <tr>
                  {showOrgColumn && <th className="py-2.5 px-4">Organization</th>}
                  <th className="py-2.5 px-4">Contact</th>
                  <th className="py-2.5 px-4">Company & Title</th>
                  <th className="py-2.5 px-4">Contact Details</th>
                  <th className="py-2.5 px-4">Relationship Status</th>
                  <th className="py-2.5 px-4">Added</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EAF0]">
                {isLoading ? (
                  <tr>
                    <td colSpan={showOrgColumn ? 7 : 6} className="py-12 text-center text-[#697386]">
                      Loading contacts...
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={showOrgColumn ? 7 : 6} className="py-12 text-center">
                      <Users2 className="w-8 h-8 text-[#BAC0CE] mx-auto mb-2" />
                      <p className="text-sm font-medium text-[#171B26]">No contacts found</p>
                      <p className="text-xs text-[#697386] mt-1">Get started by creating your first contact record.</p>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => {
                    const orgName =
                      contact.organization?.name ||
                      memberships.find((m) => m.organization.id === contact.organization_id)?.organization.name ||
                      'Organization';
                    const orgLogo = contact.organization?.logo_url;

                    return (
                      <tr key={contact.id} className="hover:bg-[#F8F9FB] transition-colors">
                        {showOrgColumn && (
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <div className="w-5 h-5 rounded bg-[#F1F3F7] border border-[#E7EAF0] flex items-center justify-center text-[#3659C9] text-[10px] font-bold overflow-hidden flex-shrink-0">
                                {orgLogo ? (
                                  <img src={orgLogo} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  orgName.charAt(0).toUpperCase()
                                )}
                              </div>
                              <span className="font-medium text-[#171B26] text-xs truncate max-w-[150px]">
                                {orgName}
                              </span>
                            </div>
                          </td>
                        )}

                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#E2EAFA] text-[#3659C9] font-medium flex items-center justify-center text-[11px] flex-shrink-0">
                              {contact.first_name?.[0]?.toUpperCase()}
                              {contact.last_name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-[#171B26] text-[13px]">
                                {contact.first_name} {contact.last_name}
                              </div>
                              {contact.notes && (
                                <div className="text-[11px] text-[#697386] truncate max-w-xs">{contact.notes}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-[#171B26] font-medium text-[13px]">{contact.company_name || '—'}</div>
                          <div className="text-[11px] text-[#697386]">{contact.job_title || 'No Title'}</div>
                        </td>
                        <td className="py-3 px-4 space-y-0.5">
                          {contact.email && (
                            <div className="flex items-center text-[#171B26] text-xs">
                              <Mail className="w-3 h-3 text-[#697386] mr-1.5" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center text-[#697386] text-[11px]">
                              <Phone className="w-3 h-3 text-[#697386] mr-1.5" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                              contact.status === 'customer'
                                ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                                : contact.status === 'partner'
                                ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                                : contact.status === 'lead'
                                ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                                : 'bg-[#F7F8FA] text-[#697386] border border-[#E7EAF0]'
                            }`}>
                              {contact.status}
                            </span>
                            {contact.status === 'lead' && (
                              <Link
                                href="/leads"
                                className="text-[11px] text-[#3659C9] hover:underline font-medium flex items-center"
                              >
                                <span>Leads</span>
                                <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                              </Link>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[#697386] text-xs tabular-nums">
                          {new Date(contact.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {canUpdate && (
                              <button
                                onClick={() => handleOpenEdit(contact)}
                                className="p-1.5 text-[#697386] hover:text-[#171B26] rounded hover:bg-[#F1F3F7] transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(contact)}
                                className="p-1.5 text-[#697386] hover:text-[#B91C1C] rounded hover:bg-[#FEF2F2] transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E7EAF0] max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="p-4 border-b border-[#E7EAF0] flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="font-semibold text-[#171B26] text-[15px]">
                  {editingContact ? 'Edit Contact' : 'Create New Contact'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#697386] hover:text-[#171B26] p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
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

                <div className="pt-3 border-t border-[#E7EAF0] flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 text-[12px] font-medium text-[#171B26] hover:bg-[#F1F3F7] rounded-md border border-[#E7EAF0] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-[12px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-[0_1px_2px_rgba(54,89,201,0.2)] transition-colors"
                  >
                    {editingContact ? 'Save Changes' : formData.status === 'lead' ? 'Save Contact & Create Lead' : 'Create Contact'}
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
          onConfirm={() => confirmState.action?.()}
          onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </AppShell>
  );
}
