'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/client';
import { Mail, ArrowRight, KeyRound, CheckCircle2, ChevronLeft, Shield, Loader2 } from 'lucide-react';

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
    <div className="h-screen max-h-screen overflow-hidden bg-[#F7F8FA] flex flex-col lg:flex-row font-sans selection:bg-[#3659C9] selection:text-white">
      {/* LEFT COLUMN: Clean Brand & Connected Suite (Fixed, No Scroll) */}
      <div className="lg:w-[44%] xl:w-[40%] h-full max-h-screen overflow-hidden bg-[#0B0F19] text-white p-8 lg:p-12 flex flex-col justify-between relative flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#1E3A8A_0%,transparent_60%)] opacity-25 pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <Link
            href="/onboarding"
            className="inline-flex items-center space-x-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>

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

        <div className="relative z-10 my-8 space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug">
            Account recovery & security.
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed font-normal">
            Resetting your Niral password updates your credentials across all your joined CRM workspaces.
          </p>
        </div>

        <div className="relative z-10 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center space-x-2">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Encrypted Session Recovery</span>
          </div>
          <span>© 2026 NIRAL</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Reset Form (Scrollable only if needed) */}
      <div className="flex-1 h-full max-h-screen overflow-y-auto flex flex-col justify-start lg:justify-center items-center p-6 sm:p-10 lg:p-14 no-scrollbar">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E7EAF0] p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150 space-y-6">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#3659C9] flex items-center justify-center mb-3 border border-blue-100">
                <KeyRound className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-[#171B26] tracking-tight">Reset your password</h1>
              <p className="text-xs text-[#697386] mt-1">
                Enter your verified email and we&apos;ll send you a password reset link.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
                {errorMsg}
              </div>
            )}

            {isSent ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs text-center space-y-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="font-semibold text-sm">Reset instructions sent!</p>
                <p className="text-emerald-700">Check your inbox for further instructions.</p>
                <div className="pt-2">
                  <Link href="/onboarding?mode=signin" className="font-semibold text-[#3659C9] hover:underline">
                    Back to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171B26] mb-1.5">Email address *</label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-[#9AA2B1] absolute left-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-[#BAC0CE] focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-[#3659C9] hover:bg-[#2B47A1] text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isLoading ? 'Sending Link...' : 'Send Reset Link'}</span>
                  {!isLoading && <ArrowRight className="w-3.5 h-3.5" />}
                </button>

                <div className="text-center pt-2">
                  <Link href="/onboarding?mode=signin" className="text-xs text-[#697386] hover:text-[#171B26] transition-colors">
                    &larr; Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
