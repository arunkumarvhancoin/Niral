'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { createClient } from '../../lib/supabase/client';
import { Lead } from '../../lib/types/crm';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import {
  Search,
  Users,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  Download,
  RefreshCw,
  X,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  Copy,
  Check,
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

  // Selected registration for the details modal
  const [selectedReg, setSelectedReg] = useState<RegistrationLead | null>(null);

  // Enlarged preview of payment screenshot
  const [zoomedScreenshot, setZoomedScreenshot] = useState<string | null>(null);

  // Copy feedback state
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
      // 1. Fetch from server API endpoint (uses admin client, completely bypasses RLS)
      const res = await fetch('/api/registrations');
      const json = await res.json();

      if (json.success && Array.isArray(json.registrations)) {
        setRegistrations(json.registrations as RegistrationLead[]);
      } else {
        // Fallback to client Supabase if API is unavailable
        const supabase = createClient();
        const { data } = await supabase
          .from('leads')
          .select('*, contact:converted_contact_id(notes)')
          .or('company.eq.Bharat Play,source.eq.Event,title.ilike.Bharat Play%')
          .order('created_at', { ascending: false });

        setRegistrations((data || []) as RegistrationLead[]);
      }
    } catch (err: any) {
      console.warn('API /api/registrations fallback to direct Supabase:', err);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('leads')
          .select('*, contact:converted_contact_id(notes)')
          .or('company.eq.Bharat Play,source.eq.Event,title.ilike.Bharat Play%')
          .order('created_at', { ascending: false });

        setRegistrations((data || []) as RegistrationLead[]);
      } catch (e) {
        toast.error('Failed to load registrations');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  // Helper to extract slot and member info from lead title
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
      const res = await fetch(`/api/registrations?id=${leadId}`, { method: 'DELETE' });
      const json = await res.json();

      if (!json.success) {
        const supabase = createClient();
        await supabase.from('leads').delete().eq('id', leadId);
      }

      setRegistrations((prev) => prev.filter((r) => r.id !== leadId));
      if (selectedReg?.id === leadId) {
        setSelectedReg(null);
      }
      toast.success(`Registration for "${attendeeName}" removed`);
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
      toast.success(`Copied to clipboard`);
      setTimeout(() => setCopiedField(null), 1800);
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
    link.setAttribute('download', `registrations-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded CSV');
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Registrations</h1>
            <p className="text-sm text-slate-500 mt-1">
              Attendee list, seat reservations, and payment records from Bharat Play workshops.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={loadRegistrations}
              disabled={isLoading}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Bookings</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1.5">{totalRegistrations}</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reserved Seats</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1.5">
              {totalAttendees} <span className="text-base font-normal text-slate-500">Attendees</span>
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Revenue</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1.5">
              ₹{totalPayableRupees.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Search & Slot Filter */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, phone, email, or slot..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2.5">
            {allSlots.length > 0 && (
              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
                className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="all">All Time Slots ({registrations.length})</option>
                {allSlots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            <span className="text-sm text-slate-500 font-medium whitespace-nowrap">
              {filteredRegistrations.length} {filteredRegistrations.length === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>

        {/* Read-Only Registrations Display Table */}
        <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Attendee Name</th>
                  <th className="py-3 px-4">Email ID</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">Slot</th>
                  <th className="py-3 px-4">Payable</th>
                  <th className="py-3 px-4">Payment Proof</th>
                  <th className="py-3 px-4">Date & Time (IST)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                      Loading registrations...
                    </td>
                  </tr>
                ) : filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-14 text-center text-slate-400">
                      <p className="text-base font-medium text-slate-700">No registrations found</p>
                      <p className="text-sm text-slate-400 mt-1">Attendee submissions will appear here automatically.</p>
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

                    const whatsappMsg = encodeURIComponent(
                      `Hi ${attendeeName}! We have your Bharat Play registration for ${members} (${slot}). Looking forward to seeing you!`
                    );
                    const whatsappLink = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${whatsappMsg}` : null;

                    return (
                      <tr
                        key={reg.id}
                        onClick={() => setSelectedReg(reg)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Attendee Name */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {attendeeName}
                        </td>

                        {/* Email ID */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {reg.email || <span className="text-slate-400">—</span>}
                        </td>

                        {/* Phone Number */}
                        <td className="py-3.5 px-4 text-slate-700 font-mono">
                          {reg.phone || <span className="text-slate-400">—</span>}
                        </td>

                        {/* Number of Members */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800">
                            {members}
                          </span>
                        </td>

                        {/* Chosen Slot */}
                        <td className="py-3.5 px-4 text-slate-800 font-medium">
                          {slot}
                        </td>

                        {/* Total Payable (Rupees) */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
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
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                              <span>View Proof</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Date Registered */}
                        <td className="py-3.5 px-4 text-slate-500 text-xs whitespace-nowrap">
                          {new Date(reg.created_at).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        {/* Actions: Call, WhatsApp, Delete */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {cleanPhone && (
                              <a
                                href={`tel:${cleanPhone}`}
                                title={`Call ${attendeeName}`}
                                onClick={(e) => e.stopPropagation()}
                                className="w-8 h-8 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors"
                              >
                                <Phone className="w-4 h-4 text-slate-600" />
                              </a>
                            )}
                            {whatsappLink && (
                              <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noreferrer"
                                title={`WhatsApp ${attendeeName}`}
                                onClick={(e) => e.stopPropagation()}
                                className="w-8 h-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 flex items-center justify-center transition-colors"
                              >
                                <MessageSquare className="w-4 h-4" />
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
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
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
        {/* DETAILS CARD MODAL (LARGER FONT SIZE, DIRECT CALL FEATURE, NO SCROLLBAR) */}
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
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100"
              onClick={() => setSelectedReg(null)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden animate-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">
                      {attendeeName}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Registered on {new Date(selectedReg.created_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedReg(null)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body Details */}
                <div className="p-6 space-y-5">
                  {/* Two-Column Information List */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Email Address</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {selectedReg.email || '—'}
                        </span>
                        {selectedReg.email && (
                          <button
                            onClick={() => handleCopy(selectedReg.email!, 'email')}
                            className="text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copy email"
                          >
                            {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Phone Number</span>
                      <div className="flex items-center space-x-2 mt-1 font-mono">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {selectedReg.phone || '—'}
                        </span>
                        {selectedReg.phone && (
                          <button
                            onClick={() => handleCopy(selectedReg.phone!, 'phone')}
                            className="text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copy phone"
                          >
                            {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {cleanPhone && (
                          <a
                            href={`tel:${cleanPhone}`}
                            className="text-xs text-sky-600 hover:text-sky-800 font-semibold inline-flex items-center gap-1 ml-1"
                            title="Call phone"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Number of Members</span>
                      <span className="text-base font-bold text-slate-900 mt-1 block">
                        {members}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Chosen Slot</span>
                      <span className="text-sm font-semibold text-slate-900 mt-1 block truncate">
                        {slot}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Total Payable</span>
                      <span className="text-lg font-extrabold text-slate-900 mt-1 block">
                        ₹{Number(selectedReg.value || 649).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Booking Status</span>
                      <span className="inline-flex items-center space-x-1.5 text-sm font-semibold text-emerald-700 mt-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Confirmed</span>
                      </span>
                    </div>
                  </div>

                  {/* Payment Proof Section */}
                  <div>
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                      Payment Screenshot
                    </span>
                    {screenshotUrl ? (
                      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div
                          onClick={() => setZoomedScreenshot(screenshotUrl)}
                          className="flex items-center space-x-3 cursor-pointer group"
                        >
                          <div className="w-14 h-14 rounded-lg bg-slate-900 overflow-hidden shrink-0 border border-slate-200">
                            <img
                              src={screenshotUrl}
                              alt="Payment screenshot preview"
                              className="w-full h-full object-cover group-hover:opacity-85 transition-opacity"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                              Click to view full screenshot
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Attached payment verification proof
                            </p>
                          </div>
                        </div>

                        <a
                          href={screenshotUrl}
                          download={`payment-${attendeeName.toLowerCase().replace(/\s+/g, '-')}.jpg`}
                          className="text-xs text-slate-700 hover:text-slate-900 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          Download
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-100">
                        No payment screenshot attached
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer with Direct Call, WhatsApp, and Delete Actions */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteConfirm({
                        isOpen: true,
                        leadId: selectedReg.id,
                        attendeeName,
                      })
                    }
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg text-sm font-semibold transition-colors inline-flex items-center space-x-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Registration</span>
                  </button>

                  <div className="flex items-center space-x-2.5">
                    {cleanPhone && (
                      <a
                        href={`tel:${cleanPhone}`}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors shadow-xs"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Call</span>
                      </a>
                    )}
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-xs"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedReg(null)}
                      className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Zoomed Screenshot Lightbox */}
        {zoomedScreenshot && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-100"
            onClick={() => setZoomedScreenshot(null)}
          >
            <div
              className="relative max-w-xl max-h-[88vh] w-auto flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setZoomedScreenshot(null)}
                className="absolute -top-9 right-0 text-white/80 hover:text-white p-1 text-sm font-medium flex items-center gap-1"
              >
                <span>Close</span>
                <X className="w-5 h-5" />
              </button>
              <img
                src={zoomedScreenshot}
                alt="Enlarged payment screenshot"
                className="max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl border border-white/10 bg-slate-900"
              />
            </div>
          </div>
        )}

        {/* Confirmation Dialog for Delete */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title="Delete Registration"
          message={`Are you sure you want to delete the registration record for "${deleteConfirm.attendeeName}"?`}
          confirmText="Delete"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm({ isOpen: false, leadId: '', attendeeName: '' })}
        />
      </div>
    </AppShell>
  );
}
