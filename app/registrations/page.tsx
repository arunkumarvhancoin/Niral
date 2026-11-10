'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { createClient } from '../../lib/supabase/client';
import { Lead } from '../../lib/types/crm';
import { toast } from '../../lib/stores/toast-store';
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
  ExternalLink,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Filter,
  Sparkles,
} from 'lucide-react';

const WEBHOOK_URL = 'https://niral-crm.vercel.app/api/webhooks/bharat-play';

export default function RegistrationsPage() {
  const { currentOrg } = useWorkspace();
  const [registrations, setRegistrations] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [slotFilter, setSlotFilter] = useState('all');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const loadRegistrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      // Query all registrations (collected leads for workshops/events)
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .or('company.eq.Bharat Play,source.eq.Event,title.ilike.Bharat Play%')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching registrations:', error);
        toast.error('Failed to load registrations');
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
      'Email ID',
      'Phone Number',
      'Number of Members',
      'Chosen Slot',
      'Total Payable (INR)',
      'Date & Time Registered (IST)',
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
        `"₹${(reg.value || 649).toLocaleString('en-IN')}"`,
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

  // KPI Calculations
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
                Collection of registration data, slot reservations, and attendee records.
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

        {/* Live Ingestion Source Card */}
        <div className="bg-gradient-to-r from-[#0C2444] via-[#122e54] to-[#1a3f72] text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-sky-300 bg-white/10 px-2 py-0.5 rounded">
                  Connected Source
                </span>
                <span className="text-xs text-sky-100 font-medium">Automatic ingestion from registration forms</span>
              </div>
              <p className="text-xs font-mono text-sky-200 bg-black/30 px-3 py-1.5 rounded-lg inline-block border border-white/10 break-all select-all">
                {WEBHOOK_URL}
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleCopyWebhookUrl}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/15 transition-colors"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy Endpoint'}</span>
              </button>
              <a
                href="https://bharatplay.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/15 transition-colors"
              >
                <span>Visit Form</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
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
              placeholder="Search by full name, email, phone, slot..."
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
                  <th className="py-3 px-4">Registered Date & Time</th>
                  <th className="py-3 px-4 text-right">Reach Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-slate-400" />
                      Loading registrations...
                    </td>
                  </tr>
                ) : filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
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

                    // Direct WhatsApp greeting
                    const whatsappMsg = encodeURIComponent(
                      `Hi ${attendeeName}! We have your Bharat Play registration for ${members} (${slot}). Looking forward to having you join us!`
                    );
                    const whatsappLink = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${whatsappMsg}` : null;

                    return (
                      <tr key={reg.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Attendee Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0C2444] to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {attendeeName[0]?.toUpperCase() || 'A'}
                            </div>
                            <span className="font-semibold text-slate-900 leading-snug">
                              {attendeeName}
                            </span>
                          </div>
                        </td>

                        {/* Email ID */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {reg.email ? (
                            <a
                              href={`mailto:${reg.email}`}
                              className="inline-flex items-center space-x-1 text-slate-700 hover:text-indigo-600 transition-colors"
                            >
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{reg.email}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Not provided</span>
                          )}
                        </td>

                        {/* Phone Number */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono">
                          {reg.phone ? (
                            <a
                              href={`tel:${reg.phone}`}
                              className="inline-flex items-center space-x-1 text-slate-700 hover:text-indigo-600 transition-colors"
                            >
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{reg.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Not provided</span>
                          )}
                        </td>

                        {/* Number of Members */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
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

                        {/* Contact Actions (Read-Only reach out links) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {whatsappLink && (
                              <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noreferrer"
                                title="Message attendee on WhatsApp"
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
      </div>
    </AppShell>
  );
}
