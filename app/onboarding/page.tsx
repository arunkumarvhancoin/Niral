'use client';

import React, { useState, Suspense } from 'react';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import {
  Building2,
  Plus,
  ArrowRight,
  Shield,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogoUpload } from '../../components/ui/logo-upload';
import { toast } from '../../lib/stores/toast-store';

function OnboardingContent() {
  const { currentUser, memberships, setCurrentOrg, refreshWorkspace, switchOrganization } = useWorkspace();
  const searchParams = useSearchParams();
  const initialStep = (searchParams.get('step') as 'select' | 'create') || 'select';

  const [step, setStep] = useState<'select' | 'create'>(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Create Form State
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

  const handleSelectOrg = async (orgId: string) => {
    try {
      await switchOrganization(orgId);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch organization');
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      const slug = createData.slug || createData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const { organization } = await CRMService.createOrganization(currentUser.id, {
        ...createData,
        slug,
      });

      // 1. Immediately activate new organization in store & cookie
      setCurrentOrg(organization, 'Owner', 'approved');

      // 2. Refresh memberships in background
      await refreshWorkspace(true, organization.id);

      toast.success(`Organization "${createData.name}" created!`);

      // 3. Directly enter dashboard
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl w-full">
      {step === 'select' && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-center mb-8">
            <img
              src="/niral-icon.png"
              alt="Niral"
              className="w-16 h-16 object-contain mx-auto mb-2 drop-shadow-sm"
            />
            <img
              src="/niral-wordmark.png"
              alt="NIRAL"
              className="h-5 w-auto object-contain mx-auto mb-2"
            />
            <p className="text-xs text-slate-500 mt-1">
              Signed in as <strong>{currentUser?.email}</strong>. Choose an organization you have joined or start a new company.
            </p>
          </div>

          {/* Section 1: Organizations you have joined */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Organizations You Have Joined ({approvedMemberships.length})
              </h2>
            </div>

            {approvedMemberships.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No organizations joined yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Create your first organization below to launch your CRM workspace.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {approvedMemberships.map((item) => (
                  <div
                    key={item.organization.id}
                    onClick={() => handleSelectOrg(item.organization.id)}
                    className="p-4 rounded-xl border border-slate-200 hover:border-primary-500 hover:shadow-md transition-all cursor-pointer bg-white flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 overflow-hidden flex-shrink-0">
                        {item.organization.logo_url ? (
                          <img
                            src={item.organization.logo_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-slate-900 text-sm group-hover:text-primary-600 transition-colors">
                            {item.organization.name}
                          </h3>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                              item.role === 'Owner'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : item.role === 'Admin'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {item.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.organization.industry || 'Business Operations'} &bull;{' '}
                          {item.organization.company_size || 'Team'}
                        </p>
                      </div>
                    </div>

                    <button className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-50 group-hover:bg-primary-600 group-hover:text-white text-slate-700 text-xs font-semibold transition-all">
                      <span>Enter Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Create a New Organization */}
          <div className="pt-6 border-t border-slate-100">
            <div
              onClick={() => setStep('create')}
              className="p-5 rounded-xl border-2 border-dashed border-slate-300 hover:border-primary-500 hover:bg-primary-50/20 text-left transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Create a New Organization</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Start a fresh workspace for a new company. You will automatically be assigned the Owner role.
                  </p>
                </div>
              </div>
              <div className="flex items-center text-xs font-semibold text-primary-600 pl-4 flex-shrink-0">
                <span>Create &rarr;</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: CREATE NEW ORGANIZATION FORM */}
      {step === 'create' && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Create New Organization</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set up a new isolated business workspace. You will be its <strong>Owner</strong>.
              </p>
            </div>
            <button
              onClick={() => setStep('select')}
              className="text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              &larr; Back to organizations
            </button>
          </div>

          <form onSubmit={handleCreateCompany} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Global Solutions"
                value={createData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setCreateData({
                    ...createData,
                    name,
                    slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                  });
                }}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Workspace Slug *</label>
              <div className="flex items-center">
                <span className="text-xs text-slate-400 bg-slate-100 px-3 py-2.5 rounded-l-lg border border-r-0 border-slate-300">
                  app.crm.com/
                </span>
                <input
                  type="text"
                  required
                  placeholder="apex-global"
                  value={createData.slug}
                  onChange={(e) => setCreateData({ ...createData, slug: e.target.value })}
                  className="w-full text-xs rounded-r-lg border border-slate-300 p-2.5 font-mono focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise Cloud, Fintech"
                  value={createData.industry}
                  onChange={(e) => setCreateData({ ...createData, industry: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Size</label>
                <select
                  value={createData.company_size}
                  onChange={(e) => setCreateData({ ...createData, company_size: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="1-10 employees">1-10 employees</option>
                  <option value="10-50 employees">10-50 employees</option>
                  <option value="50-200 employees">50-200 employees</option>
                  <option value="200+ employees">200+ employees</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Website</label>
              <input
                type="url"
                placeholder="https://company.example.com"
                value={createData.website}
                onChange={(e) => setCreateData({ ...createData, website: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <LogoUpload
              value={createData.logo_url}
              onChange={(url) => setCreateData({ ...createData, logo_url: url })}
              label="Company Brand / Logo (Optional)"
            />

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
              >
                {isSubmitting ? 'Creating Company...' : 'Create & Enter Workspace'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <Suspense fallback={<div className="text-xs text-slate-400">Loading workspaces...</div>}>
        <OnboardingContent />
      </Suspense>
    </div>
  );
}
