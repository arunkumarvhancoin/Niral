'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../providers/workspace-provider';
import { usePathname } from 'next/navigation';
import {
  CheckCircle,
  Clock,
  User,
  LogOut,
  ExternalLink,
  HelpCircle,
  ChevronRight,
  Shield,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { useTutorialStore } from '../../lib/stores/tutorial-store';

export function Header() {
  const { currentUser, currentOrg, currentRole, currentStatus, signOut } = useWorkspace();
  const { openTutorial } = useTutorialStore();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return ['Dashboard'];
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).replace('-', ' '));
  };

  return (
    <header className="h-14 border-b border-slate-200/80 bg-white px-6 flex items-center justify-between z-30 flex-shrink-0">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-slate-500">
        <span className="font-medium text-slate-900">{currentOrg?.name || 'Workspace'}</span>
        {getBreadcrumbs().map((crumb, idx) => (
          <React.Fragment key={crumb + idx}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-700 font-medium">{crumb}</span>
          </React.Fragment>
        ))}
      </div>

      {/* Action items */}
      <div className="flex items-center space-x-3">
        {/* Quick Tour Button */}
        <button
          type="button"
          onClick={() => openTutorial(0)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-primary-700 bg-slate-100/80 hover:bg-primary-50 rounded-lg border border-slate-200/80 transition-colors"
          title="Open CRM Interactive Tutorial"
        >
          <BookOpen className="w-3.5 h-3.5 text-primary-600" />
          <span className="hidden sm:inline">Guide & Tour</span>
        </button>

        {/* User profile dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 p-1 pl-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center text-xs font-semibold text-slate-700">
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                currentUser?.full_name?.charAt(0) || 'U'
              )}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-medium text-slate-800 leading-tight">
                {currentUser?.full_name || 'Signed In'}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight">{currentUser?.email}</span>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
              <div className="px-3 py-2 border-b border-slate-100 text-xs">
                <div className="font-semibold text-slate-900">{currentUser?.full_name}</div>
                <div className="text-slate-500 truncate">{currentUser?.email}</div>
                <div className="mt-1.5 flex items-center space-x-1">
                  <Shield className="w-3 h-3 text-primary-600" />
                  <span className="text-[11px] font-medium text-slate-700">
                    Role in {currentOrg?.name}: <strong>{currentRole}</strong>
                  </span>
                </div>
              </div>
              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Account & Organization Settings</span>
              </Link>
              <Link
                href="/onboarding"
                onClick={() => setShowUserMenu(false)}
                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span>Workspaces & Discovery</span>
              </Link>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  signOut();
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

