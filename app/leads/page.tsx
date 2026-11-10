'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { Lead } from '../../lib/types/crm';
import { hasPermission, isBharatPlay } from '../../lib/permissions';
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
} from 'lucide-react';

export default function LeadsPage() {
  const { currentOrg, currentRole, currentStatus, currentUser } = useWorkspace();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({
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

  const canCreate = hasPermission(currentRole, currentStatus, 'crm:leads:create');
  const canUpdate = hasPermission(currentRole, currentStatus, 'crm:leads:update');
  const canDelete = hasPermission(currentRole, currentStatus, 'crm:leads:delete');

  const loadLeads = useCallback(async () => {
    if (!currentOrg?.id) return;
    if (leads.length === 0) {
      setIsLoading(true);
    }
    try {
      const data = await CRMService.getLeads(currentOrg.id, search, statusFilter);
      setLeads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, search, statusFilter, leads.length]);

  useEffect(() => {
    if (currentOrg?.id) {
      loadLeads();
    }
  }, [currentOrg?.id, loadLeads]);

  const handleOpenCreate = () => {
    setEditingLead(null);
    setFormData({
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
      if (editingLead) {
        await CRMService.updateLead(editingLead.id, currentOrg.id, formData);
        toast.success(`Lead "${formData.title}" updated successfully!`);
      } else {
        await CRMService.createLead(currentOrg.id, formData, currentUser.id);
        toast.success(`Lead "${formData.title || formData.first_name}" created successfully!`);
      }
      setIsModalOpen(false);
      await loadLeads();
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while saving lead');
    }
  };

  const handleConvert = (leadId: string) => {
    if (!currentOrg || !currentUser) return;
    setConfirmState({
      isOpen: true,
      title: 'Convert Lead',
      message: 'Are you sure you want to convert this lead into an active customer contact and pipeline deal?',
      confirmText: 'Convert Lead',
      variant: 'primary',
      action: async () => {
        try {
          await CRMService.convertLead(leadId, currentOrg.id, currentUser.id);
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

  const handleDelete = (leadId: string) => {
    if (!currentOrg) return;
    setConfirmState({
      isOpen: true,
      title: 'Delete Lead',
      message: 'Are you sure you want to permanently delete this lead? This cannot be undone.',
      confirmText: 'Delete Lead',
      variant: 'danger',
      action: async () => {
        try {
          await CRMService.deleteLead(leadId, currentOrg.id);
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

  const isBPOrg = isBharatPlay(currentOrg);
  // Exclude Bharat Play event workshop registrations so they are exclusively displayed on the dedicated /registrations page for Bharat Play
  const isBharatPlayRegistration = (lead: Lead) =>
    isBPOrg && (
      lead.company === 'Bharat Play' ||
      lead.source === 'Event' ||
      lead.title?.toLowerCase().startsWith('bharat play:')
    );

  const displayLeads = leads.filter((l) => !isBharatPlayRegistration(l));
  const bharatPlayCount = isBPOrg ? leads.filter(isBharatPlayRegistration).length : 0;

  const newLeadsCount = displayLeads.filter((l) => l.status === 'New').length;
  const qualifiedCount = displayLeads.filter((l) => l.status === 'Qualified').length;
  const convertedCount = displayLeads.filter((l) => l.status === 'Converted').length;
  const highPriorityCount = displayLeads.filter((l) => l.priority === 'High' || l.priority === 'Urgent').length;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Dedicated Bharat Play Navigation Banner */}
        {isBPOrg && bharatPlayCount > 0 && (
          <div className="bg-gradient-to-r from-sky-50 via-indigo-50 to-white border border-sky-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  {bharatPlayCount} Bharat Play Workshop {bharatPlayCount === 1 ? 'Registration' : 'Registrations'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Managed separately in the dedicated Bharat Play page with group size, time slots, and WhatsApp messaging.
                </p>
              </div>
            </div>
            <Link
              href="/registrations"
              className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-sky-50 border border-sky-300 text-sky-700 text-xs font-semibold shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              <span>View Registrations</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads Pipeline</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Prospects, inbound inquiries, and qualification for {currentOrg?.name}.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Capture Lead</span>
            </button>
          )}
        </div>

        {/* Leads KPI Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center ring-1 ring-purple-500/10 flex-shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Leads</p>
              <p className="text-base font-bold text-slate-900">{displayLeads.length}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center ring-1 ring-rose-500/10 flex-shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">High / Urgent</p>
              <p className="text-base font-bold text-rose-600">{highPriorityCount}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center ring-1 ring-blue-500/10 flex-shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Qualified Leads</p>
              <p className="text-base font-bold text-blue-600">{qualifiedCount}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-500/10 flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Converted to Deal</p>
              <p className="text-base font-bold text-emerald-600">{convertedCount}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search leads by title, company, contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'New', label: 'New' },
              { id: 'Contacted', label: 'Contacted' },
              { id: 'Qualified', label: 'Qualified' },
              { id: 'Converted', label: 'Converted' },
              { id: 'Lost', label: 'Lost' },
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

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Lead</th>
                  <th className="py-3 px-4">Contact & Company</th>
                  <th className="py-3 px-4">Estimated Value</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Status & Priority</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Loading leads...
                    </td>
                  </tr>
                ) : displayLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-600">No leads found</p>
                      <p className="text-xs text-slate-400 mt-1">Capture new leads to drive pipeline growth.</p>
                    </td>
                  </tr>
                ) : (
                  displayLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{lead.title}</div>
                        <div className="text-[11px] text-slate-400">Captured {new Date(lead.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">
                          {lead.first_name || lead.last_name ? `${lead.first_name || ''} ${lead.last_name || ''}` : 'Direct Inbound'}
                        </div>
                        <div className="text-[11px] text-slate-500">{lead.company || 'Private Entity'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        ₹{Number(lead.value).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                          {lead.source}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 space-x-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          lead.status === 'Converted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : lead.status === 'Qualified'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : lead.status === 'Contacted'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : lead.status === 'Lost'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {lead.status}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          lead.priority === 'Urgent'
                            ? 'bg-rose-100 text-rose-800'
                            : lead.priority === 'High'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {lead.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {lead.status !== 'Converted' && canUpdate && (
                            <button
                              onClick={() => handleConvert(lead.id)}
                              className="px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded flex items-center space-x-1 transition-colors"
                              title="Convert to Contact & Deal"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Convert</span>
                            </button>
                          )}
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenEdit(lead)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(lead.id)}
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

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">
                  {editingLead ? 'Edit Lead' : 'Create New Lead'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Lead Title / Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp Inbound"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Lead Contact First Name</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Est. Deal Value (₹)</label>
                    <input
                      type="number"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Source</label>
                    <select
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Lost">Lost</option>
                      <option value="Converted">Converted</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
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
                    {editingLead ? 'Update Lead' : 'Save Lead'}
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

