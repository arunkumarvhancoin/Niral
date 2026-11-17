'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService, DashboardMetrics, parseNumericValue } from '../../lib/services/crm-service';
import { isBharatPlay } from '../../lib/permissions';
import {
  Users2,
  Target,
  BarChart3,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowUpRight,
  Ticket,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const {
    currentOrg,
    currentRole,
    effectiveOrgIds,
    isSuperAdmin: isSuper,
    isAllOrgsSelected,
    isMultiOrgActive,
    memberships,
    isLoading: workspaceLoading,
  } = useWorkspace();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const orgIdsKey = effectiveOrgIds.join(',');

  useEffect(() => {
    if (effectiveOrgIds.length === 0) return;

    let isMounted = true;
    setMetrics(null);
    setIsLoading(true);

    CRMService.getDashboardMetrics(effectiveOrgIds)
      .then((data) => {
        if (isMounted) {
          setMetrics(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load dashboard metrics for orgs:', effectiveOrgIds, err);
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [orgIdsKey]);

  const formatCurrency = (amount: number | string | null | undefined) => {
    const num = parseNumericValue(amount);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const showOrgBadge = isSuper || effectiveOrgIds.length > 1;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[#171B26]">Dashboard</h1>
              {isSuper && isMultiOrgActive ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0F4FE] text-[#3659C9] border border-[#C7D6F5]">
                  {isAllOrgsSelected ? `All ${memberships.length} Organizations` : `${effectiveOrgIds.length} Organizations`}
                </span>
              ) : currentOrg?.name ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0F4FE] text-[#3659C9] border border-[#C7D6F5]">
                  {currentOrg.name}
                </span>
              ) : null}
            </div>
            <p className="text-[13px] text-[#697386] mt-0.5">
              {isSuper && isMultiOrgActive
                ? `Unified overview and pipeline metrics across ${isAllOrgsSelected ? 'all organizations' : `${effectiveOrgIds.length} selected organizations`}.`
                : currentOrg?.name
                ? `Overview and pipeline metrics for ${currentOrg.name}.`
                : 'Overview and pipeline metrics.'}
            </p>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            <Link
              href="/contacts?new=true"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md border border-[#E7EAF0] bg-white hover:bg-[#F1F3F7] text-[#171B26] text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#697386]" />
              <span>Add Contact</span>
            </Link>
            <Link
              href="/deals?new=true"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#3659C9] hover:bg-[#2B47A1] text-white text-[13px] font-medium shadow-[0_1px_2px_rgba(54,89,201,0.2)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Deal</span>
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Contacts */}
          <Link
            href="/contacts"
            className="group bg-white p-4 sm:p-5 rounded-xl border border-blue-100 shadow-xs hover:border-blue-300 transition-all block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Contacts</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center justify-center transition-colors">
                <Users2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-[26px] font-bold text-slate-900 mt-2 tracking-tight tabular-nums">
              {isLoading ? '...' : metrics?.totalContacts || 0}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span>Active directory</span>
              <span className="text-primary-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                View &rarr;
              </span>
            </div>
          </Link>

          {/* Total Leads & Conversion */}
          <Link
            href="/leads"
            className="group bg-white p-4 sm:p-5 rounded-xl border border-purple-100 shadow-xs hover:border-purple-300 transition-all block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Leads</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-200/70 flex items-center justify-center transition-colors">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-[26px] font-bold text-slate-900 mt-2 tracking-tight tabular-nums">
              {isLoading ? '...' : metrics?.totalLeads || 0}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold text-[11px] border border-purple-200">
                {metrics?.leadConversionRate || 0}% converted
              </span>
              <span className="text-primary-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                Manage &rarr;
              </span>
            </div>
          </Link>

          {/* Pipeline Revenue */}
          <Link
            href="/deals"
            className="group bg-white p-4 sm:p-5 rounded-xl border border-amber-100 shadow-xs hover:border-amber-300 transition-all block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Open Pipeline</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center transition-colors">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-[26px] font-bold text-slate-900 mt-2 tracking-tight tabular-nums">
              {isLoading ? '...' : formatCurrency(metrics?.pipelineRevenue || 0)}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span className="text-slate-700 font-medium">{metrics?.openDeals || 0} in progress</span>
              <span className="text-primary-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                Pipeline &rarr;
              </span>
            </div>
          </Link>

          {/* Won Revenue */}
          <Link
            href="/deals"
            className="group bg-white p-4 sm:p-5 rounded-xl border border-emerald-100 shadow-xs hover:border-emerald-300 transition-all block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Won Revenue</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/70 flex items-center justify-center transition-colors">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-[26px] font-bold text-emerald-600 mt-2 tracking-tight tabular-nums">
              {isLoading ? '...' : formatCurrency(metrics?.wonRevenue || 0)}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-200">
                {metrics?.closedDeals || 0} deals won
              </span>
              <span className="text-primary-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                Review &rarr;
              </span>
            </div>
          </Link>
        </div>

        {/* Two-Column CRM Snapshot */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Upcoming Tasks */}
          <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7EAF0]">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#3659C9]" />
                <h3 className="font-semibold text-[#171B26] text-[14px]">Action Items</h3>
              </div>
              <Link href="/tasks" className="text-xs text-[#3659C9] hover:underline font-medium flex items-center">
                <span>View all</span>
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>

            <div className="divide-y divide-[#E7EAF0] mt-1">
              {metrics?.upcomingTasks?.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#697386]">
                  <CheckCircle2 className="w-7 h-7 text-[#BAC0CE] mx-auto mb-2" />
                  No pending action items for this workspace
                </div>
              ) : (
                metrics?.upcomingTasks?.map((task) => (
                  <div key={task.id} className="py-2.5 flex items-start justify-between hover:bg-[#F8F9FB] rounded px-1.5 -mx-1.5 transition-colors">
                    <div>
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <p className="text-[13px] font-medium text-[#171B26]">{task.title}</p>
                        {showOrgBadge && task.organization?.name && (
                          <span className="text-[10px] text-[#697386] font-medium bg-[#F7F8FA] border border-[#E7EAF0] px-1.5 py-0.2 rounded">
                            {task.organization.name}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#697386] mt-0.5 line-clamp-1">{task.description || 'No description provided'}</p>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${
                        task.priority === 'urgent'
                          ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                          : task.priority === 'high'
                          ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                          : task.priority === 'medium'
                          ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                          : 'bg-[#F7F8FA] text-[#697386] border-[#E7EAF0]'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Deals for standard CRM workspaces, or Recent Registrations for Bharat Play */}
          {isBharatPlay(currentOrg) ? (
            <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 sm:p-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7EAF0]">
                <div className="flex items-center space-x-2">
                  <Ticket className="w-4 h-4 text-[#5B21B6]" />
                  <h3 className="font-semibold text-[#171B26] text-[14px]">Recent Registrations</h3>
                </div>
                <Link href="/registrations" className="text-xs text-[#3659C9] hover:underline font-medium flex items-center">
                  <span>View all</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </div>

              <div className="divide-y divide-[#E7EAF0] mt-1">
                {!metrics?.recentRegistrations || metrics?.recentRegistrations.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#697386]">
                    <Ticket className="w-7 h-7 text-[#BAC0CE] mx-auto mb-2" />
                    No registrations recorded yet
                  </div>
                ) : (
                  metrics.recentRegistrations.map((reg) => {
                    const attendeeName = reg.contact?.first_name
                      ? `${reg.contact.first_name} ${reg.contact.last_name || ''}`.trim()
                      : reg.title || 'Attendee';

                    return (
                      <div key={reg.id} className="py-2.5 flex items-start justify-between hover:bg-[#F8F9FB] rounded px-1.5 -mx-1.5 transition-colors">
                        <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded bg-[#F5F3FF] text-[#5B21B6] border border-[#DDD6FE] flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Ticket className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <p className="text-[13px] font-medium text-[#171B26] truncate">{attendeeName}</p>
                              {showOrgBadge && reg.organization?.name && (
                                <span className="text-[10px] text-[#697386] font-medium bg-[#F7F8FA] border border-[#E7EAF0] px-1.5 py-0.2 rounded">
                                  {reg.organization.name}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-[#697386] mt-0.5 truncate">{reg.contact?.email || reg.source || 'Direct Registration'}</p>
                            <span className="text-[11px] text-[#9AA2B1] mt-0.5 block tabular-nums">
                              {new Date(reg.created_at).toLocaleDateString()} &bull;{' '}
                              {new Date(reg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <span className="text-[13px] font-medium text-[#171B26] block tabular-nums">
                            {reg.value ? formatCurrency(reg.value) : '—'}
                          </span>
                          <span className="inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] capitalize">
                            {reg.status || 'Registered'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 sm:p-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7EAF0]">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-[#3659C9]" />
                  <h3 className="font-semibold text-[#171B26] text-[14px]">Recent Deals</h3>
                </div>
                <Link href="/deals" className="text-xs text-[#3659C9] hover:underline font-medium flex items-center">
                  <span>View pipeline</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </div>

              <div className="divide-y divide-[#E7EAF0] mt-1">
                {!metrics?.recentDeals || metrics?.recentDeals.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#697386]">
                    <BarChart3 className="w-7 h-7 text-[#BAC0CE] mx-auto mb-2" />
                    No deals created yet
                  </div>
                ) : (
                  metrics.recentDeals.map((deal) => (
                    <div key={deal.id} className="py-2.5 flex items-start justify-between hover:bg-[#F8F9FB] rounded px-1.5 -mx-1.5 transition-colors">
                      <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                        <div className="w-6 h-6 rounded bg-[#F0F4FE] text-[#3659C9] border border-[#C7D6F5] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <BarChart3 className="w-3 h-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <p className="text-[13px] font-medium text-[#171B26] truncate">{deal.name}</p>
                            {showOrgBadge && deal.organization?.name && (
                              <span className="text-[10px] text-[#697386] font-medium bg-[#F7F8FA] border border-[#E7EAF0] px-1.5 py-0.2 rounded">
                                {deal.organization.name}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#9AA2B1] mt-0.5 block tabular-nums">
                            {new Date(deal.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <span className="text-[13px] font-medium text-[#171B26] block tabular-nums">
                          {deal.value ? formatCurrency(deal.value) : '—'}
                        </span>
                        <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded capitalize ${
                          deal.status === 'won'
                            ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                            : deal.status === 'lost'
                            ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                            : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                        }`}>
                          {deal.status || 'Open'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

