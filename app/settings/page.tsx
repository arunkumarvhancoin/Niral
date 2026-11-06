'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { hasPermission } from '../../lib/permissions';
import {
  Building2,
  Globe,
  Users,
  Shield,
  Save,
  Trash2,
  AlertTriangle,
  Check,
  Briefcase,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LogoUpload } from '../../components/ui/logo-upload';
import { toast } from '../../lib/stores/toast-store';

export default function SettingsPage() {
  const { currentOrg, currentRole, currentStatus, currentUser, refreshWorkspace } = useWorkspace();
  const [prevOrgId, setPrevOrgId] = useState(currentOrg?.id);
  const [formData, setFormData] = useState({
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
    setFormData({
      name: currentOrg.name || '',
      slug: currentOrg.slug || '',
      industry: currentOrg.industry || '',
      company_size: currentOrg.company_size || '',
      website: currentOrg.website || '',
      description: currentOrg.description || '',
      logo_url: currentOrg.logo_url || '',
    });
  }

  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const canEdit = hasPermission(currentRole, currentStatus, 'org:settings:update');
  const canDelete = hasPermission(currentRole, currentStatus, 'org:delete');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !canEdit) return;
    setIsSubmitting(true);
    try {
      await CRMService.updateOrganization(currentOrg.id, formData);
      await refreshWorkspace();
      setIsSaved(true);
      toast.success('Organization settings updated successfully!');
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!currentOrg || !canDelete) return;
    const confirmName = prompt(
      `CAUTION: Deleting this organization will permanently erase all contacts, deals, tasks, and audit logs. Type "${currentOrg.name}" to confirm:`
    );
    if (confirmName !== currentOrg.name) {
      toast.error('Organization name did not match. Deletion cancelled.');
      return;
    }

    try {
      // Delete organization and memberships
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
            Organization details and workspace preferences for {currentOrg?.name}.
          </p>
        </div>

        {/* General Info Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center space-x-2.5">
              <Building2 className="w-5 h-5 text-primary-600" />
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Company Profile</h3>
                <p className="text-xs text-slate-500">Visible to team members and in invitations.</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              Role: {currentRole}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Unique Workspace Slug *</label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 font-mono disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Industry</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  placeholder="e.g. Enterprise Software, Biotechnology"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Company Size</label>
                <select
                  disabled={!canEdit}
                  value={formData.company_size}
                  onChange={(e) => setFormData({ ...formData, company_size: e.target.value })}
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Corporate Website</label>
              <input
                type="url"
                disabled={!canEdit}
                placeholder="https://company.com"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <LogoUpload
              value={formData.logo_url}
              onChange={(url) => setFormData({ ...formData, logo_url: url })}
              disabled={!canEdit}
              label="Company Brand / Logo"
            />

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company Description</label>
              <textarea
                rows={3}
                disabled={!canEdit}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                Created on {currentOrg?.created_at ? new Date(currentOrg.created_at).toLocaleDateString() : 'Recently'}
              </div>

              {canEdit && (
                <div className="flex items-center space-x-2">
                  {isSaved && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center">
                      <Check className="w-3.5 h-3.5 mr-1" /> Changes Saved
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Saving...' : 'Save Settings'}</span>
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Danger Zone */}
        {canDelete && (
          <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-6">
            <div className="flex items-center space-x-2.5 text-rose-700 mb-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-sm">Danger Zone</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Deleting an organization will permanently terminate access for all members and delete all associated CRM records, pipelines, contacts, and deal histories. This action is irreversible.
            </p>
            <button
              onClick={handleDeleteOrganization}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Organization Workspace</span>
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

