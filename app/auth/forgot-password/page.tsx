'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/client';
import { Mail, ArrowRight, KeyRound, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      setIsSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto mb-3 border border-slate-200">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset your password</h1>
            <p className="text-xs text-slate-500 mt-1">
              Enter your verified email and we&apos;ll send you a password reset link
            </p>
          </div>

          {isSent ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs text-center space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <p className="font-semibold">Reset instructions sent!</p>
              <p className="text-emerald-700">Check your inbox for further instructions.</p>
              <div className="pt-2">
                <Link href="/auth/login" className="font-semibold underline">
                  Back to login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                <span>{isLoading ? 'Sending Link...' : 'Send Password Reset Link'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <Link href="/auth/login" className="text-xs text-slate-500 hover:text-slate-800 font-medium">
              &larr; Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

