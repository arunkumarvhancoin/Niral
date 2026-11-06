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
  const { currentOrg, currentRole, currentStatus, currentUser } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
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

  const canCreate = hasPermission(currentRole, currentStatus, 'crm:contacts:create');
  const canUpdate = hasPermission(currentRole, currentStatus, 'crm:contacts:update');
  const canDelete = hasPermission(currentRole, currentStatus, 'crm:contacts:delete');

  const loadContacts = useCallback(async () => {
    if (!currentOrg?.id) return;
    if (contacts.length === 0) {
      setIsLoading(true);
    }
    try {
      const data = await CRMService.getContacts(currentOrg.id, search, statusFilter);
      setContacts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, search, statusFilter, contacts.length]);

  useEffect(() => {
    if (currentOrg?.id) {
      loadContacts();
    }
  }, [currentOrg?.id, loadContacts]);

  const handleOpenCreate = () => {
    setEditingContact(null);
    setFormData({
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
    if (!currentOrg || !currentUser) return;

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
        await CRMService.updateContact(editingContact.id, currentOrg.id, contactPayload);
        toast.success(`Contact "${formData.first_name} ${formData.last_name}" updated!`);
      } else {
        await CRMService.createContact(currentOrg.id, contactPayload, currentUser.id);

        // If marked as lead, automatically create corresponding Lead
        if (formData.status === 'lead') {
          const leadTitle = formData.company_name
            ? `${formData.first_name} ${formData.last_name} (${formData.company_name})`
            : `${formData.first_name} ${formData.last_name}`;
          await CRMService.createLead(
            currentOrg.id,
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

  const handleDelete = (contactId: string) => {
    if (!currentOrg) return;
    setConfirmState({
      isOpen: true,
      title: 'Delete Contact',
      message: 'Are you sure you want to permanently delete this contact? This cannot be undone.',
      confirmText: 'Delete Contact',
      variant: 'danger',
      action: async () => {
        try {
          await CRMService.deleteContact(contactId, currentOrg.id);
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

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contacts Directory</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage customers, leads, and partner contacts for {currentOrg?.name}.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Contact</span>
            </button>
          )}
        </div>

        {/* Contacts KPI Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center ring-1 ring-blue-500/10 flex-shrink-0">
              <Users2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Directory</p>
              <p className="text-base font-bold text-slate-900">{contacts.length}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-500/10 flex-shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Customers</p>
              <p className="text-base font-bold text-emerald-600">{customerCount}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center ring-1 ring-amber-500/10 flex-shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Prospect Leads</p>
              <p className="text-base font-bold text-amber-600">{leadCount}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center ring-1 ring-purple-500/10 flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Partners & Affiliates</p>
              <p className="text-base font-bold text-purple-600">{partnerCount}</p>
            </div>
          </div>
        </div>

        {/* Filter Bar with One-Click Quick Pills */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, company, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'customer', label: 'Customers' },
              { id: 'lead', label: 'Leads' },
              { id: 'partner', label: 'Partners' },
              { id: 'inactive', label: 'Inactive' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                  statusFilter === pill.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Company & Title</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Relationship Status</th>
                  <th className="py-3 px-4">Added</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Loading contacts...
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Users2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-600">No contacts found</p>
                      <p className="text-xs text-slate-400 mt-1">Get started by creating your first contact record.</p>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarColor(
                              contact.first_name + ' ' + contact.last_name
                            )} text-white font-bold flex items-center justify-center text-[11px] shadow-xs flex-shrink-0`}
                          >
                            {contact.first_name?.[0]?.toUpperCase()}
                            {contact.last_name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {contact.first_name} {contact.last_name}
                            </div>
                            {contact.notes && (
                              <div className="text-[11px] text-slate-500 truncate max-w-xs">{contact.notes}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">{contact.company_name || '—'}</div>
                        <div className="text-[11px] text-slate-500">{contact.job_title || 'No Title'}</div>
                      </td>
                      <td className="py-3.5 px-4 space-y-0.5">
                        {contact.email && (
                          <div className="flex items-center text-slate-600">
                            <Mail className="w-3 h-3 text-slate-400 mr-1.5" />
                            <span>{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center text-slate-500 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400 mr-1.5" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            contact.status === 'customer'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : contact.status === 'partner'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : contact.status === 'lead'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {contact.status}
                          </span>
                          {contact.status === 'lead' && (
                            <Link
                              href="/leads"
                              className="text-[10px] text-primary-600 hover:text-primary-800 font-medium flex items-center hover:underline"
                            >
                              <span>Leads</span>
                              <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenEdit(contact)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(contact.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create / Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="font-bold text-slate-900 text-base">
                  {editingContact ? 'Edit Contact' : 'Create New Contact'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                          Est. Deal Value ($) *
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

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
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
