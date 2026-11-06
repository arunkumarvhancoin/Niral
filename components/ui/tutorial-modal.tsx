'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTutorialStore } from '../../lib/stores/tutorial-store';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  LayoutDashboard,
  Target,
  BarChart3,
  Users2,
  CheckSquare,
  Building,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface TutorialStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  routeLabel: string;
  keyFeatures: string[];
  proTip: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'dashboard',
    badge: 'Step 1 of 6 · Overview',
    title: 'Workspace Dashboard & Real-Time Analytics',
    subtitle: 'High-level visibility into your company’s sales velocity.',
    description:
      'The Dashboard gives you an immediate bird’s-eye view of active deals, total pipeline revenue, win conversion rates, and recent team activities. All metrics are isolated to your active workspace.',
    icon: LayoutDashboard,
    route: '/dashboard',
    routeLabel: 'Open Dashboard',
    keyFeatures: [
      'Total Pipeline Value & Average Deal Size',
      'Real-time win rate conversion percentages',
      'Recent sales activity feed from your team',
      'Strict multi-tenant security per workspace',
    ],
    proTip: 'Switch organizations at any time using the workspace switcher at the top of the sidebar.',
  },
  {
    id: 'leads',
    badge: 'Step 2 of 6 · Prospecting',
    title: 'Lead Capture & Qualification',
    subtitle: 'Collect prospects and convert them seamlessly into contacts.',
    description:
      'Track prospective buyers entering through your website, outbound outreach, or referrals. Assign values, track lead statuses, and convert warm leads into contacts and deals with a single click.',
    icon: Target,
    route: '/leads',
    routeLabel: 'Explore Leads',
    keyFeatures: [
      'Filter leads by source (Website, Referral, Social, Event)',
      'Assign priority ratings (Low, Medium, High)',
      'One-click convert lead to permanent Contact',
      'Add custom notes and contact numbers',
    ],
    proTip: 'Qualify leads quickly by updating their status to "Contacted" or "Qualified" before converting.',
  },
  {
    id: 'deals',
    badge: 'Step 3 of 6 · Sales Pipeline',
    title: 'Deals & Stage Progress Tracking',
    subtitle: 'Keep your revenue engine moving forward through every stage.',
    description:
      'Organize your pipeline across structured stages: Lead In, Contact Made, Needs Defined, Proposal Sent, Negotiation, and Closed Won. Track deal values, expected close dates, and associated clients.',
    icon: BarChart3,
    route: '/deals',
    routeLabel: 'View Deals Pipeline',
    keyFeatures: [
      'Stage-by-stage pipeline distribution',
      'Expected close date tracking & overdue flags',
      'Direct linking between deals and contacts',
      'Total stage sums calculated automatically',
    ],
    proTip: 'Keep expected close dates accurate to give your team realistic monthly revenue forecasts.',
  },
  {
    id: 'contacts',
    badge: 'Step 4 of 6 · Directory',
    title: 'Contacts & Customer Profiles',
    subtitle: 'A single source of truth for your customer relationships.',
    description:
      'Maintain an organized database of clients, leads, and partner accounts. Filter by status (Customer, Lead, Inactive), search instantly by name or email, and access phone/email actions quickly.',
    icon: Users2,
    route: '/contacts',
    routeLabel: 'Manage Contacts',
    keyFeatures: [
      'Comprehensive contact profiles with company accounts',
      'Instant search by name, email, or company',
      'Direct mailto: and tel: click-to-contact links',
      'Status tagging (Customer, Lead, Inactive)',
    ],
    proTip: 'Add company names to your contacts to easily group buyers from the same organization.',
  },
  {
    id: 'tasks',
    badge: 'Step 5 of 6 · Productivity',
    title: 'Tasks & Team Activity Feed',
    subtitle: 'Stay on top of follow-ups and keep the team in sync.',
    description:
      'Create actionable to-dos with due dates, priority levels, and assignees. Log calls, meetings, notes, and emails into the shared activity feed so every team member has full context.',
    icon: CheckSquare,
    route: '/tasks',
    routeLabel: 'View Tasks & Activities',
    keyFeatures: [
      'Tasks with status toggles (Todo, In Progress, Completed)',
      'Priority flags (Low, Medium, High) with due dates',
      'Teammate assignment with notifications',
      'Collaborative activity log for client notes & calls',
    ],
    proTip: 'Log notes immediately after customer calls to preserve context for your entire sales team.',
  },
  {
    id: 'settings-team',
    badge: 'Step 6 of 6 · Administration',
    title: 'Branding & Team Collaboration (RBAC)',
    subtitle: 'Customize your workspace and manage role-based permissions.',
    description:
      'Upload your company logo, set your custom company details, and invite teammates with tailored roles: Owner, Admin, Manager, or Employee. Strict permission boundaries protect your data.',
    icon: Building,
    route: '/settings',
    routeLabel: 'Open Workspace Settings',
    keyFeatures: [
      'Drag-and-drop or file upload for your company logo',
      'Workspace switcher for managing multiple businesses',
      'Role-based permissions (Owner, Admin, Manager, Employee)',
      'Team invitation approval workflow',
    ],
    proTip: 'Admins and Owners can invite colleagues from the Team page and customize branding in Settings.',
  },
];

export function TutorialModal() {
  const { isOpen, currentStep, closeTutorial, nextStep, prevStep, setStep, openTutorial } =
    useTutorialStore();
  const router = useRouter();

  // Check if first-time user and show automatically once
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('niral_tutorial_completed');
    if (!hasSeenTutorial) {
      const timer = setTimeout(() => {
        openTutorial(0);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [openTutorial]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        closeTutorial();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeTutorial]);

  if (!isOpen) return null;

  const step = TUTORIAL_STEPS[currentStep] || TUTORIAL_STEPS[0];
  const StepIcon = step.icon;
  const isFirst = currentStep === 0;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;

  const handleFinish = () => {
    localStorage.setItem('niral_tutorial_completed', 'true');
    closeTutorial();
  };

  const handleNavigateToFeature = (path: string) => {
    closeTutorial();
    router.push(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Niral CRM Quick Tour</span>
                <span className="text-[10px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200">
                  Interactive Guide
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Master the core features and workflows of your CRM
              </p>
            </div>
          </div>
          <button
            onClick={closeTutorial}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
            title="Close Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Pills */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between overflow-x-auto bg-white gap-2">
          {TUTORIAL_STEPS.map((s, idx) => {
            const isCurrent = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <button
                key={s.id}
                onClick={() => setStep(idx)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isCurrent
                    ? 'bg-primary-600 text-white shadow-xs'
                    : isCompleted
                    ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary-600" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{s.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Step Hero Card */}
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary-500 to-indigo-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
              <StepIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-600">
                {step.badge}
              </span>
              <h4 className="text-lg font-bold text-slate-900 mt-0.5">{step.title}</h4>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{step.subtitle}</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            {step.description}
          </p>

          {/* Key Capabilities */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
              Key Capabilities
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {step.keyFeatures.map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-2 p-2.5 rounded-lg bg-white border border-slate-200/70 text-xs text-slate-700 shadow-2xs"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="leading-tight">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Tip Box */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 flex items-start space-x-3">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-amber-900 font-semibold">Pro Tip: </strong>
              <span className="text-amber-800">{step.proTip}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleNavigateToFeature(step.route)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200/80 rounded-lg transition-colors"
            >
              <span>{step.routeLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {!isFirst && (
              <button
                onClick={prevStep}
                className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}

            {isLast ? (
              <button
                onClick={handleFinish}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finish & Start Exploring</span>
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="inline-flex items-center space-x-1 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

