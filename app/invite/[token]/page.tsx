'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '../../../components/providers/workspace-provider';
import { CRMService } from '../../../lib/services/crm-service';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

export default function InviteAcceptancePage() {
  const params = useParams();
  const token = params.token as string;
  const { currentUser, refreshWorkspace, switchOrganization } = useWorkspace();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successOrgId, setSuccessOrgId] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { organizationId } = await CRMService.acceptInvitation(token, currentUser.id);
      setSuccessOrgId(organizationId);
      await refreshWorkspace();
      setTimeout(async () => {
        await switchOrganization(organizationId);
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center animate-in fade-in zoom-in-95 duration-150">
          <img
            src="/niral-icon.png"
            alt="Niral"
            className="w-16 h-16 object-contain mx-auto mb-2 drop-shadow-sm"
          />
          <img
            src="/niral-wordmark.png"
            alt="NIRAL"
            className="h-5 w-auto object-contain mx-auto mb-3"
          />
          <p className="text-xs text-slate-500 mt-1">
            You have received an invitation to join a workspace on Niral.
          </p>

          <div className="my-6 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-left text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span>Token:</span>
              <span className="font-mono text-slate-800">{token.substring(0, 16)}...</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Signed In As:</span>
              <span className="font-semibold text-slate-900">{currentUser?.email}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start space-x-2 text-left mb-4">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successOrgId ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center justify-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Invitation Accepted! Redirecting to workspace...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleAccept}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                <span>{isLoading ? 'Verifying & Joining...' : 'Accept Invitation & Enter Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Decline or Return to App
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

