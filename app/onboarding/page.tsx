'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { createClient } from '../../lib/supabase/client';
import { isSuperAdmin } from '../../lib/permissions';
import { OrganizationCreationInvite } from '../../lib/types/crm';
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
  UserPlus,
  ShieldCheck,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogoUpload } from '../../components/ui/logo-upload';
import { toast } from '../../lib/stores/toast-store';

function OnboardingContent() {
  const {
    currentUser,
    currentOrg,
    memberships,
    setCurrentOrg,
    refreshWorkspace,
    switchOrganization,
    signOut,
    isLoading: isWorkspaceLoading,
  } = useWorkspace();

  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from');
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const initialStep = (searchParams.get('step') as 'select' | 'create') || 'select';
  const queryEmail = searchParams.get('email') || '';

  // Navigation: Go back to previous location, active org dashboard, or landing page
  const handleBack = () => {
    // 1. If explicit "from" was provided in the URL:
    if (fromParam) {
      router.push(fromParam);
      return;
    }
    // 2. If user has in-site history:
    if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
      router.back();
      return;
    }
    // 3. Fallback: If user has an active organization, go to its dashboard:
    if (currentOrg) {
      router.push('/dashboard');
      return;
    }
    // 4. Default fallback: landing page:
    router.push('/');
  };

  // Auth Form State (when user is not yet logged in)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode);
  const [authEmail, setAuthEmail] = useState(queryEmail);
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

  // Super Admin & Creation Permissions State
  const isSuper = isSuperAdmin(currentUser);
  const [canCreateOrg, setCanCreateOrg] = useState(false);
  const [hasOrgInvite, setHasOrgInvite] = useState(false);
  const [checkingOrgPermission, setCheckingOrgPermission] = useState(true);
  const [orgCreationLimitReached, setOrgCreationLimitReached] = useState(false);

  // Super Admin Org Creation Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [creationInvitesList, setCreationInvitesList] = useState<OrganizationCreationInvite[]>([]);
  const [isLoadingInvitesList, setIsLoadingInvitesList] = useState(false);

  // Check user org creation permission
  useEffect(() => {
    if (!currentUser) {
      setCanCreateOrg(false);
      setHasOrgInvite(false);
      setOrgCreationLimitReached(false);
      setCheckingOrgPermission(false);
      return;
    }

    let isMounted = true;
    const evaluatePermissions = async () => {
      setCheckingOrgPermission(true);
      const res = await CRMService.canUserCreateOrganization(currentUser.email, currentUser.id);
      if (isMounted) {
        setCanCreateOrg(res.allowed);
        setHasOrgInvite(!res.isSuperAdmin && res.allowed);
        setOrgCreationLimitReached(res.reason === 'limit_reached');
        setCheckingOrgPermission(false);
      }
    };

    evaluatePermissions();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // If user tries step === 'create' but is not authorized, reset to 'select'
  useEffect(() => {
    if (!checkingOrgPermission && !canCreateOrg && step === 'create') {
      setStep('select');
      if (orgCreationLimitReached) {
        toast.error('You can only create 1 organization of your own. You can still join existing organizations if invited.');
      } else {
        toast.error('Organization creation is restricted to Super Admins or invited users.');
      }
    }
  }, [canCreateOrg, checkingOrgPermission, step, orgCreationLimitReached]);

  const loadInvitesList = async () => {
    if (!isSuper) return;
    setIsLoadingInvitesList(true);
    try {
      const list = await CRMService.getOrganizationCreationInvites();
      setCreationInvitesList(list);
    } catch (e: any) {
      console.warn('Failed to load invites list:', e);
    } finally {
      setIsLoadingInvitesList(false);
    }
  };

  useEffect(() => {
    if (showInviteModal && isSuper) {
      loadInvitesList();
    }
  }, [showInviteModal, isSuper]);

  const handleSendCreationInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsSendingInvite(true);
    try {
      const invite = await CRMService.createOrganizationCreationInvite(inviteEmail, inviteNote);
      toast.success(`Invitation created for ${inviteEmail}!`);
      const link = `${window.location.origin}/onboarding?mode=signup&email=${encodeURIComponent(invite.email)}`;
      setInviteSuccessLink(link);
      setInviteEmail('');
      setInviteNote('');
      await loadInvitesList();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (!inviteSuccessLink) return;
    navigator.clipboard.writeText(inviteSuccessLink);
    setCopiedLink(true);
    toast.success('Invitation link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await CRMService.revokeOrganizationCreationInvite(inviteId);
      toast.success('Invitation revoked');
      await loadInvitesList();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invite');
    }
  };

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

  // Handle In-Place Authentication (Production-Grade with API Route + Client Fallback & Auto-Retry)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    setAuthError(null);

    const cleanEmail = authEmail.trim().toLowerCase();
    const endpoint = authMode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';

    try {
      // 1. Primary path: Server-side API route handler (bypasses browser adblockers & cross-origin issues)
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: authPassword,
            fullName: authFullName.trim(),
          }),
        });
      } catch (networkFetchErr) {
        // If client-to-server fetch failed, bubble to client fallback
        throw networkFetchErr;
      }

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If it is a 4xx validation or wrong credentials error, display user-friendly message
        if (res.status === 400 || res.status === 401 || res.status === 422) {
          setAuthError(result.error || 'Authentication failed. Please verify your credentials.');
          return;
        }

        // If it was a 5xx server timeout or fetch failure, bubble to client fallback!
        console.warn('Server auth returned 5xx, falling back to direct browser auth:', result.error);
        throw new Error(result.error || 'Server connection error');
      }

      // Synchronize browser client session if token returned (non-fatal if cookies already present)
      const supabase = createClient();
      if (result.session) {
        try {
          await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });
        } catch (sessionSyncErr) {
          console.warn('Session sync notice (cookies already established):', sessionSyncErr);
        }
      }

      toast.success(authMode === 'signin' ? 'Signed in successfully!' : 'Account created successfully!');
      await refreshWorkspace(false);
    } catch (primaryErr: any) {
      console.warn('Primary server auth failed, executing browser client fallback:', primaryErr.message);

      // 2. Fallback path: Direct browser client call
      try {
        const supabase = createClient();
        if (authMode === 'signin') {
          const { error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: authPassword,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signUp({
            email: cleanEmail,
            password: authPassword,
            options: {
              data: {
                full_name: authFullName.trim(),
              },
            },
          });
          if (error) throw error;
        }

        toast.success(authMode === 'signin' ? 'Signed in successfully!' : 'Account created successfully!');
        await refreshWorkspace(false);
      } catch (fallbackErr: any) {
        const raw = (fallbackErr?.message || primaryErr?.message || '').toLowerCase();
        let msg = 'Authentication failed. Please verify your credentials.';
        if (raw.includes('fetch failed') || raw.includes('failed to fetch') || raw.includes('network') || raw.includes('timeout')) {
          msg = 'Connection to authentication server timed out. Please check your internet connection and try again.';
        } else if (raw.includes('invalid login credentials') || raw.includes('invalid credentials')) {
          msg = 'Incorrect email or password. Please verify your credentials.';
        } else if (fallbackErr?.message) {
          msg = fallbackErr.message;
        }
        setAuthError(msg);
      }
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
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer group"
              title={currentOrg ? `Back to ${currentOrg.name}` : fromParam === '/' ? 'Back to Landing Page' : 'Back'}
            >
              <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>{currentOrg ? `Back to ${currentOrg.name}` : 'Back'}</span>
            </button>
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
          {/* STATE 1: LOADING SESSION */}
          {isWorkspaceLoading ? (
            <div className="bg-white rounded-2xl shadow-xl border border-[#E7EAF0] p-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-150">
              <Loader2 className="w-8 h-8 animate-spin text-[#3659C9]" />
              <p className="text-xs text-[#697386] font-medium">Verifying authenticated session...</p>
            </div>
          ) : !currentUser ? (
            /* STATE 2: NOT AUTHENTICATED -> IN-PLACE SIGN IN / SIGN UP (NO REDIRECT TO ANOTHER PAGE) */
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
                        placeholder="e.g. John Doe"
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
            /* STATE 3: AUTHENTICATED -> WORKSPACE SELECTION OR CREATION */
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
                <div className="flex items-center space-x-2">
                  {currentOrg && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium text-[#3659C9] bg-[#F0F4FE] hover:bg-[#E2EAFA] border border-[#C7D6F5] rounded-md transition-colors cursor-pointer"
                      title={`Return to ${currentOrg.name}`}
                    >
                      <ChevronLeft className="w-3 h-3" />
                      <span>Back to {currentOrg.name}</span>
                    </button>
                  )}
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
                      {isSuper && (
                        <button
                          type="button"
                          onClick={() => {
                            setInviteSuccessLink(null);
                            setShowInviteModal(true);
                          }}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE] border border-[#BFDBFE] transition-colors cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Invite to Create Org</span>
                        </button>
                      )}
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
                          {canCreateOrg
                            ? 'Create your first company below to launch your CRM workspace.'
                            : 'Organization creation is restricted. Please contact a platform Super Admin to receive an invitation.'}
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
                                    className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border flex-shrink-0 ${
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
                    {canCreateOrg ? (
                      <div>
                        {hasOrgInvite && (
                          <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span>
                              <strong>Super Admin Invitation Active:</strong> You are authorized to create a new organization workspace.
                            </span>
                          </div>
                        )}
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
                    ) : (
                      <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E7EAF0] text-xs text-[#697386] flex items-start space-x-2.5">
                        <Shield className={`w-4 h-4 mt-0.5 flex-shrink-0 ${orgCreationLimitReached ? 'text-[#3659C9]' : 'text-[#9AA2B1]'}`} />
                        <div>
                          <span className="font-semibold text-[#171B26] block">
                            {orgCreationLimitReached ? 'Organization Creation Limit (1/1)' : 'Organization Creation Restricted'}
                          </span>
                          <span className="mt-0.5 block leading-relaxed">
                            {orgCreationLimitReached
                              ? 'You have already created 1 organization of your own. You can still join multiple already existing organizations if invited by their team.'
                              : 'Only platform Super Admins or users specifically invited by a Super Admin can create new company workspaces.'}
                          </span>
                        </div>
                      </div>
                    )}
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

      {/* SUPER ADMIN: INVITE USER TO CREATE AN ORGANIZATION MODAL */}
      {showInviteModal && isSuper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E7EAF0] max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7EAF0]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#3659C9] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#171B26]">Invite User to Create Org</h3>
                  <p className="text-[11px] text-[#697386]">Super Admin Authorization</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteSuccessLink(null);
                }}
                className="p-1 rounded-lg text-[#697386] hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#697386] leading-relaxed">
              Grant an email address exclusive authorization to create and own a new company workspace. Only Super Admins and authorized invitees can create organizations.
            </p>

            <form onSubmit={handleSendCreationInvite} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#171B26] mb-1">Invitee Email *</label>
                <input
                  type="email"
                  required
                  placeholder="partner@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#BAC0CE] focus:border-[#3659C9] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171B26] mb-1">Note / Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Authorized for partner solar workspace"
                  value={inviteNote}
                  onChange={(e) => setInviteNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#BAC0CE] focus:border-[#3659C9] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingInvite || !inviteEmail.trim()}
                className="w-full py-2 px-4 rounded-xl bg-[#3659C9] hover:bg-[#2B47A1] text-white text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSendingInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                <span>Authorize & Generate Invite</span>
              </button>
            </form>

            {inviteSuccessLink && (
              <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-[#047857]">
                  <Check className="w-4 h-4" />
                  <span>Invitation created successfully!</span>
                </div>
                <p className="text-[11px] text-[#065F46]">
                  Share this link with the recipient so they can sign up/in and create their organization:
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteSuccessLink}
                    className="flex-1 text-[11px] bg-white border border-[#A7F3D0] px-2 py-1.5 rounded-lg text-slate-700 font-mono select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="px-3 py-1.5 bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#E7EAF0] space-y-2">
              <h4 className="text-xs font-bold text-[#171B26]">Active Creation Invites</h4>
              {isLoadingInvitesList ? (
                <div className="p-4 text-center text-xs text-[#697386]">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-[#3659C9]" />
                  Loading invitations...
                </div>
              ) : creationInvitesList.length === 0 ? (
                <p className="text-xs text-[#697386] italic">No creation invitations sent yet.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {creationInvitesList.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-2.5 rounded-lg border border-[#E7EAF0] bg-[#F7F8FA] flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-[#171B26] truncate">{inv.email}</div>
                        <div className="text-[10px] text-[#697386] truncate">
                          {inv.note ? `${inv.note} • ` : ''}
                          Status: <span className={inv.status === 'pending' ? 'text-blue-600 font-medium' : inv.status === 'used' ? 'text-emerald-600 font-medium' : 'text-slate-500'}>{inv.status}</span>
                        </div>
                      </div>
                      {inv.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          title="Revoke invitation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
