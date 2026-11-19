'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useWorkspace } from '../components/providers/workspace-provider';
import {
  Target,
  Headphones,
  Receipt,
  Users,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  Check,
  Building2,
  Lock,
  Layers,
  ChevronRight,
  Database,
  Cpu,
  Clock,
} from 'lucide-react';

export default function RootLandingPage() {
  const { currentUser, isLoading } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'crm' | 'desk' | 'books' | 'people' | 'analytics'>('crm');

  const suiteApps = [
    {
      id: 'crm',
      name: 'Niral CRM',
      category: 'Revenue Operations',
      status: 'Live Now',
      isLive: true,
      tagline: 'Multi-tenant sales pipelines, contact intelligence & contextual task orchestration.',
      badge: 'Production Ready',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      icon: Target,
      href: '/onboarding?from=/',
      cta: 'Launch CRM Workspace',
      metrics: [
        { label: 'Pipeline Velocity', val: 'Sub-second' },
        { label: 'Record Linking', val: 'Leads, Contacts & Deals' },
        { label: 'Architecture', val: 'Multi-Tenant RLS' },
      ],
      highlights: [
        'Interactive stage pipelines with drag & filter capabilities',
        'Tasks directly anchored to Leads, Contacts, and Deals',
        'Multi-tenant workspace isolation with role-based governance',
        'Super Admin multi-organization consolidated oversight',
      ],
    },
    {
      id: 'desk',
      name: 'Niral Desk',
      category: 'Customer Support',
      status: 'In Development',
      isLive: false,
      tagline: 'Unified omnichannel customer inbox, automated SLA routing, and priority triage.',
      badge: 'Coming Soon',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: Headphones,
      href: '#',
      cta: 'Coming Soon',
      metrics: [
        { label: 'Channels', val: 'Email, Chat, Web' },
        { label: 'Routing', val: 'Skill & SLA Based' },
        { label: 'Sync', val: 'Shared CRM Profiles' },
      ],
      highlights: [
        'Shared agent queues with conflict collision detection',
        'Contextual CRM contact history embedded in ticket threads',
        'Automated priority escalations and customer satisfaction scoring',
      ],
    },
    {
      id: 'books',
      name: 'Niral Books',
      category: 'Billing & Accounting',
      status: 'In Development',
      isLive: false,
      tagline: 'Automated recurring billing, GST-compliant e-invoicing, and payment reconciliations.',
      badge: 'Coming Soon',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: Receipt,
      href: '#',
      cta: 'Coming Soon',
      metrics: [
        { label: 'Compliance', val: 'GST & Statutory' },
        { label: 'Billing Models', val: 'Usage & Recurring' },
        { label: 'Reconciliation', val: 'Automated' },
      ],
      highlights: [
        'One-click convert Closed Deals into recurring subscriptions',
        'Integrated Indian & global payment gateway reconciliations',
        'Audit-grade financial ledgers with ledger level locks',
      ],
    },
    {
      id: 'people',
      name: 'Niral People',
      category: 'Human Resources',
      status: 'In Development',
      isLive: false,
      tagline: 'Employee directory, biometric attendance, statutory payroll, and team leave workflows.',
      badge: 'Coming Soon',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: Users,
      href: '#',
      cta: 'Coming Soon',
      metrics: [
        { label: 'Attendance', val: 'Biometric & Geofence' },
        { label: 'Payroll', val: 'One-Click Compute' },
        { label: 'Directory', val: 'Global Unified' },
      ],
      highlights: [
        'Centralized employee lifecycle management',
        'Automated leave policies and team approval hierarchies',
        'Integrated payroll calculation with compliance slips',
      ],
    },
    {
      id: 'analytics',
      name: 'Niral Analytics',
      category: 'Intelligence & BI',
      status: 'In Development',
      isLive: false,
      tagline: 'Cross-suite operational intelligence, predictive deal velocity, and executive rollups.',
      badge: 'Coming Soon',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: BarChart3,
      href: '#',
      cta: 'Coming Soon',
      metrics: [
        { label: 'Forecasting', val: 'Machine Assisted' },
        { label: 'Rollup', val: 'Multi-Organization' },
        { label: 'Refresh', val: 'Real-time' },
      ],
      highlights: [
        'Consolidated executive dashboards across all companies',
        'Predictive deal closure probability scoring',
        'Automated recurring email reports for leadership',
      ],
    },
  ];

  const currentApp = suiteApps.find((a) => a.id === activeTab) || suiteApps[0];

  return (
    <div className="min-h-screen bg-[#090D16] text-[#F8FAFC] selection:bg-[#3659C9] selection:text-white flex flex-col font-sans antialiased">
      {/* Subtle Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-[#090D16]/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <img
                src="/niral-icon.png"
                alt="Niral"
                className="w-8 h-8 object-contain transition-transform group-hover:scale-105"
              />
              <img
                src="/niral-wordmark.png"
                alt="NIRAL"
                className="h-4 w-auto object-contain brightness-0 invert"
              />
            </Link>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-[13px] font-medium text-slate-300">
            <a href="#suite" className="hover:text-white transition-colors">
              Suite Overview
            </a>
            <a href="#crm" className="hover:text-white transition-colors">
              CRM Engine
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">
              Architecture
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            {!isLoading && currentUser ? (
              <div className="flex items-center space-x-3">
                <span className="hidden sm:inline-block text-xs font-mono text-slate-400">
                  {currentUser.email}
                </span>
                <Link
                  href="/onboarding?from=/"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#3659C9] hover:bg-[#2B47A1] text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <span>Enter Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <Link
                href="/onboarding?from=/"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-white text-[#090D16] hover:bg-slate-100 text-xs font-bold shadow-sm transition-all"
              >
                <span>Launch CRM</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <section className="relative z-10 pt-20 pb-16 lg:pt-28 lg:pb-24 border-b border-white/[0.08]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-md bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>NIRAL ENTERPRISE SUITE // V1.0</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-[1.08]">
            One connected system. <br />
            <span className="text-slate-400 font-medium">Multiple specialized business engines.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed font-normal">
            NIRAL is an interconnected business operations suite. Today, our high-velocity <strong className="text-white font-semibold">Niral CRM</strong> is live — with support desk, automated billing, and workforce management in active engineering.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/onboarding?from=/"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-[#3659C9] hover:bg-[#2B47A1] text-white text-sm font-semibold shadow-lg shadow-[#3659C9]/20 transition-all hover:translate-y-[-1px]"
            >
              <span>Get Started with Niral CRM</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#suite"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.08] text-slate-200 text-sm font-medium transition-colors"
            >
              <span>Explore The Suite Roadmap</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Interactive Suite Dock */}
        <div id="suite" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
          <div className="bg-[#0F1422] border border-white/[0.1] rounded-2xl p-2 sm:p-3 shadow-2xl">
            {/* Tab Selector */}
            <div className="flex items-center overflow-x-auto no-scrollbar gap-1.5 p-1 border-b border-white/[0.06] pb-3">
              {suiteApps.map((app) => {
                const Icon = app.icon;
                const isActive = activeTab === app.id;
                return (
                  <button
                    key={app.id}
                    onClick={() => setActiveTab(app.id as any)}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#3659C9] text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{app.name}</span>
                    {app.isLive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    ) : (
                      <span className="text-[10px] font-mono px-1 rounded bg-white/10 text-slate-300">Soon</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active App Showcase Panel */}
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4 text-left">
                <div className="flex items-center space-x-2">
                  <span className={`text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${currentApp.badgeColor}`}>
                    {currentApp.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">• {currentApp.category}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {currentApp.name}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {currentApp.tagline}
                </p>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  {currentApp.metrics.map((m, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{m.label}</div>
                      <div className="text-xs font-semibold text-white mt-0.5 truncate">{m.val}</div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  {currentApp.isLive ? (
                    <Link
                      href={currentApp.href}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#3659C9] hover:bg-[#2B47A1] text-white text-xs font-semibold shadow-md transition-all"
                    >
                      <span>{currentApp.cta}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <div className="inline-flex items-center space-x-2 text-xs font-mono text-amber-300/80 bg-amber-500/10 px-3.5 py-2 rounded-xl border border-amber-500/20">
                      <Clock className="w-3.5 h-3.5" />
                      <span>In active development • Coming in upcoming release</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Visual Card / Highlights */}
              <div className="lg:col-span-5 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 text-left space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 pb-2 border-b border-white/[0.06]">
                  Key Capabilities
                </div>
                <ul className="space-y-2.5">
                  {currentApp.highlights.map((h, i) => (
                    <li key={i} className="flex items-start space-x-2.5 text-xs text-slate-300">
                      <div className="w-4 h-4 rounded-full bg-[#3659C9]/20 text-[#3659C9] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured CRM Deep Dive */}
      <section id="crm" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        <div className="max-w-3xl text-left space-y-3">
          <div className="text-xs font-mono uppercase tracking-wider text-[#3659C9]">
            The Live Powerhouse
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Niral CRM. Built for high-velocity teams.
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Unlike disjointed spreadsheet workflows, Niral CRM binds tasks, deals, and communication directly to company records under multi-tenant role governance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0F1422] border border-white/[0.08] p-6 rounded-2xl space-y-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <h4 className="text-base font-semibold text-white">Stage-Driven Deals</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time pipeline tracking with stage transition validation, deal values in INR/USD, and inactive deal tracking.
            </p>
          </div>

          <div className="bg-[#0F1422] border border-white/[0.08] p-6 rounded-2xl space-y-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h4 className="text-base font-semibold text-white">Context-Bound Tasks</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every action item is bound directly to a Lead, Contact, or Deal record. Completed tasks move to dedicated completed views.
            </p>
          </div>

          <div className="bg-[#0F1422] border border-white/[0.08] p-6 rounded-2xl space-y-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h4 className="text-base font-semibold text-white">Multi-Organization Isolation</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Switch between company workspaces in one click with strict Row-Level Security separating client databases.
            </p>
          </div>
        </div>
      </section>

      {/* Technical Architecture */}
      <section id="architecture" className="py-20 border-t border-white/[0.08] bg-[#0C101A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Shared Infrastructure
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Shared platform. Zero data leakage.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Every application in the Niral Suite shares the same global identity, authorization layer, and tenant guarantees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#090D16] border border-white/[0.06] space-y-2.5">
              <Cpu className="w-5 h-5 text-blue-400" />
              <h4 className="text-sm font-semibold text-white">Single Global Account</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Log in once. Your Niral identity unlocks company workspaces across CRM, Desk, Books, and People without multiple credentials.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#090D16] border border-white/[0.06] space-y-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-semibold text-white">Postgres Row-Level Security</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Organization boundaries are strictly enforced at the database kernel. Cross-tenant leakage is mathematically impossible.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#090D16] border border-white/[0.06] space-y-2.5">
              <Database className="w-5 h-5 text-purple-400" />
              <h4 className="text-sm font-semibold text-white">Sub-Second State Sync</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Optimistic mutations and instant cache invalidation keep your entire operations team in lockstep across tabs and devices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Modern Footer */}
      <footer className="mt-auto border-t border-white/[0.08] py-10 bg-[#090D16]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center space-x-2.5">
            <img src="/niral-icon.png" alt="Niral" className="w-5 h-5 object-contain" />
            <span className="font-bold tracking-wider text-white">NIRAL</span>
          </div>

          <div className="flex items-center space-x-6">
            <Link href="/onboarding?from=/" className="text-white hover:text-[#3659C9] font-medium transition-colors">
              Launch CRM Workspace
            </Link>
            <span>© 2026 NIRAL Inc.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
