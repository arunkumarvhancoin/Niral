'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { useOrganizationStore } from '../../lib/stores/organization-store';
import { CRMService } from '../../lib/services/crm-service';
import { hasPermission, isBharatPlay } from '../../lib/permissions';
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
  const {
    currentOrg,
    currentRole,
    currentStatus,
    currentUser,
    memberships,
    switchOrganization,
    refreshWorkspace,
    isSuperAdmin: isSuper,
  } = useWorkspace();
  const router = useRouter();

  const isOrgAdminOrOwner = isSuper || currentRole === 'Owner' || currentRole === 'Admin';
  const canEditOrg = isSuper || hasPermission(currentRole, currentStatus, 'org:settings:update', currentUser);
  const canDeleteOrg = (isSuper || hasPermission(currentRole, currentStatus, 'org:delete', currentUser)) && !isBharatPlay(currentOrg);

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

  // Delete Organization Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteInputName, setDeleteInputName] = useState('');
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

  const handleOpenDeleteModal = () => {
    setDeleteInputName('');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteOrg = async () => {
    if (!currentOrg || !canDeleteOrg) return;
    if (deleteInputName.trim() !== currentOrg.name) {
      toast.error('Organization name does not match.');
      return;
    }

    setIsDeletingOrg(true);
    try {
      const deletedName = currentOrg.name;
      await CRMService.deleteOrganization(currentOrg.id);
      setIsDeleteModalOpen(false);

      // Clean store, local storage & cookies for the deleted organization
      useOrganizationStore.getState().reset();

      // Refresh workspace so memberships update
      await refreshWorkspace(true);

      toast.success(`Organization "${deletedName}" deleted successfully.`);

      // Once it gets deleted, always take user directly to the Workspace & Discovery page
      router.push('/onboarding');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete organization');
    } finally {
      setIsDeletingOrg(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171B26]">Settings</h1>
          <p className="text-[13px] text-[#697386] mt-0.5">
            Manage your personal profile, security credentials, and organization preferences.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-[#E7EAF0]">
          <nav className="flex space-x-6 sm:space-x-8">
            <button
              onClick={() => setActiveTab('personal')}
              className={`py-2.5 px-1 border-b-2 text-[13px] font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'personal'
                  ? 'border-[#3659C9] text-[#3659C9] font-semibold'
                  : 'border-transparent text-[#697386] hover:text-[#171B26]'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Personal Settings</span>
            </button>

            {isOrgAdminOrOwner && (
              <button
                onClick={() => setActiveTab('company')}
                className={`py-2.5 px-1 border-b-2 text-[13px] font-medium transition-colors flex items-center space-x-2 ${
                  activeTab === 'company'
                    ? 'border-[#3659C9] text-[#3659C9] font-semibold'
                    : 'border-transparent text-[#697386] hover:text-[#171B26]'
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
            <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-6">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#E7EAF0] mb-5">
                <div>
                  <h3 className="font-semibold text-[#171B26] text-sm">Personal Information</h3>
                  <p className="text-[12px] text-[#697386] mt-0.5">
                    Your avatar and display name are visible to team members across workspaces.
                  </p>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F1F3F7] text-[#697386] border border-[#E7EAF0]">
                  Role: {currentRole || 'Member'}
                </span>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Profile Photo / Avatar Section */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                  <div className="relative group w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-[#F1F3F7] border border-[#E7EAF0] overflow-hidden shrink-0 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-semibold text-[#697386]">
                        {fullName.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 bg-[#171B26]/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Change photo"
                    >
                      <Camera className="w-4 h-4" />
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

                  <div className="space-y-1.5">
                    <h4 className="text-[13px] font-semibold text-[#171B26]">Profile Photo</h4>
                    <p className="text-[12px] text-[#697386]">
                      Recommended: Square JPG, PNG, or WebP. Max size: 5MB.
                    </p>
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md border border-[#E7EAF0] bg-white hover:bg-[#F1F3F7] text-[#171B26] text-[12px] font-medium shadow-2xs transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#697386]" />
                        <span>Upload Photo</span>
                      </button>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl(null)}
                          className="px-2.5 py-1.5 rounded-md text-[#B91C1C] hover:bg-[#FEF2F2] text-[12px] font-medium transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Full Name */}
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                      Full Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white p-2.5 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        disabled
                        value={currentUser?.email || ''}
                        className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-[#F7F8FA] p-2.5 text-[#697386] cursor-not-allowed pr-9 font-mono"
                      />
                      <Mail className="w-3.5 h-3.5 text-[#9AA2B1] absolute right-3 top-3" />
                    </div>
                    <span className="text-[11px] text-[#697386] mt-1 block">
                      Primary sign-in email cannot be modified directly.
                    </span>
                  </div>
                </div>

                {/* Save Profile Button */}
                <div className="pt-4 border-t border-[#E7EAF0] flex items-center justify-between">
                  <div className="text-[11px] text-[#697386]">
                    Account created on {currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString() : 'Recently'}
                  </div>

                  <div className="flex items-center space-x-2">
                    {profileSaved && (
                      <span className="text-[12px] text-[#047857] font-medium flex items-center">
                        <Check className="w-3.5 h-3.5 mr-1" /> Profile Saved
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-[13px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
            <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-6">
              <div className="flex items-center space-x-2.5 pb-3.5 border-b border-[#E7EAF0] mb-5">
                <Lock className="w-4 h-4 text-[#3659C9]" />
                <div>
                  <h3 className="font-semibold text-[#171B26] text-sm">Security & Password</h3>
                  <p className="text-[12px] text-[#697386] mt-0.5">
                    Update the password associated with your account.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white p-2.5 pr-9 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2.5 text-[#697386] hover:text-[#171B26] p-0.5"
                      tabIndex={-1}
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white p-2.5 pr-9 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-2.5 text-[#697386] hover:text-[#171B26] p-0.5"
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
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-[13px] font-medium text-white bg-[#171B26] hover:bg-[#2E3545] rounded-md shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
            <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-6">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#E7EAF0] mb-5">
                <div className="flex items-center space-x-2.5">
                  <Building2 className="w-4 h-4 text-[#3659C9]" />
                  <div>
                    <h3 className="font-semibold text-[#171B26] text-sm">Company Profile</h3>
                    <p className="text-[12px] text-[#697386]">
                      Organization details, brand assets, and workspace configuration for {currentOrg?.name}.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F0F4FE] text-[#3659C9] border border-[#3659C9]/20">
                  {currentRole} Access
                </span>
              </div>

              <form onSubmit={handleSaveCompany} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Company Name *</label>
                    <input
                      type="text"
                      required
                      disabled={!canEditOrg}
                      value={companyData.name}
                      onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white p-2.5 disabled:bg-[#F7F8FA] disabled:text-[#697386] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Unique Workspace Slug *</label>
                    <input
                      type="text"
                      required
                      disabled={!canEditOrg}
                      value={companyData.slug}
                      onChange={(e) => setCompanyData({ ...companyData, slug: e.target.value })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white p-2.5 font-mono disabled:bg-[#F7F8FA] disabled:text-[#697386] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Industry</label>
                    <input
                      type="text"
                      disabled={!canEditOrg}
                      placeholder="e.g. Events & Entertainment, SaaS, Logistics"
                      value={companyData.industry}
                      onChange={(e) => setCompanyData({ ...companyData, industry: e.target.value })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white p-2.5 disabled:bg-[#F7F8FA] disabled:text-[#697386] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Company Size</label>
                    <select
                      disabled={!canEditOrg}
                      value={companyData.company_size}
                      onChange={(e) => setCompanyData({ ...companyData, company_size: e.target.value })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white p-2.5 disabled:bg-[#F7F8FA] disabled:text-[#697386] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
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
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Corporate Website</label>
                  <input
                    type="url"
                    disabled={!canEditOrg}
                    placeholder="https://company.com"
                    value={companyData.website}
                    onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white p-2.5 disabled:bg-[#F7F8FA] disabled:text-[#697386] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  />
                </div>

                <LogoUpload
                  value={companyData.logo_url}
                  onChange={(url) => setCompanyData({ ...companyData, logo_url: url })}
                  disabled={!canEditOrg}
                  label="Company Brand / Logo"
                />

                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Company Description</label>
                  <textarea
                    rows={3}
                    disabled={!canEditOrg}
                    value={companyData.description}
                    onChange={(e) => setCompanyData({ ...companyData, description: e.target.value })}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white p-2.5 disabled:bg-[#F7F8FA] disabled:text-[#697386] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  />
                </div>

                <div className="pt-4 border-t border-[#E7EAF0] flex items-center justify-between">
                  <div className="text-[11px] text-[#697386]">
                    Created on {currentOrg?.created_at ? new Date(currentOrg.created_at).toLocaleDateString() : 'Recently'}
                  </div>

                  {canEditOrg && (
                    <div className="flex items-center space-x-2">
                      {companySaved && (
                        <span className="text-[12px] text-[#047857] font-medium flex items-center">
                          <Check className="w-3.5 h-3.5 mr-1" /> Settings Saved
                        </span>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmittingCompany}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-[13px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
              <div className="bg-white rounded-lg border border-[#B91C1C]/20 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-6">
                <div className="flex items-center space-x-2 text-[#B91C1C] mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <h3 className="font-semibold text-sm">Danger Zone</h3>
                </div>
                <p className="text-[12px] text-[#697386] mb-4">
                  Deleting an organization will permanently terminate access for all members and delete all associated CRM records, pipelines, contacts, and deal histories. This action is irreversible.
                </p>
                <button
                  type="button"
                  onClick={handleOpenDeleteModal}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-[13px] font-medium text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-md shadow-xs transition-colors cursor-pointer"
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
          <div className="bg-white rounded-lg border border-[#E7EAF0] p-8 text-center space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="w-10 h-10 bg-[#FFFBEB] text-[#B45309] rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#171B26]">Company Settings Restricted</h3>
            <p className="text-[12px] text-[#697386] max-w-sm mx-auto">
              Company profile and workspace preferences can only be viewed and modified by Organization Owners and Administrators.
            </p>
            <button
              onClick={() => setActiveTab('personal')}
              className="mt-2 inline-flex items-center px-3.5 py-1.5 rounded-md bg-[#171B26] text-white text-[12px] font-medium hover:bg-[#2E3545] transition-colors"
            >
              Go to Personal Settings
            </button>
          </div>
        )}
      </div>

      {/* Delete Organization UI Modal Box */}
      {isDeleteModalOpen && currentOrg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeletingOrg) setIsDeleteModalOpen(false);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] border border-[#E7EAF0] max-w-md w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Danger badge & Title */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#B91C1C] flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#171B26] leading-snug">
                    Delete Organization Workspace
                  </h3>
                  <p className="text-[12px] text-[#697386] mt-0.5">
                    This action is destructive and irreversible.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingOrg}
                className="text-[#697386] hover:text-[#171B26] p-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Message Card */}
            <div className="bg-[#FEF2F2]/60 rounded-lg border border-[#FECACA]/70 p-3 text-[12px] text-[#991B1B] leading-relaxed space-y-1.5">
              <p className="font-semibold">
                You are about to permanently delete <span className="underline">{currentOrg.name}</span>.
              </p>
              <p className="text-[11px] text-[#B91C1C]">
                All associated contacts, leads, opportunity deals, sales pipelines, assigned tasks, and member access permissions will be permanently removed.
              </p>
            </div>

            {/* Input Confirmation Field */}
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-[#171B26]">
                To verify, type <span className="font-semibold text-[#B91C1C] select-all font-mono">{currentOrg.name}</span> below:
              </label>
              <input
                type="text"
                value={deleteInputName}
                onChange={(e) => setDeleteInputName(e.target.value)}
                placeholder={currentOrg.name}
                disabled={isDeletingOrg}
                autoFocus
                className="w-full px-3 py-2 text-[13px] rounded-lg border border-[#E7EAF0] bg-[#F7F8FA] focus:bg-white text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] transition-all font-mono"
              />
            </div>

            {/* Buttons Footer */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E7EAF0]">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingOrg}
                className="px-3.5 py-2 text-[13px] font-medium text-[#171B26] hover:bg-[#F1F3F7] rounded-lg border border-[#E7EAF0] transition-colors disabled:opacity-40 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrg}
                disabled={isDeletingOrg || deleteInputName.trim() !== currentOrg.name}
                className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#B91C1C] hover:bg-[#991B1B] active:bg-[#7F1D1D] rounded-lg shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDeletingOrg ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Workspace...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Organization</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
