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
  Eye,
  X,
  ExternalLink,
  DollarSign,
  TrendingUp,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  ZoomIn,
} from 'lucide-react';

interface RegistrationLead extends Lead {
  contact?: {
    notes?: string | null;
  } | null;
}

export default function RegistrationsPage() {
  const { currentOrg } = useWorkspace();
  const [registrations, setRegistrations] = useState<RegistrationLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [slotFilter, setSlotFilter] = useState('all');

  // Selected registration for the details box modal
  const [selectedReg, setSelectedReg] = useState<RegistrationLead | null>(null);

  // Modal for enlarged preview of payment screenshot
  const [zoomedScreenshot, setZoomedScreenshot] = useState<string | null>(null);

  // Copy indicator state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Confirm delete dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    leadId: string;
    attendeeName: string;
  }>({
    isOpen: false,
    leadId: '',
    attendeeName: '',
  });

  const loadRegistrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      // Query all registrations joined with contact notes for payment screenshots
      const { data, error } = await supabase
        .from('leads')
        .select('*, contact:converted_contact_id(notes)')
        .or('company.eq.Bharat Play,source.eq.Event,title.ilike.Bharat Play%')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching registrations:', error);
        toast.error('Failed to load registrations');
      } else {
        setRegistrations((data || []) as RegistrationLead[]);
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

  // Extract payment screenshot from contact notes
  const extractScreenshotUrl = (reg: RegistrationLead): string | null => {
    const notes = reg.contact?.notes || '';
    const match = notes.match(/• Payment Screenshot:\s*(.+)/);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
    return null;
  };

  // Helper to extract headcount number
  const extractHeadcount = (title: string): number => {
    const { members } = parseLeadDetails(title);
    const numMatch = members.match(/\d+/);
    return numMatch ? parseInt(numMatch[0], 10) : 1;
  };

  // Handle delete execution
  const handleDeleteConfirm = async () => {
    const { leadId, attendeeName } = deleteConfirm;
    if (!leadId) return;

    try {
      const supabase = createClient();

      // Find if there is a linked contact to clean up
      const target = registrations.find((r) => r.id === leadId);

      const { error: leadErr } = await supabase.from('leads').delete().eq('id', leadId);
      if (leadErr) {
        toast.error('Failed to delete lead: ' + leadErr.message);
        return;
      }

      if (target?.converted_contact_id) {
        await supabase.from('contacts').delete().eq('id', target.converted_contact_id);
      }

      setRegistrations((prev) => prev.filter((r) => r.id !== leadId));
      if (selectedReg?.id === leadId) {
        setSelectedReg(null);
      }
      toast.success(`Registration for "${attendeeName}" deleted successfully`);
    } catch (err: any) {
      toast.error(err.message || 'Error deleting registration');
    } finally {
      setDeleteConfirm({ isOpen: false, leadId: '', attendeeName: '' });
    }
  };

  // Copy helper
  const handleCopy = (text: string, fieldKey: string) => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      toast.success(`Copied ${text}`);
      setTimeout(() => setCopiedField(null), 2000);
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
      'Email ID',
      'Phone Number',
      'Number of Members',
      'Chosen Slot',
      'Total Payable (INR)',
      'Payment Screenshot Attached',
      'Date & Time Registered (IST)',
    ];

    const rows = filteredRegistrations.map((reg) => {
      const { members, slot } = parseLeadDetails(reg.title);
      const name = `${reg.first_name || ''} ${reg.last_name || ''}`.trim() || reg.title;
      const hasScreenshot = extractScreenshotUrl(reg) ? 'Yes' : 'No';
      return [
        `"${reg.id}"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${reg.email || ''}"`,
        `"${reg.phone || ''}"`,
        `"${members.replace(/"/g, '""')}"`,
        `"${slot.replace(/"/g, '""')}"`,
        `"₹${(reg.value || 649).toLocaleString('en-IN')}"`,
        `"${hasScreenshot}"`,
        `"${new Date(reg.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `registrations-list-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded registrations CSV');
  };

  // Extract distinct slots for filter
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
      members.toLowerCase().includes(q) ||
      slot.toLowerCase().includes(q);

    const matchesSlot = slotFilter === 'all' || slot === slotFilter;

    return matchesSearch && matchesSlot;
  });

  // KPI Calculations in INR
  const totalRegistrations = registrations.length;
  const totalAttendees = registrations.reduce((sum, r) => sum + extractHeadcount(r.title), 0);
  const totalPayableRupees = registrations.reduce((sum, r) => sum + (Number(r.value) || 0), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0C2444] via-indigo-700 to-sky-600 text-white flex items-center justify-center shadow-md shadow-[#0C2444]/20 shrink-0">
              <Ticket className="w-6 h-6 text-sky-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Registrations
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Click on any registration to inspect full attendee details and payment screenshot.
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
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-[#0C2444] hover:bg-[#13335c] text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards in Rupees */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center ring-1 ring-indigo-500/10 shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Registrations</p>
              <p className="text-xl font-bold text-slate-900">{totalRegistrations}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center ring-1 ring-sky-500/10 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Members / Headcount</p>
              <p className="text-xl font-bold text-sky-700">{totalAttendees} Seats</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-500/10 shrink-0">
              <span className="text-base font-bold">₹</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Payable Amount</p>
              <p className="text-xl font-bold text-emerald-700">₹{totalPayableRupees.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Search & Slot Filter */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by attendee name, email, phone, slot..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2">
            {allSlots.length > 0 && (
              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Slots ({registrations.length})</option>
                {allSlots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Showing {filteredRegistrations.length} {filteredRegistrations.length === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>

        {/* Read-Only Registrations Display Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Attendee Name</th>
                  <th className="py-3 px-4">Email ID</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">Chosen Slot</th>
                  <th className="py-3 px-4">Total Payable (₹)</th>
                  <th className="py-3 px-4">Payment Proof</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-slate-400" />
                      Loading registrations...
                    </td>
                  </tr>
                ) : filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700">No registrations found</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Submitted data from the registration form will appear here automatically.
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

                    const screenshotUrl = extractScreenshotUrl(reg);

                    // Direct WhatsApp greeting
                    const whatsappMsg = encodeURIComponent(
                      `Hi ${attendeeName}! We have your Bharat Play registration for ${members} (${slot}). Looking forward to having you join us!`
                    );
                    const whatsappLink = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${whatsappMsg}` : null;

                    return (
                      <tr
                        key={reg.id}
                        onClick={() => setSelectedReg(reg)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Attendee Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0C2444] to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {attendeeName[0]?.toUpperCase() || 'A'}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                                {attendeeName}
                              </span>
                              <span className="text-[10px] text-slate-400 block">Click to view details</span>
                            </div>
                          </div>
                        </td>

                        {/* Email ID */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {reg.email ? (
                            <span className="inline-flex items-center space-x-1 text-slate-700">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[150px]">{reg.email}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not provided</span>
                          )}
                        </td>

                        {/* Phone Number */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono">
                          {reg.phone ? (
                            <span className="inline-flex items-center space-x-1 text-slate-700">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{reg.phone}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not provided</span>
                          )}
                        </td>

                        {/* Number of Members */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            <Users className="w-3 h-3 mr-1 text-indigo-500" />
                            {members}
                          </span>
                        </td>

                        {/* Chosen Slot */}
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200/70">
                            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{slot}</span>
                          </div>
                        </td>

                        {/* Total Payable (Rupees) */}
                        <td className="py-3.5 px-4 font-bold text-slate-900 text-xs">
                          ₹{Number(reg.value || 649).toLocaleString('en-IN')}
                        </td>

                        {/* Payment Proof / Screenshot */}
                        <td className="py-3.5 px-4">
                          {screenshotUrl ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedScreenshot(screenshotUrl);
                              }}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-[11px] transition-colors shadow-2xs"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Not attached</span>
                          )}
                        </td>

                        {/* Date Registered */}
                        <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap font-medium">
                          {new Date(reg.created_at).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
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
                                title="Message attendee on WhatsApp"
                                onClick={(e) => e.stopPropagation()}
                                className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({
                                  isOpen: true,
                                  leadId: reg.id,
                                  attendeeName,
                                });
                              }}
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

        {/* =================================================================== */}
        {/* DETAILS BOX MODAL: Displays all submitted registration information */}
        {/* =================================================================== */}
        {selectedReg && (() => {
          const { members, slot } = parseLeadDetails(selectedReg.title);
          const cleanPhone = (selectedReg.phone || '').replace(/[^0-9]/g, '');
          const attendeeName =
            `${selectedReg.first_name || ''} ${selectedReg.last_name || ''}`.trim() ||
            selectedReg.title.split('(')[0]?.replace('Bharat Play:', '').trim() ||
            'Guest';

          const screenshotUrl = extractScreenshotUrl(selectedReg);
          const whatsappMsg = encodeURIComponent(
            `Hi ${attendeeName}! Confirming your Bharat Play registration for ${members} (${slot}). Looking forward to seeing you!`
          );
          const whatsappUrl = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${whatsappMsg}` : null;

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
              onClick={() => setSelectedReg(null)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-w-lg w-full max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-[#0C2444] to-[#15345d] text-white flex items-center justify-between rounded-t-2xl">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {attendeeName[0]?.toUpperCase() || 'A'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white truncate leading-tight">
                        {attendeeName}
                      </h3>
                      <p className="text-[11px] text-sky-200 mt-0.5">
                        Registered: {new Date(selectedReg.created_at).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedReg(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body Details */}
                <div className="p-4 sm:p-6 space-y-4 text-xs">
                  {/* Contact Information Card */}
                  <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Attendee Contact Details
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Email */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] text-slate-400 block font-medium">Email Address</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {selectedReg.email || 'None provided'}
                          </span>
                        </div>
                        {selectedReg.email && (
                          <button
                            onClick={() => handleCopy(selectedReg.email!, 'email')}
                            title="Copy email"
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors shrink-0"
                          >
                            {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] text-slate-400 block font-medium">Phone Number</span>
                          <span className="font-semibold text-slate-800 font-mono truncate block">
                            {selectedReg.phone || 'None provided'}
                          </span>
                        </div>
                        {selectedReg.phone && (
                          <button
                            onClick={() => handleCopy(selectedReg.phone!, 'phone')}
                            title="Copy phone"
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors shrink-0"
                          >
                            {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Direct Reach Out Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      {whatsappUrl && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors text-xs shadow-xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat on WhatsApp</span>
                        </a>
                      )}
                      {selectedReg.phone && (
                        <a
                          href={`tel:${selectedReg.phone}`}
                          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold transition-colors text-xs shadow-xs"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span>Call</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Reservation Details Card */}
                  <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Booking Information
                    </p>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                        <span className="text-[10px] text-slate-400 block font-medium">Number of Members</span>
                        <span className="font-bold text-slate-900 text-sm mt-0.5 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{members}</span>
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                        <span className="text-[10px] text-slate-400 block font-medium">Chosen Time Slot</span>
                        <span className="font-bold text-slate-900 text-xs mt-0.5 flex items-center gap-1 truncate">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          <span>{slot}</span>
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                        <span className="text-[10px] text-slate-400 block font-medium">Total Payable (INR)</span>
                        <span className="font-bold text-emerald-700 text-base mt-0.5 block">
                          ₹{Number(selectedReg.value || 649).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                        <span className="text-[10px] text-slate-400 block font-medium">Registration Status</span>
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 mt-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Confirmed</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Proof Screenshot Section */}
                  <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Payment Proof Screenshot</span>
                      {screenshotUrl && (
                        <span className="text-emerald-700 font-semibold normal-case">
                          Screenshot Attached
                        </span>
                      )}
                    </p>

                    {screenshotUrl ? (
                      <div className="space-y-2">
                        <div
                          onClick={() => setZoomedScreenshot(screenshotUrl)}
                          className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 cursor-zoom-in max-h-56 flex items-center justify-center"
                        >
                          <img
                            src={screenshotUrl}
                            alt="Payment receipt proof"
                            className="max-h-56 w-auto object-contain"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="px-3 py-1.5 rounded-full bg-white text-slate-900 font-bold text-xs flex items-center gap-1 shadow-md">
                              <ZoomIn className="w-3.5 h-3.5 text-slate-700" />
                              <span>Click to enlarge</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-slate-500">
                            Verified UPI / Bank Receipt
                          </span>
                          <a
                            href={screenshotUrl}
                            download={`receipt-${attendeeName.toLowerCase().replace(/\s+/g, '-')}.jpg`}
                            className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download Receipt</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-white border border-slate-200/70 text-center text-slate-400">
                        <ImageIcon className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <p className="text-[11px] font-medium text-slate-600">No Payment Screenshot Uploaded</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">The attendee completed reservation without attaching an image.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer with Delete Button */}
                <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-slate-50 flex items-center justify-between rounded-b-2xl">
                  <span className="text-[11px] text-slate-400 font-mono">ID: {selectedReg.id.slice(0, 8)}...</span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          isOpen: true,
                          leadId: selectedReg.id,
                          attendeeName,
                        })
                      }
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete Registration</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedReg(null)}
                      className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Zoomed Screenshot Fullscreen Lightbox */}
        {zoomedScreenshot && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
            onClick={() => setZoomedScreenshot(null)}
          >
            <div
              className="relative max-w-2xl max-h-[90vh] w-auto flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setZoomedScreenshot(null)}
                className="absolute -top-11 right-0 text-white/80 hover:text-white p-1 text-sm font-semibold flex items-center gap-1"
              >
                <span>Close</span>
                <X className="w-5 h-5" />
              </button>
              <img
                src={zoomedScreenshot}
                alt="Enlarged payment screenshot"
                className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl border-2 border-white/20 bg-slate-950"
              />
            </div>
          </div>
        )}

        {/* Confirmation Dialog for Delete */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title="Delete Registration"
          message={`Are you sure you want to permanently delete the registration record for "${deleteConfirm.attendeeName}"? This action cannot be undone.`}
          confirmText="Delete Registration"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm({ isOpen: false, leadId: '', attendeeName: '' })}
        />
      </div>
    </AppShell>
  );
}
