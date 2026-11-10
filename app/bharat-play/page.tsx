'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { createClient } from '../../lib/supabase/client';
import { Lead } from '../../lib/types/crm';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import {
  Ticket,
  Search,
  Users,
  Calendar,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  Download,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Trash2,
  Filter,
  Sparkles,
} from 'lucide-react';

const WEBHOOK_URL = 'https://niral-crm.vercel.app/api/webhooks/bharat-play';

export default function BharatPlayPage() {
  const { currentOrg, currentUser } = useWorkspace();
  const [registrations, setRegistrations] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [slotFilter, setSlotFilter] = useState('all');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  // Confirm delete dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadRegistrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      // Query all leads for Bharat Play (either by company, source, or title pattern)
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .or('company.eq.Bharat Play,source.eq.Event,title.ilike.Bharat Play%')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching Bharat Play registrations:', error);
        toast.error('Failed to load Bharat Play registrations');
      } else {
        setRegistrations((data || []) as Lead[]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Unexpected error loading registrations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  // Helper to extract slot and member info from lead title
  // Standard format: "Bharat Play: John Doe (1 Member (Solo) · 10:00 AM – 1:00 PM)"
  const parseLeadDetails = (title: string) => {
    const match = title.match(/\((.*?)\s*·\s*(.*?)\)/);
    if (match) {
      return {
        members: match[1]?.trim() || '1 Member',
        slot: match[2]?.trim() || '10:00 AM – 1:00 PM',
      };
    }
    return {
      members: '1 Member (Solo)',
      slot: '10:00 AM – 1:00 PM',
    };
  };

  // Helper to extract headcount number
  const extractHeadcount = (title: string): number => {
    const { members } = parseLeadDetails(title);
    const numMatch = members.match(/\d+/);
    return numMatch ? parseInt(numMatch[0], 10) : 1;
  };

  // Handle status update
  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    setIsUpdatingStatus(leadId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) {
        toast.error('Failed to update status: ' + error.message);
      } else {
        setRegistrations((prev) =>
          prev.map((reg) => (reg.id === leadId ? { ...reg, status: newStatus } : reg))
        );
        toast.success(`Booking status changed to ${newStatus}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating status');
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  // Handle delete registration
  const handleDelete = (lead: Lead) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Registration',
      message: `Are you sure you want to delete the booking for "${lead.first_name || ''} ${lead.last_name || ''}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const supabase = createClient();
          const { error } = await supabase.from('leads').delete().eq('id', lead.id);
          if (error) {
            toast.error('Failed to delete registration: ' + error.message);
          } else {
            setRegistrations((prev) => prev.filter((r) => r.id !== lead.id));
            toast.success('Registration removed successfully');
          }
        } catch (err: any) {
          toast.error(err.message || 'Error deleting registration');
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Copy webhook URL
  const handleCopyWebhookUrl = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(WEBHOOK_URL);
      setCopiedUrl(true);
      toast.success('Webhook endpoint URL copied to clipboard');
      setTimeout(() => setCopiedUrl(false), 2200);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (registrations.length === 0) {
      toast.error('No registrations to export');
      return;
    }

    const headers = [
      'Registration ID',
      'Attendee Name',
      'Email',
      'Phone Number',
      'Members / Group Size',
      'Time Slot',
      'Total Amount (INR)',
      'Status',
      'Date Registered',
    ];

    const rows = filteredRegistrations.map((reg) => {
      const { members, slot } = parseLeadDetails(reg.title);
      const name = `${reg.first_name || ''} ${reg.last_name || ''}`.trim() || reg.title;
      return [
        `"${reg.id}"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${reg.email || ''}"`,
        `"${reg.phone || ''}"`,
        `"${members.replace(/"/g, '""')}"`,
        `"${slot.replace(/"/g, '""')}"`,
        `"${reg.value || 649}"`,
        `"${reg.status}"`,
        `"${new Date(reg.created_at).toLocaleString('en-IN')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bharat-play-registrations-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded attendee CSV list');
  };

  // Extract all distinct slots for filter dropdown
  const allSlots = Array.from(
    new Set(registrations.map((r) => parseLeadDetails(r.title).slot).filter(Boolean))
  );

  // Filtered registrations
  const filteredRegistrations = registrations.filter((reg) => {
    const { members, slot } = parseLeadDetails(reg.title);
    const fullName = `${reg.first_name || ''} ${reg.last_name || ''}`.toLowerCase();
    const email = (reg.email || '').toLowerCase();
    const phone = (reg.phone || '').toLowerCase();
    const q = search.toLowerCase().trim();

    const matchesSearch =
      !q ||
      fullName.includes(q) ||
      email.includes(q) ||
      phone.includes(q) ||
      reg.title.toLowerCase().includes(q) ||
      members.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;
    const matchesSlot = slotFilter === 'all' || slot === slotFilter;

    return matchesSearch && matchesStatus && matchesSlot;
  });

  // KPI Calculations
  const totalBookings = registrations.length;
  const totalAttendees = registrations.reduce((sum, r) => sum + extractHeadcount(r.title), 0);
  const totalRevenue = registrations.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  const newBookingsCount = registrations.filter((r) => r.status === 'New').length;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-[#0C2444] to-sky-700 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <Ticket className="w-6 h-6 text-sky-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Bharat Play Registrations
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Workshop seat bookings, attendee details, and instant WhatsApp communication.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={loadRegistrations}
              disabled={isLoading}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Webhook Integration Status Card */}
        <div className="bg-gradient-to-r from-[#0C2444] to-[#163a69] text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-sky-300 bg-white/10 px-2 py-0.5 rounded">
                  Connected Webhook
                </span>
                <span className="text-xs text-sky-100 font-medium">Auto-capturing from bharatplay.com</span>
              </div>
              <p className="text-xs font-mono text-sky-200 bg-black/25 px-3 py-1.5 rounded-lg inline-block border border-white/10 break-all select-all">
                {WEBHOOK_URL}
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleCopyWebhookUrl}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/15 transition-colors"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied URL' : 'Copy Endpoint'}</span>
              </button>
              <a
                href="https://bharatplay.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/15 transition-colors"
              >
                <span>Visit Bharat Play</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center ring-1 ring-indigo-500/10 shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Bookings</p>
              <p className="text-lg font-bold text-slate-900">{totalBookings}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center ring-1 ring-sky-500/10 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Attendees</p>
              <p className="text-lg font-bold text-sky-700">{totalAttendees} Seats</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-500/10 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Payable / Collected</p>
              <p className="text-lg font-bold text-emerald-700">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center ring-1 ring-amber-500/10 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">New / Uncontacted</p>
              <p className="text-lg font-bold text-amber-600">{newBookingsCount}</p>
            </div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by attendee name, email, phone, or group..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Slot Filter */}
            {allSlots.length > 1 && (
              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Time Slots</option>
                {allSlots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {/* Status Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-0.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'New', label: 'New' },
                { id: 'Contacted', label: 'Contacted' },
                { id: 'Qualified', label: 'Confirmed' },
                { id: 'Lost', label: 'Cancelled' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setStatusFilter(pill.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap ${
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
        </div>

        {/* Registrations Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Attendee</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">Chosen Slot</th>
                  <th className="py-3 px-4">Payable</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-slate-400" />
                      Loading registrations...
                    </td>
                  </tr>
                ) : filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700">No registrations found</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        New workshop submissions from the Bharat Play registration form will show up here automatically.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => {
                    const { members, slot } = parseLeadDetails(reg.title);
                    const cleanPhone = (reg.phone || '').replace(/[^0-9]/g, '');
                    const attendeeName =
                      `${reg.first_name || ''} ${reg.last_name || ''}`.trim() ||
                      reg.title.split('(')[0]?.replace('Bharat Play:', '').trim() ||
                      'Guest';

                    // Clean WhatsApp message
                    const whatsappMsg = encodeURIComponent(
                      `Hi ${attendeeName}! Thank you for registering for Bharat Play. We have reserved ${members} for your session (${slot}). Looking forward to seeing you!`
                    );
                    const whatsappLink = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${whatsappMsg}` : null;

                    return (
                      <tr key={reg.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Attendee Info */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {attendeeName[0]?.toUpperCase() || 'G'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate leading-snug">
                                {attendeeName}
                              </p>
                              <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                                {reg.email && (
                                  <span className="flex items-center space-x-1 truncate max-w-[140px]">
                                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{reg.email}</span>
                                  </span>
                                )}
                                {reg.phone && (
                                  <span className="flex items-center space-x-1 shrink-0">
                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{reg.phone}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Members / Group Size */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            <Users className="w-3 h-3 mr-1 text-indigo-500" />
                            {members}
                          </span>
                        </td>

                        {/* Slot */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1 text-slate-700 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{slot}</span>
                          </div>
                        </td>

                        {/* Payable Amount */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          ₹{Number(reg.value || 649).toLocaleString('en-IN')}
                        </td>

                        {/* Status Dropdown */}
                        <td className="py-3.5 px-4">
                          <select
                            value={reg.status}
                            disabled={isUpdatingStatus === reg.id}
                            onChange={(e) => handleStatusChange(reg.id, e.target.value as Lead['status'])}
                            className={`text-[11px] font-semibold rounded-lg px-2 py-1 border transition-colors cursor-pointer focus:outline-none ${
                              reg.status === 'Converted' || reg.status === 'Qualified'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : reg.status === 'Contacted'
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : reg.status === 'Lost'
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Qualified">Confirmed</option>
                            <option value="Converted">Attended</option>
                            <option value="Lost">Cancelled</option>
                          </select>
                        </td>

                        {/* Date Registered */}
                        <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(reg.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {whatsappLink && (
                              <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noreferrer"
                                title="Chat on WhatsApp"
                                className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {reg.phone && (
                              <a
                                href={`tel:${reg.phone}`}
                                title="Call attendee"
                                className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center transition-colors"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDelete(reg)}
                              title="Delete registration"
                              className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

        {/* Confirmation Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText="Delete"
          variant="danger"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </AppShell>
  );
}
