'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService, DashboardMetrics } from '../../lib/services/crm-service';
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
  const { currentOrg, currentRole, isLoading: workspaceLoading } = useWorkspace();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg?.id) return;

    let isMounted = true;
    // Instantly wipe old metrics to avoid any stale data display from previous organization
    setMetrics(null);
    setIsLoading(true);

    CRMService.getDashboardMetrics(currentOrg.id)
      .then((data) => {
        if (isMounted) {
          setMetrics(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load dashboard metrics for org:', currentOrg.id, err);
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentOrg?.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Dashboard
              </h1>
              {currentOrg?.name && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200/80">
                  {currentOrg.name}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {currentOrg?.name ? `Overview and pipeline metrics for ${currentOrg.name}.` : 'Overview and pipeline metrics.'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/contacts?new=true"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Contact</span>
            </Link>
            <Link
              href="/deals?new=true"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Deal</span>
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Contacts */}
          <Link
            href="/contacts"
            className="group bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all block relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Contacts</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center ring-1 ring-blue-500/10 group-hover:scale-110 transition-transform">
                <Users2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {isLoading ? '...' : metrics?.totalContacts || 0}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span>Active directory</span>
              <span className="text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center">
                View &rarr;
              </span>
            </div>
          </Link>

          {/* Total Leads & Conversion */}
          <Link
            href="/leads"
            className="group bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-purple-300 transition-all block relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-violet-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Leads</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center ring-1 ring-purple-500/10 group-hover:scale-110 transition-transform">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {isLoading ? '...' : metrics?.totalLeads || 0}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold text-[10px]">
                {metrics?.leadConversionRate || 0}% converted
              </span>
              <span className="text-purple-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center">
                Manage &rarr;
              </span>
            </div>
          </Link>

          {/* Pipeline Revenue */}
          <Link
            href="/deals"
            className="group bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-amber-300 transition-all block relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Pipeline</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center ring-1 ring-amber-500/10 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {isLoading ? '...' : formatCurrency(metrics?.pipelineRevenue || 0)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span className="text-amber-800 font-medium">{metrics?.openDeals || 0} in progress</span>
              <span className="text-amber-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center">
                Pipeline &rarr;
              </span>
            </div>
          </Link>

          {/* Won Revenue */}
          <Link
            href="/deals"
            className="group bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all block relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Won Revenue</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-500/10 group-hover:scale-110 transition-transform">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-2">
              {isLoading ? '...' : formatCurrency(metrics?.wonRevenue || 0)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                {metrics?.closedDeals || 0} deals won
              </span>
              <span className="text-emerald-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center">
                Review &rarr;
              </span>
            </div>
          </Link>
        </div>

        {/* Two-Column CRM Snapshot */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Tasks */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">Action Items</h3>
              </div>
              <Link href="/tasks" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center">
                <span>View all</span>
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-1">
              {metrics?.upcomingTasks?.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  No pending action items for this workspace
                </div>
              ) : (
                metrics?.upcomingTasks?.map((task) => (
                  <div key={task.id} className="py-3 flex items-start justify-between hover:bg-slate-50/50 rounded-lg px-2 -mx-2 transition-colors">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{task.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{task.description || 'No description provided'}</p>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                        task.priority === 'urgent'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : task.priority === 'high'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : task.priority === 'medium'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-50 text-slate-600 border border-slate-200'
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
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">Recent Registrations</h3>
                </div>
                <Link href="/registrations" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center">
                  <span>View all</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </div>

              <div className="divide-y divide-slate-100 mt-1">
                {!metrics?.recentRegistrations || metrics?.recentRegistrations.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <Ticket className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    No registrations recorded yet
                  </div>
                ) : (
                  metrics.recentRegistrations.map((reg) => {
                    const attendeeName = reg.contact?.first_name
                      ? `${reg.contact.first_name} ${reg.contact.last_name || ''}`.trim()
                      : reg.title || 'Attendee';

                    return (
                      <div key={reg.id} className="py-3 flex items-start justify-between hover:bg-slate-50/50 rounded-lg px-2 -mx-2 transition-colors">
                        <div className="flex items-start space-x-3 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-purple-500/10">
                            <Ticket className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{attendeeName}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{reg.contact?.email || reg.source || 'Direct Registration'}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {new Date(reg.created_at).toLocaleDateString()} &bull;{' '}
                              {new Date(reg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <span className="text-xs font-bold text-slate-900 block">
                            {reg.value ? formatCurrency(reg.value) : '—'}
                          </span>
                          <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
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
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">Recent Deals</h3>
                </div>
                <Link href="/deals" className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center">
                  <span>View pipeline</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </div>

              <div className="divide-y divide-slate-100 mt-1">
                {!metrics?.recentDeals || metrics?.recentDeals.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <BarChart3 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    No deals created yet
                  </div>
                ) : (
                  metrics.recentDeals.map((deal) => (
                    <div key={deal.id} className="py-3 flex items-start justify-between hover:bg-slate-50/50 rounded-lg px-2 -mx-2 transition-colors">
                      <div className="flex items-start space-x-3 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-amber-500/10">
                          <BarChart3 className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{deal.name}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(deal.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-900 block">
                          {deal.value ? formatCurrency(deal.value) : '—'}
                        </span>
                        <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${
                          deal.status === 'won'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : deal.status === 'lost'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
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

