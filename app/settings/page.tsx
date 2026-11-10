'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { hasPermission } from '../../lib/permissions';
import {
  Building2,
  User,
  Shield,
  Save,
  Trash2,
  AlertTriangle,
  Check,
  Briefcase,
  Camera,
  Upload,
  Lock,
  Loader2,
  Mail,
  CheckCircle2,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LogoUpload } from '../../components/ui/logo-upload';
import { toast } from '../../lib/stores/toast-store';

export default function SettingsPage() {
  const { currentOrg, currentRole, currentStatus, currentUser, refreshWorkspace } = useWorkspace();
  const router = useRouter();

  const isOrgAdminOrOwner = currentRole === 'Owner' || currentRole === 'Admin';
  const canEditOrg = hasPermission(currentRole, currentStatus, 'org:settings:update');
  const canDeleteOrg = hasPermission(currentRole, currentStatus, 'org:delete');

  // Active Tab state ('personal' | 'company')
  const [activeTab, setActiveTab] = useState<'personal' | 'company'>('personal');

  // Read URL tab parameter on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'company' && isOrgAdminOrOwner) {
        setActiveTab('company');
      } else {
        setActiveTab('personal');
      }
    }
  }, [isOrgAdminOrOwner]);

  // =========================================================================
  // PERSONAL SETTINGS STATE
  // =========================================================================
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser?.avatar_url || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password Update State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Sync personal state when currentUser loads or updates
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setAvatarUrl(currentUser.avatar_url || null);
    }
  }, [currentUser]);

  // Handle avatar image upload & compression
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar file size exceeds 5MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 320;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setAvatarUrl(compressed);
        } else {
          setAvatarUrl(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Save personal profile details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSavingProfile(true);
    try {
      await CRMService.updateProfile(currentUser.id, {
        full_name: fullName.trim(),
        avatar_url: avatarUrl,
      });
      await refreshWorkspace(true);
      setProfileSaved(true);
      toast.success('Personal profile updated successfully!');
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle password change
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await CRMService.updatePassword(newPassword);
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // =========================================================================
  // COMPANY SETTINGS STATE (OWNER & ADMIN ONLY)
  // =========================================================================
  const [prevOrgId, setPrevOrgId] = useState(currentOrg?.id);
  const [companyData, setCompanyData] = useState({
    name: currentOrg?.name || '',
    slug: currentOrg?.slug || '',
    industry: currentOrg?.industry || '',
    company_size: currentOrg?.company_size || '',
    website: currentOrg?.website || '',
    description: currentOrg?.description || '',
    logo_url: currentOrg?.logo_url || '',
  });

  if (currentOrg && currentOrg.id !== prevOrgId) {
    setPrevOrgId(currentOrg.id);
    setCompanyData({
      name: currentOrg.name || '',
      slug: currentOrg.slug || '',
      industry: currentOrg.industry || '',
      company_size: currentOrg.company_size || '',
      website: currentOrg.website || '',
      description: currentOrg.description || '',
      logo_url: currentOrg.logo_url || '',
    });
  }

  const [companySaved, setCompanySaved] = useState(false);
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !canEditOrg) return;
    setIsSubmittingCompany(true);
    try {
      await CRMService.updateOrganization(currentOrg.id, companyData);
      await refreshWorkspace(true);
      setCompanySaved(true);
      toast.success('Organization settings updated successfully!');
      setTimeout(() => setCompanySaved(false), 2500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update organization');
    } finally {
      setIsSubmittingCompany(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!currentOrg || !canDeleteOrg) return;
    const confirmName = prompt(
      `CAUTION: Deleting this organization will permanently erase all contacts, deals, tasks, and audit logs. Type "${currentOrg.name}" to confirm:`
    );
    if (confirmName !== currentOrg.name) {
      toast.error('Organization name did not match. Deletion cancelled.');
      return;
    }

    try {
      if (currentUser) {
        await CRMService.leaveOrganization(currentOrg.id, currentUser.id);
      }
      toast.success('Organization deleted');
      await refreshWorkspace();
      router.push('/onboarding');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete organization');
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your personal profile, security credentials, and organization preferences.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-6 sm:space-x-8">
            <button
              onClick={() => setActiveTab('personal')}
              className={`py-3 px-1 border-b-2 text-sm font-semibold transition-colors flex items-center space-x-2 ${
                activeTab === 'personal'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Personal Settings</span>
            </button>

            {isOrgAdminOrOwner && (
              <button
                onClick={() => setActiveTab('company')}
                className={`py-3 px-1 border-b-2 text-sm font-semibold transition-colors flex items-center space-x-2 ${
                  activeTab === 'company'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Company Settings</span>
              </button>
            )}
          </nav>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: PERSONAL SETTINGS (Accessible to All Users)                */}
        {/* ================================================================= */}
        {activeTab === 'personal' && (
          <div className="space-y-6">
            {/* Profile Information Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Personal Information</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your avatar and display name are visible to team members across workspaces.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Role: {currentRole || 'Member'}
                </span>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-6">
                {/* Profile Photo / Avatar Section */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                  <div className="relative group w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl sm:text-3xl font-extrabold text-slate-600">
                        {fullName.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 bg-slate-900/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Change photo"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="text-[10px] font-medium mt-0.5">Upload</span>
                    </button>
                  </div>

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    className="hidden"
                  />

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-900">Profile Photo</h4>
                    <p className="text-xs text-slate-500">
                      Recommended: Square JPG, PNG, or WebP. Max size: 5MB.
                    </p>
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-400" />
                        <span>Upload Photo</span>
                      </button>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl(null)}
                          className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-medium transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Arun Kumar"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        disabled
                        value={currentUser?.email || ''}
                        className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-500 cursor-not-allowed pr-9 font-mono"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Primary sign-in email cannot be modified directly.
                    </span>
                  </div>
                </div>

                {/* Save Profile Button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    Account created on {currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString() : 'Recently'}
                  </div>

                  <div className="flex items-center space-x-2">
                    {profileSaved && (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center">
                        <Check className="w-3.5 h-3.5 mr-1" /> Profile Saved
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSavingProfile ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Security & Password Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6">
              <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 mb-5">
                <Lock className="w-5 h-5 text-primary-600" />
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Security & Password</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Update the password associated with your account.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2.5 pr-9 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                      tabIndex={-1}
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2.5 pr-9 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                      tabIndex={-1}
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: COMPANY SETTINGS (Strictly Owners & Admins Only)           */}
        {/* ================================================================= */}
        {activeTab === 'company' && isOrgAdminOrOwner && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div className="flex items-center space-x-2.5">
                  <Building2 className="w-5 h-5 text-primary-600" />
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">Company Profile</h3>
                    <p className="text-xs text-slate-500">
                      Organization details, brand assets, and workspace configuration for {currentOrg?.name}.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                  {currentRole} Access
                </span>
              </div>

              <form onSubmit={handleSaveCompany} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
                    <input
                      type="text"
                      required
                      disabled={!canEditOrg}
                      value={companyData.name}
                      onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Unique Workspace Slug *</label>
                    <input
                      type="text"
                      required
                      disabled={!canEditOrg}
                      value={companyData.slug}
                      onChange={(e) => setCompanyData({ ...companyData, slug: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2.5 font-mono disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                    <input
                      type="text"
                      disabled={!canEditOrg}
                      placeholder="e.g. Events & Entertainment, SaaS, Logistics"
                      value={companyData.industry}
                      onChange={(e) => setCompanyData({ ...companyData, industry: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Company Size</label>
                    <select
                      disabled={!canEditOrg}
                      value={companyData.company_size}
                      onChange={(e) => setCompanyData({ ...companyData, company_size: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    >
                      <option value="1-10 employees">1-10 employees</option>
                      <option value="10-50 employees">10-50 employees</option>
                      <option value="50-200 employees">50-200 employees</option>
                      <option value="200-1000 employees">200-1000 employees</option>
                      <option value="1000+ employees">1000+ employees</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Website</label>
                  <input
                    type="url"
                    disabled={!canEditOrg}
                    placeholder="https://company.com"
                    value={companyData.website}
                    onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <LogoUpload
                  value={companyData.logo_url}
                  onChange={(url) => setCompanyData({ ...companyData, logo_url: url })}
                  disabled={!canEditOrg}
                  label="Company Brand / Logo"
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Description</label>
                  <textarea
                    rows={3}
                    disabled={!canEditOrg}
                    value={companyData.description}
                    onChange={(e) => setCompanyData({ ...companyData, description: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    Created on {currentOrg?.created_at ? new Date(currentOrg.created_at).toLocaleDateString() : 'Recently'}
                  </div>

                  {canEditOrg && (
                    <div className="flex items-center space-x-2">
                      {companySaved && (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center">
                          <Check className="w-3.5 h-3.5 mr-1" /> Settings Saved
                        </span>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmittingCompany}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isSubmittingCompany ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Settings</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Danger Zone: Only Owner */}
            {canDeleteOrg && (
              <div className="bg-white rounded-xl border border-rose-200 shadow-2xs p-5 sm:p-6">
                <div className="flex items-center space-x-2.5 text-rose-700 mb-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h3 className="font-bold text-sm">Danger Zone</h3>
                </div>
                <p className="text-xs text-slate-600 mb-4">
                  Deleting an organization will permanently terminate access for all members and delete all associated CRM records, pipelines, contacts, and deal histories. This action is irreversible.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteOrganization}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Organization Workspace</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notice if a non-admin attempts to view company tab */}
        {activeTab === 'company' && !isOrgAdminOrOwner && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Company Settings Restricted</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Company profile and workspace preferences can only be viewed and modified by Organization Owners and Administrators.
            </p>
            <button
              onClick={() => setActiveTab('personal')}
              className="mt-2 inline-flex items-center px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
            >
              Go to Personal Settings
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
