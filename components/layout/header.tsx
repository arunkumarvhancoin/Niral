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
  Menu,
  Building2,
  ChevronDown,
  Filter,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  onOpenMobileSidebar?: () => void;
}

export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const {
    currentUser,
    currentOrg,
    currentRole,
    currentStatus,
    signOut,
    isSuperAdmin: isSuper,
    memberships,
    effectiveOrgIds,
    isAllOrgsSelected,
    isMultiOrgActive,
    selectAllOrgs,
    selectCurrentOrgOnly,
    toggleOrgSelection,
  } = useWorkspace();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHeaderOrgMenu, setShowHeaderOrgMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerOrgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (headerOrgRef.current && !headerOrgRef.current.contains(e.target as Node)) {
        setShowHeaderOrgMenu(false);
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
    <header className="h-14 border-b border-[#E7EAF0] bg-white px-3.5 sm:px-6 flex items-center justify-between z-30 flex-shrink-0">
      {/* Left: Hamburger (mobile) + Breadcrumbs */}
      <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-1.5 -ml-1 rounded-md text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] transition-colors flex-shrink-0"
          aria-label="Open sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-1.5 sm:space-x-2 text-[13px] text-[#697386] truncate">
          <span className="font-medium text-[#171B26] truncate max-w-[110px] sm:max-w-xs">{currentOrg?.name || 'Workspace'}</span>
          {getBreadcrumbs().map((crumb, idx) => (
            <React.Fragment key={crumb + idx}>
              <ChevronRight className="w-3.5 h-3.5 text-[#9AA2B1] flex-shrink-0" />
              <span className="text-[#171B26] font-medium truncate">{crumb}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Action items */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Super Admin Global Multi-Org Switcher */}
        {isSuper && (
          <div className="relative" ref={headerOrgRef}>
            <button
              onClick={() => setShowHeaderOrgMenu(!showHeaderOrgMenu)}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                isMultiOrgActive || isAllOrgsSelected
                  ? 'bg-[#F0F4FE] text-[#3659C9] border-[#C7D6F5] hover:bg-[#E2EAFA]'
                  : 'bg-[#F7F8FA] text-[#171B26] border-[#E7EAF0] hover:bg-[#F1F3F7]'
              }`}
              title="Super Admin Multi-Organization Filter"
            >
              <Shield className="w-3.5 h-3.5 text-[#3659C9] flex-shrink-0" />
              <span className="hidden sm:inline">
                {isAllOrgsSelected
                  ? `All Orgs (${memberships.length})`
                  : `${effectiveOrgIds.length} Orgs`}
              </span>
              <span className="sm:hidden">{effectiveOrgIds.length} Orgs</span>
              <ChevronDown className="w-3 h-3 text-[#697386]" />
            </button>

            {showHeaderOrgMenu && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white text-[#171B26] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[#E7EAF0] z-50 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#E7EAF0]">
                  <div className="flex items-center space-x-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#3659C9]" />
                    <span className="text-xs font-semibold text-[#171B26]">Multi-Org Selection</span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllOrgs}
                      className="text-[#3659C9] hover:underline font-medium"
                    >
                      All
                    </button>
                    <span className="text-[#E7EAF0]">|</span>
                    <button
                      type="button"
                      onClick={selectCurrentOrgOnly}
                      className="text-[#697386] hover:text-[#171B26]"
                    >
                      Current
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-0.5 py-1">
                  {memberships
                    .filter((m) => m.status === 'approved')
                    .map((m) => {
                      const isChecked = effectiveOrgIds.includes(m.organization.id);
                      return (
                        <label
                          key={m.organization.id}
                          className="flex items-center space-x-2.5 p-1.5 rounded-md hover:bg-[#F1F3F7] cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOrgSelection(m.organization.id)}
                            className="w-3.5 h-3.5 rounded text-[#3659C9] border-[#E7EAF0] focus:ring-[#3659C9]"
                          />
                          <span className="font-medium text-[#171B26] truncate flex-1">
                            {m.organization.name}
                          </span>
                          {m.organization.id === currentOrg?.id && (
                            <span className="text-[10px] text-[#3659C9] font-medium bg-[#F0F4FE] border border-[#C7D6F5] px-1.5 py-0.2 rounded">
                              Active
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* User profile dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 p-1 pl-1.5 rounded-md hover:bg-[#F1F3F7] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#E2EAFA] text-[#3659C9] overflow-hidden flex items-center justify-center text-xs font-semibold">
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                currentUser?.full_name?.charAt(0) || 'U'
              )}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-medium text-[#171B26] leading-tight">
                {currentUser?.full_name || 'Signed In'}
              </span>
              <span className="text-[10px] text-[#697386] leading-tight">{currentUser?.email}</span>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[#E7EAF0] py-1 z-50">
              <div className="px-3 py-2 border-b border-[#E7EAF0] text-xs">
                <div className="font-medium text-[#171B26]">{currentUser?.full_name}</div>
                <div className="text-[#697386] truncate">{currentUser?.email}</div>
                <div className="mt-1 flex items-center space-x-1">
                  <Shield className="w-3 h-3 text-[#3659C9]" />
                  <span className="text-[11px] text-[#697386]">
                    Role: <strong className="text-[#171B26] font-medium">{currentRole}</strong>
                  </span>
                </div>
              </div>
              <Link
                href="/settings?tab=personal"
                onClick={() => setShowUserMenu(false)}
                className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-[#171B26] hover:bg-[#F1F3F7] transition-colors"
              >
                <User className="w-3.5 h-3.5 text-[#697386]" />
                <span>Personal Settings</span>
              </Link>
              {(currentRole === 'Owner' || currentRole === 'Admin') && (
                <Link
                  href="/settings?tab=company"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-[#171B26] hover:bg-[#F1F3F7] transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#697386]" />
                  <span>Company Settings</span>
                </Link>
              )}
              <Link
                href="/onboarding"
                onClick={() => setShowUserMenu(false)}
                className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-[#171B26] hover:bg-[#F1F3F7] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#697386]" />
                <span>Workspaces & Discovery</span>
              </Link>
              <Link
                href="/"
                onClick={() => setShowUserMenu(false)}
                className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs font-medium text-[#3659C9] hover:bg-blue-50 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#3659C9]" />
                <span>Niral Suite & Other Services</span>
              </Link>
              <div className="border-t border-[#E7EAF0] my-1" />
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  signOut();
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors text-left"
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

