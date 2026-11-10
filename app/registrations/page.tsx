'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { createClient } from '../../lib/supabase/client';
import { Lead } from '../../lib/types/crm';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { isBharatPlay } from '../../lib/permissions';
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
  Ticket,
} from 'lucide-react';

interface RegistrationLead extends Lead {
  contact?: {
    notes?: string | null;
  } | null;
}

export default function RegistrationsPage() {
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
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();
  const { currentOrg, currentRole, currentStatus } = useWorkspace();

  const loadRegistrations = useCallback(async () => {
    if (!currentOrg?.id || !isBharatPlay(currentOrg)) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // 1. Fetch strictly for active organization with user session check
      const res = await fetch(`/api/registrations?orgId=${currentOrg.id}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.registrations)) {
        setRegistrations(json.registrations as RegistrationLead[]);
      } else {
        // Fallback to client Supabase strictly filtered to active org (enforcing RLS)
        const supabase = createClient();
        const { data } = await supabase
          .from('leads')
          .select('*, contact:converted_contact_id(notes)')
          .eq('organization_id', currentOrg.id)
          .order('created_at', { ascending: false });

        setRegistrations((data || []) as RegistrationLead[]);
      }
    } catch (err: any) {
      console.warn('API /api/registrations fallback to direct Supabase:', err);
      try {
        if (currentOrg?.id) {
          const supabase = createClient();
          const { data } = await supabase
            .from('leads')
            .select('*, contact:converted_contact_id(notes)')
            .eq('organization_id', currentOrg.id)
            .order('created_at', { ascending: false });

          setRegistrations((data || []) as RegistrationLead[]);
        }
      } catch (e) {
        toast.error('Failed to load registrations');
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id]);

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

  // Handle delete execution with optimistic feedback
  const handleDeleteConfirm = async () => {
    const { leadId, attendeeName } = deleteConfirm;
    if (!leadId) return;

    setIsDeleting(true);
    // Instant optimistic update: remove immediately so UI feels instantaneous
    const previousRegistrations = registrations;
    setRegistrations((prev) => prev.filter((r) => r.id !== leadId));
    if (selectedReg?.id === leadId) {
      setSelectedReg(null);
    }

    try {
      const orgParam = currentOrg?.id ? `&orgId=${currentOrg.id}` : '';
      const res = await fetch(`/api/registrations?id=${leadId}${orgParam}`, { method: 'DELETE' });
      const json = await res.json();

      if (!json.success) {
        const supabase = createClient();
        const { error: clientDeleteErr } = await supabase.from('leads').delete().eq('id', leadId);
        if (clientDeleteErr) {
          throw new Error(json.error || clientDeleteErr.message);
        }
      }

      toast.success(`Registration for "${attendeeName}" removed`);
      setDeleteConfirm({ isOpen: false, leadId: '', attendeeName: '' });
    } catch (err: any) {
      // Revert if error occurs
      setRegistrations(previousRegistrations);
      toast.error(err.message || 'Error deleting registration');
    } finally {
      setIsDeleting(false);
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

  // Non-Bharat Play organizations do not have access to the registrations module
  if (!isBharatPlay(currentOrg)) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto py-20 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 ring-1 ring-amber-500/20 shadow-xs">
            <Ticket className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Module Not Available</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            The <strong>Registrations</strong> module is a custom workshop integration built exclusively for the <strong>Bharat Play</strong> workspace. It is disabled for <strong>{currentOrg?.name || 'this organization'}</strong>.
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-xs"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Registrations</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
              Attendee list, seat reservations, and payment records from Bharat Play workshops.
            </p>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-2.5">
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-medium transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={loadRegistrations}
              disabled={isLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Metric Cards - 3 columns across all devices */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-white p-3 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Total Bookings</p>
            <p className="text-lg sm:text-3xl font-extrabold text-slate-900 mt-0.5 sm:mt-1.5">{totalRegistrations}</p>
          </div>

          <div className="bg-white p-3 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Reserved Seats</p>
            <p className="text-lg sm:text-3xl font-extrabold text-slate-900 mt-0.5 sm:mt-1.5">
              {totalAttendees} <span className="text-[10px] sm:text-sm font-normal text-slate-500 hidden sm:inline">Attendees</span>
            </p>
          </div>

          <div className="bg-white p-3 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Total Revenue</p>
            <p className="text-lg sm:text-3xl font-extrabold text-slate-900 mt-0.5 sm:mt-1.5 truncate">
              ₹{totalPayableRupees.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Search & Slot Filter */}
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-2xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name, phone, email, or slot..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end space-x-2">
            {allSlots.length > 0 && (
              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
                className="text-xs sm:text-sm px-2.5 py-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="all">All Slots ({registrations.length})</option>
                {allSlots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs sm:text-sm text-slate-500 font-medium whitespace-nowrap">
              {filteredRegistrations.length} {filteredRegistrations.length === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* MOBILE VIEW: High-Craft Registration Cards (Visible on screens < 768px) */}
        {/* =================================================================== */}
        <div className="block md:hidden space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200/90">
              Loading registrations...
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200/90 p-6">
              <p className="text-base font-semibold text-slate-700">No registrations found</p>
              <p className="text-xs text-slate-400 mt-1">Attendee submissions will appear here automatically.</p>
            </div>
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
                <div
                  key={reg.id}
                  onClick={() => setSelectedReg(reg)}
                  className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs active:scale-[0.99] transition-all cursor-pointer"
                >
                  {/* Card Header: Initial, Name, and Total Price */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {attendeeName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                          {attendeeName}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(reg.created_at).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-extrabold text-slate-900">
                        ₹{Number(reg.value || 649).toLocaleString('en-IN')}
                      </div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {members}
                      </span>
                    </div>
                  </div>

                  {/* Slot & Payment Proof Bar */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5 text-slate-700 font-medium truncate">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{slot}</span>
                    </div>

                    {screenshotUrl ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomedScreenshot(screenshotUrl);
                        }}
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold text-emerald-700 bg-emerald-50 active:bg-emerald-100 shrink-0"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>View Proof</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs italic">No proof</span>
                    )}
                  </div>

                  {/* Contact Info & One-Tap Actions Footer */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono truncate max-w-[150px]">
                      {reg.phone || reg.email || '—'}
                    </span>

                    <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      {cleanPhone && (
                        <a
                          href={`tel:${cleanPhone}`}
                          className="h-8 px-2.5 rounded-lg bg-slate-900 text-white font-medium text-xs inline-flex items-center gap-1 active:bg-slate-800"
                          title={`Call ${attendeeName}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>
                      )}
                      {whatsappLink && (
                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 px-2.5 rounded-lg bg-emerald-600 text-white font-medium text-xs inline-flex items-center gap-1 active:bg-emerald-700"
                          title={`WhatsApp ${attendeeName}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WA</span>
                        </a>
                      )}
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            isOpen: true,
                            leadId: reg.id,
                            attendeeName,
                          })
                        }
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                        title="Delete registration"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* =================================================================== */}
        {/* DESKTOP VIEW: Read-Only Table (Visible on screens >= 768px)          */}
        {/* =================================================================== */}
        <div className="hidden md:block bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
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
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-start justify-between shrink-0">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight truncate">
                      {attendeeName}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      Registered on {new Date(selectedReg.created_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedReg(null)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body Details */}
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {/* Information List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-3 sm:gap-y-4 bg-slate-50/80 p-3.5 sm:p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide block">Email Address</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                          {selectedReg.email || '—'}
                        </span>
                        {selectedReg.email && (
                          <button
                            onClick={() => handleCopy(selectedReg.email!, 'email')}
                            className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                            title="Copy email"
                          >
                            {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide block">Phone Number</span>
                      <div className="flex items-center space-x-2 mt-1 font-mono">
                        <span className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                          {selectedReg.phone || '—'}
                        </span>
                        {selectedReg.phone && (
                          <button
                            onClick={() => handleCopy(selectedReg.phone!, 'phone')}
                            className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                            title="Copy phone"
                          >
                            {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {cleanPhone && (
                          <a
                            href={`tel:${cleanPhone}`}
                            className="text-xs text-sky-600 hover:text-sky-800 font-semibold inline-flex items-center gap-1 ml-1 shrink-0"
                            title="Call phone"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide block">Number of Members</span>
                      <span className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 block">
                        {members}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide block">Chosen Slot</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 mt-0.5 block truncate">
                        {slot}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide block">Total Payable</span>
                      <span className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5 block">
                        ₹{Number(selectedReg.value || 649).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide block">Booking Status</span>
                      <span className="inline-flex items-center space-x-1.5 text-xs sm:text-sm font-semibold text-emerald-700 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                        <span>Confirmed</span>
                      </span>
                    </div>
                  </div>

                  {/* Payment Proof Section */}
                  <div>
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                      Payment Screenshot
                    </span>
                    {screenshotUrl ? (
                      <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl gap-2">
                        <div
                          onClick={() => setZoomedScreenshot(screenshotUrl)}
                          className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer group min-w-0"
                        >
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-slate-900 overflow-hidden shrink-0 border border-slate-200">
                            <img
                              src={screenshotUrl}
                              alt="Payment screenshot preview"
                              className="w-full h-full object-cover group-hover:opacity-85 transition-opacity"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-xs sm:text-sm group-hover:text-indigo-600 transition-colors truncate">
                              Tap to view screenshot
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              Attached payment proof
                            </p>
                          </div>
                        </div>

                        <a
                          href={screenshotUrl}
                          download={`payment-${attendeeName.toLowerCase().replace(/\s+/g, '-')}.jpg`}
                          className="text-xs text-slate-700 hover:text-slate-900 font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs shrink-0"
                        >
                          Download
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-100">
                        No payment screenshot attached
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer with Direct Call, WhatsApp, and Delete Actions */}
                <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/90 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteConfirm({
                        isOpen: true,
                        leadId: selectedReg.id,
                        attendeeName,
                      })
                    }
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors inline-flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Delete</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {cleanPhone && (
                      <a
                        href={`tel:${cleanPhone}`}
                        className="inline-flex items-center space-x-1 px-3 sm:px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs"
                      >
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>Call</span>
                      </a>
                    )}
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-3 sm:px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedReg(null)}
                      className="px-3 sm:px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-colors"
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
          isLoading={isDeleting}
          loadingText="Deleting..."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm({ isOpen: false, leadId: '', attendeeName: '' })}
        />
      </div>
    </AppShell>
  );
}
