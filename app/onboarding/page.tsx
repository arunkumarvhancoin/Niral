'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { createClient } from '../../lib/supabase/client';
import {
  Building2,
  Plus,
  ArrowRight,
  Shield,
  Briefcase,
  Loader2,
  Search,
  X,
  LogOut,
  ChevronLeft,
  Mail,
  Eye,
  EyeOff,
  User,
  Lock,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogoUpload } from '../../components/ui/logo-upload';
import { toast } from '../../lib/stores/toast-store';

function OnboardingContent() {
  const {
    currentUser,
    memberships,
    setCurrentOrg,
    refreshWorkspace,
    switchOrganization,
    signOut,
    isLoading: isWorkspaceLoading,
  } = useWorkspace();

  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const initialStep = (searchParams.get('step') as 'select' | 'create') || 'select';

  // Auth Form State (when user is not yet logged in)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Organization Selection & Creation State (after user is logged in)
  const [step, setStep] = useState<'select' | 'create'>(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectingOrgId, setSelectingOrgId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const router = useRouter();

  // Create Organization Form State
  const [createData, setCreateData] = useState({
    name: '',
    slug: '',
    industry: 'Enterprise Software & SaaS',
    company_size: '10-50 employees',
    website: '',
    description: '',
    logo_url: '',
  });

  const approvedMemberships = memberships.filter((m) => m.status === 'approved');
  const filteredApprovedMemberships = approvedMemberships.filter((m) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase().trim();
    return (
      m.organization.name.toLowerCase().includes(q) ||
      (m.organization.slug && m.organization.slug.toLowerCase().includes(q)) ||
      m.role.toLowerCase().includes(q) ||
      (m.organization.industry && m.organization.industry.toLowerCase().includes(q))
    );
  });

  // Handle In-Place Authentication
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const supabase = createClient();

      if (authMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        toast.success('Signed in successfully!');
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              full_name: authFullName,
            },
          },
        });
        if (error) throw error;
        toast.success('Account created successfully!');
      }

      await refreshWorkspace();
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSelectOrg = async (orgId: string) => {
    setSelectingOrgId(orgId);
    try {
      await switchOrganization(orgId);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch organization');
    } finally {
      setSelectingOrgId(null);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthError('Please sign in first to create an organization.');
      return;
    }
    setIsSubmitting(true);
    try {
      const slug = createData.slug || createData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const { organization } = await CRMService.createOrganization(currentUser.id, {
        ...createData,
        slug,
      });

      setCurrentOrg(organization, 'Owner', 'approved');
      await refreshWorkspace(true, organization.id);

      toast.success(`Organization "${createData.name}" created!`);
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#F7F8FA] flex flex-col lg:flex-row font-sans selection:bg-[#3659C9] selection:text-white">
      {/* LEFT COLUMN: Clean Brand, Product Statement & Suite Architecture (Fixed, No Scroll) */}
      <div className="lg:w-[44%] xl:w-[40%] h-full max-h-screen overflow-hidden bg-[#0B0F19] text-white p-8 lg:p-12 flex flex-col justify-between relative flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800/80">
        {/* Subtle Ambient Background Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#1E3A8A_0%,transparent_60%)] opacity-25 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,#312E81_0%,transparent_60%)] opacity-15 pointer-events-none" />

        {/* Top: Header & Navigation */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </Link>
          </div>

          <Link href="/" className="flex items-center space-x-3 pt-2 group cursor-pointer inline-flex">
            <img
              src="/niral-icon.png"
              alt="Niral"
              className="w-10 h-10 object-contain drop-shadow-md group-hover:scale-105 transition-transform"
            />
            <img
              src="/niral-wordmark.png"
              alt="NIRAL"
              className="h-4.5 w-auto object-contain brightness-0 invert"
            />
          </Link>
        </div>

        {/* Middle: Compact CRM Overview (No Scrolling) */}
        <div className="relative z-10 my-auto py-6 space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug">
              Sales velocity, simplified.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
              A streamlined CRM built for clarity and speed. Manage inbound leads, track deals through active stages, and connect follow-up tasks in one workspace.
            </p>
          </div>

          <div className="space-y-2 pt-2 text-xs text-slate-300">
            <div className="flex items-center space-x-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              <span>Full-cycle lead qualification & contact tracking</span>
            </div>
            <div className="flex items-center space-x-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span>Stage-based deal pipelines with value summaries</span>
            </div>
            <div className="flex items-center space-x-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
              <span>Contextual tasks linked to leads, contacts & deals</span>
            </div>
          </div>
        </div>

        {/* Bottom: Clean Infrastructure Statement */}
        <div className="relative z-10 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center space-x-2">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Encrypted Multi-Tenant Session</span>
          </div>
          <span>© 2026 NIRAL</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Authentication & Organization Stepper (Scrollable only if content overflows) */}
      <div className="flex-1 h-full max-h-screen overflow-y-auto p-6 sm:p-10 lg:p-12 flex flex-col items-center no-scrollbar">
        <div className="max-w-xl w-full my-auto py-6 pb-16 space-y-6">
          {/* STATE 1: NOT AUTHENTICATED -> IN-PLACE SIGN IN / SIGN UP (NO REDIRECT TO ANOTHER PAGE) */}
          {!currentUser && !isWorkspaceLoading ? (
            <div className="bg-white rounded-2xl shadow-xl border border-[#E7EAF0] p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150 space-y-6">
              <div>
                <h1 className="text-xl font-bold text-[#171B26] tracking-tight">
                  {authMode === 'signin' ? 'Sign in to Niral' : 'Create your Niral account'}
                </h1>
                <p className="text-xs text-[#697386] mt-1">
                  {authMode === 'signin'
                    ? 'Enter your credentials to access your company workspaces.'
                    : 'Start your unified account to manage CRM pipelines and team operations.'}
                </p>
              </div>

              {/* Tab Selector: Sign In vs Create Account */}
              <div className="grid grid-cols-2 p-1 bg-[#F1F3F7] rounded-xl border border-[#E7EAF0]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthError(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    authMode === 'signin'
                      ? 'bg-white text-[#171B26] shadow-xs'
                      : 'text-[#697386] hover:text-[#171B26]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    authMode === 'signup'
                      ? 'bg-white text-[#171B26] shadow-xs'
                      : 'text-[#697386] hover:text-[#171B26]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Error Banner */}
              {authError && (
                <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#B91C1C] mt-1.5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* In-Place Auth Form */}
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#171B26] mb-1.5">Full Name *</label>
                    <div className="relative flex items-center">
                      <User className="w-4 h-4 text-[#9AA2B1] absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Arun Kumar"
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-[#BAC0CE] focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#171B26] mb-1.5">Work Email *</label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-[#9AA2B1] absolute left-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-[#BAC0CE] focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171B26] mb-1.5">Password *</label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-[#9AA2B1] absolute left-3 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full text-xs pl-9 pr-10 py-2.5 rounded-lg border border-[#BAC0CE] focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-[#9AA2B1] hover:text-[#171B26]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full py-2.5 rounded-xl bg-[#3659C9] hover:bg-[#2B47A1] text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isAuthSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{authMode === 'signin' ? 'Sign In & Continue' : 'Create Account & Continue'}</span>
                  {!isAuthSubmitting && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </form>
            </div>
          ) : (
            /* STATE 2: AUTHENTICATED -> WORKSPACE SELECTION OR CREATION */
            <div className="space-y-4">
              {/* Signed In User Banner */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E7EAF0] text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-full bg-[#E2EAFA] text-[#3659C9] font-bold flex items-center justify-center uppercase text-[11px]">
                    {currentUser?.email ? currentUser.email.charAt(0) : 'U'}
                  </div>
                  <div>
                    <span className="font-semibold text-[#171B26] block truncate max-w-[200px]">
                      {currentUser?.full_name || currentUser?.email}
                    </span>
                    <span className="text-[10px] text-[#697386]">Niral Identity Active</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="inline-flex items-center space-x-1 text-[11px] text-[#697386] hover:text-[#B91C1C] transition-colors"
                  title="Switch or sign out account"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              </div>

              {/* STEP 2A: SELECT JOINED WORKSPACE */}
              {step === 'select' && (
                <div className="bg-white rounded-2xl shadow-xl border border-[#E7EAF0] p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150 space-y-6">
                  <div>
                    <h1 className="text-xl font-bold text-[#171B26] tracking-tight">Select Workspace</h1>
                    <p className="text-xs text-[#697386] mt-1">
                      Choose an organization to launch Niral CRM, or set up a new company workspace.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#697386]">
                        Joined Workspaces ({approvedMemberships.length})
                      </h2>
                    </div>

                    {approvedMemberships.length > 2 && (
                      <div className="relative flex items-center">
                        <Search className="w-4 h-4 text-[#9AA2B1] absolute left-3.5 pointer-events-none" />
                        <input
                          type="text"
                          value={filterQuery}
                          onChange={(e) => setFilterQuery(e.target.value)}
                          placeholder="Search workspace..."
                          className="w-full pl-10 pr-9 py-2 text-xs bg-[#F7F8FA] border border-[#E7EAF0] rounded-xl text-[#171B26] placeholder-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:bg-white transition-colors"
                        />
                        {filterQuery && (
                          <button
                            type="button"
                            onClick={() => setFilterQuery('')}
                            className="absolute right-3 text-[#9AA2B1] hover:text-[#171B26] p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {approvedMemberships.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-[#E7EAF0] bg-[#F7F8FA]">
                        <Briefcase className="w-8 h-8 text-[#9AA2B1] mx-auto mb-2" />
                        <p className="text-sm font-semibold text-[#171B26]">No organizations joined yet</p>
                        <p className="text-xs text-[#697386] mt-1">
                          Create your first company below to launch your CRM workspace.
                        </p>
                      </div>
                    ) : filteredApprovedMemberships.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-[#E7EAF0] bg-[#F7F8FA]">
                        <p className="text-sm font-semibold text-[#171B26]">No matching workspaces</p>
                        <button
                          type="button"
                          onClick={() => setFilterQuery('')}
                          className="text-xs text-[#3659C9] font-medium hover:underline mt-1"
                        >
                          Clear filter
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {filteredApprovedMemberships.map((item) => (
                          <div
                            key={item.organization.id}
                            onClick={() => handleSelectOrg(item.organization.id)}
                            className="p-3.5 rounded-xl border border-[#E7EAF0] hover:border-[#3659C9] hover:shadow-sm transition-all cursor-pointer bg-white flex items-center justify-between group"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-[#E7EAF0] flex items-center justify-center text-[#171B26] overflow-hidden flex-shrink-0">
                                {item.organization.logo_url ? (
                                  <img
                                    src={item.organization.logo_url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Building2 className="w-4 h-4 text-[#697386]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-bold text-[#171B26] text-xs sm:text-sm group-hover:text-[#3659C9] transition-colors truncate">
                                    {item.organization.name}
                                  </h3>
                                  <span
                                    className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border flex-shrink-0 ${
                                      item.role === 'Owner'
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : item.role === 'Admin'
                                        ? 'bg-blue-50 text-[#3659C9] border-blue-200'
                                        : 'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {item.role}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#697386] mt-0.5 truncate">
                                  {item.organization.industry || 'Business'} &bull; {item.organization.company_size || 'Team'}
                                </p>
                              </div>
                            </div>

                            <button
                              disabled={Boolean(selectingOrgId)}
                              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#F7F8FA] group-hover:bg-[#3659C9] group-hover:text-white text-[#171B26] text-xs font-semibold transition-all disabled:opacity-50 flex-shrink-0"
                            >
                              {selectingOrgId === item.organization.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Entering...</span>
                                </>
                              ) : (
                                <>
                                  <span>Enter</span>
                                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#E7EAF0]">
                    <div
                      onClick={() => setStep('create')}
                      className="p-4 rounded-xl border-2 border-dashed border-[#BAC0CE] hover:border-[#3659C9] hover:bg-blue-50/20 text-left transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#3659C9] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                          <Plus className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-[#171B26] text-xs sm:text-sm">Create New Organization</h3>
                          <p className="text-[11px] text-[#697386] mt-0.5">
                            Start a new company workspace as the <strong>Owner</strong>.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center text-xs font-semibold text-[#3659C9] pl-2 flex-shrink-0">
                        <span>Create &rarr;</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2B: CREATE NEW WORKSPACE */}
              {step === 'create' && (
                <div className="bg-white rounded-2xl shadow-xl border border-[#E7EAF0] p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150 space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E7EAF0]">
                    <div>
                      <h2 className="text-xl font-bold text-[#171B26]">Create Organization</h2>
                      <p className="text-xs text-[#697386] mt-0.5">
                        Set up an isolated company workspace for Niral CRM.
                      </p>
                    </div>
                    {approvedMemberships.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStep('select')}
                        className="text-xs font-semibold text-[#3659C9] hover:text-[#2B47A1] transition-colors"
                      >
                        &larr; Back
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleCreateCompany} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#171B26] mb-1">Company Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Acme Corporation"
                        value={createData.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setCreateData({
                            ...createData,
                            name,
                            slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                          });
                        }}
                        className="w-full text-xs rounded-lg border border-[#BAC0CE] p-2.5 focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#171B26] mb-1">Workspace Slug *</label>
                      <div className="flex items-center">
                        <span className="text-xs text-[#697386] bg-[#F7F8FA] px-3 py-2.5 rounded-l-lg border border-r-0 border-[#BAC0CE] font-mono">
                          app.crm.com/
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="acme-corp"
                          value={createData.slug}
                          onChange={(e) => setCreateData({ ...createData, slug: e.target.value })}
                          className="w-full text-xs rounded-r-lg border border-[#BAC0CE] p-2.5 font-mono focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#171B26] mb-1">Industry</label>
                        <input
                          type="text"
                          placeholder="e.g. SaaS, Fintech"
                          value={createData.industry}
                          onChange={(e) => setCreateData({ ...createData, industry: e.target.value })}
                          className="w-full text-xs rounded-lg border border-[#BAC0CE] p-2.5 focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] focus:outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#171B26] mb-1">Company Size</label>
                        <select
                          value={createData.company_size}
                          onChange={(e) => setCreateData({ ...createData, company_size: e.target.value })}
                          className="w-full text-xs rounded-lg border border-[#BAC0CE] p-2.5 focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] focus:outline-none transition-all"
                        >
                          <option value="1-10 employees">1-10 employees</option>
                          <option value="10-50 employees">10-50 employees</option>
                          <option value="50-200 employees">50-200 employees</option>
                          <option value="200+ employees">200+ employees</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#171B26] mb-1">Corporate Website</label>
                      <input
                        type="url"
                        placeholder="https://acme.example.com"
                        value={createData.website}
                        onChange={(e) => setCreateData({ ...createData, website: e.target.value })}
                        className="w-full text-xs rounded-lg border border-[#BAC0CE] p-2.5 focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] focus:outline-none transition-all"
                      />
                    </div>

                    <LogoUpload
                      value={createData.logo_url}
                      onChange={(url) => setCreateData({ ...createData, logo_url: url })}
                      label="Company Brand Logo (Optional)"
                    />

                    <div className="pt-4 border-t border-[#E7EAF0] flex items-center justify-end space-x-2">
                      {approvedMemberships.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setStep('select')}
                          className="px-4 py-2 text-xs font-medium text-[#697386] hover:bg-[#F1F3F7] rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{isSubmitting ? 'Creating Workspace...' : 'Create & Launch CRM'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center text-xs text-[#697386] space-x-2">
          <Loader2 className="w-4 h-4 text-[#3659C9] animate-spin" />
          <span>Loading Niral environment...</span>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
