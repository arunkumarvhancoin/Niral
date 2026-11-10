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
      const supabase = createClient();

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
      const target = registrations.find((r) => r.id === leadId);

      const { error: leadErr } = await supabase.from('leads').delete().eq('id', leadId);
      if (leadErr) {
        toast.error('Failed to delete registration: ' + leadErr.message);
        return;
      }

      if (target?.converted_contact_id) {
        await supabase.from('contacts').delete().eq('id', target.converted_contact_id);
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
      <div className="space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Registrations</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Attendee list and reservation records from Bharat Play workshops.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={loadRegistrations}
              disabled={isLoading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Minimal Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total Bookings</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalRegistrations}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Reserved Seats</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalAttendees} <span className="text-sm font-normal text-slate-500">Attendees</span></p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total Revenue</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">₹{totalPayableRupees.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Search & Slot Filter */}
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, phone, email, or slot..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2">
            {allSlots.length > 0 && (
              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="all">All Slots</option>
                {allSlots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
              {filteredRegistrations.length} {filteredRegistrations.length === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>

        {/* Read-Only Registrations Display Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Attendee Name</th>
                  <th className="py-2.5 px-4">Email ID</th>
                  <th className="py-2.5 px-4">Phone Number</th>
                  <th className="py-2.5 px-4">Members</th>
                  <th className="py-2.5 px-4">Slot</th>
                  <th className="py-2.5 px-4">Payable</th>
                  <th className="py-2.5 px-4">Payment Proof</th>
                  <th className="py-2.5 px-4">Registered (IST)</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      Loading registrations...
                    </td>
                  </tr>
                ) : filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <p className="text-sm font-medium text-slate-600">No registrations found</p>
                      <p className="text-xs text-slate-400 mt-0.5">Attendee submissions will appear here automatically.</p>
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
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        {/* Attendee Name */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {attendeeName}
                          </span>
                        </td>

                        {/* Email ID */}
                        <td className="py-3 px-4 text-slate-600">
                          {reg.email || <span className="text-slate-400">—</span>}
                        </td>

                        {/* Phone Number */}
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {reg.phone || <span className="text-slate-400">—</span>}
                        </td>

                        {/* Number of Members */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800">
                            {members}
                          </span>
                        </td>

                        {/* Chosen Slot */}
                        <td className="py-3 px-4 text-slate-700">
                          {slot}
                        </td>

                        {/* Total Payable (Rupees) */}
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          ₹{Number(reg.value || 649).toLocaleString('en-IN')}
                        </td>

                        {/* Payment Proof / Screenshot */}
                        <td className="py-3 px-4">
                          {screenshotUrl ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedScreenshot(screenshotUrl);
                              }}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                            >
                              <ImageIcon className="w-3 h-3 text-emerald-600" />
                              <span>View Proof</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Date Registered */}
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
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
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {whatsappLink && (
                              <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noreferrer"
                                title="Chat on WhatsApp"
                                onClick={(e) => e.stopPropagation()}
                                className="w-7 h-7 rounded-md text-emerald-700 hover:bg-emerald-50 flex items-center justify-center transition-colors"
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
                              className="w-7 h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
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
        {/* CLEAN DETAILS CARD MODAL (NO SCROLL BAR, POLISHED SAAS DESIGN)     */}
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
                className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden animate-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {attendeeName}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Registered on {new Date(selectedReg.created_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedReg(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body Details */}
                <div className="p-5 space-y-4 text-xs">
                  {/* Two-Column Information List */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-slate-50/70 p-3.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Email Address</span>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="font-medium text-slate-800 truncate">
                          {selectedReg.email || '—'}
                        </span>
                        {selectedReg.email && (
                          <button
                            onClick={() => handleCopy(selectedReg.email!, 'email')}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                            title="Copy email"
                          >
                            {copiedField === 'email' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">Phone Number</span>
                      <div className="flex items-center space-x-1.5 mt-0.5 font-mono">
                        <span className="font-medium text-slate-800 truncate">
                          {selectedReg.phone || '—'}
                        </span>
                        {selectedReg.phone && (
                          <button
                            onClick={() => handleCopy(selectedReg.phone!, 'phone')}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                            title="Copy phone"
                          >
                            {copiedField === 'phone' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">Number of Members</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {members}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">Chosen Time Slot</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                        {slot}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">Total Payable</span>
                      <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                        ₹{Number(selectedReg.value || 649).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">Booking Status</span>
                      <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-emerald-700 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Confirmed</span>
                      </span>
                    </div>
                  </div>

                  {/* Payment Proof Section */}
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 block mb-1.5">
                      Payment Screenshot
                    </span>
                    {screenshotUrl ? (
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div
                          onClick={() => setZoomedScreenshot(screenshotUrl)}
                          className="flex items-center space-x-2.5 cursor-pointer group"
                        >
                          <div className="w-12 h-12 rounded bg-slate-900 overflow-hidden shrink-0 border border-slate-200">
                            <img
                              src={screenshotUrl}
                              alt="Payment screenshot preview"
                              className="w-full h-full object-cover group-hover:opacity-85 transition-opacity"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 text-xs group-hover:text-indigo-600 transition-colors">
                              Click to view full screenshot
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Attached payment proof
                            </p>
                          </div>
                        </div>

                        <a
                          href={screenshotUrl}
                          download={`payment-${attendeeName.toLowerCase().replace(/\s+/g, '-')}.jpg`}
                          className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                        >
                          Download
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded-lg border border-slate-100">
                        No payment screenshot attached
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer with Delete and Actions */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteConfirm({
                        isOpen: true,
                        leadId: selectedReg.id,
                        attendeeName,
                      })
                    }
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center space-x-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Registration</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedReg(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
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
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-100"
            onClick={() => setZoomedScreenshot(null)}
          >
            <div
              className="relative max-w-xl max-h-[88vh] w-auto flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setZoomedScreenshot(null)}
                className="absolute -top-9 right-0 text-white/80 hover:text-white p-1 text-xs font-medium flex items-center gap-1"
              >
                <span>Close</span>
                <X className="w-4 h-4" />
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
