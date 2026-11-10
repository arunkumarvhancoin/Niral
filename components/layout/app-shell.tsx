'use client';

import React, { useState } from 'react';
import { useWorkspace } from '../providers/workspace-provider';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { ToastContainer } from '../ui/toast-container';
import { ShieldAlert, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentOrg, currentRole, currentStatus, isLoading } = useWorkspace();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Only show initial loading screen if we don't have an organization yet
  if (isLoading && !currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  // Handle suspended, revoked, or pending membership state
  if (currentStatus && currentStatus !== 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
          {currentStatus === 'pending' ? (
            <>
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Membership Pending Approval</h2>
              <p className="text-sm text-slate-600 mb-6">
                Your request to join <strong>{currentOrg?.name}</strong> has been submitted and is currently awaiting administrator approval. You cannot access company records until approved.
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Access Suspended or Revoked</h2>
              <p className="text-sm text-slate-600 mb-6">
                Your membership status in <strong>{currentOrg?.name}</strong> is currently <strong>{currentStatus}</strong>. You do not have permission to view or manage company records.
              </p>
            </>
          )}

          <div className="space-y-3">
            <Link
              href="/onboarding"
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition-colors"
            >
              <span>Switch Organization or Create New</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
