'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OrganizationSwitcher } from './organization-switcher';
import {
  LayoutDashboard,
  Users2,
  Target,
  Ticket,
  BarChart3,
  CheckSquare,
  History,
  ShieldAlert,
  Settings,
  UserCheck,
  Building,
  LogOut,
  X,
  Pin,
} from 'lucide-react';
import { useWorkspace } from '../providers/workspace-provider';
import { hasPermission, isBharatPlay } from '../../lib/permissions';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { currentOrg, currentRole, currentStatus, currentUser, signOut } = useWorkspace();

  // Desktop Pinned vs Collapsed hover state
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('niral_sidebar_pinned');
      if (saved !== null) {
        setIsPinned(saved === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSetPinned = (pinned: boolean) => {
    setIsPinned(pinned);
    try {
      localStorage.setItem('niral_sidebar_pinned', String(pinned));
    } catch {
      // ignore
    }
  };

  const canViewTeam = currentRole === 'Owner' || currentRole === 'Admin' || currentRole === 'Manager';
  const isBharatPlayOrg = isBharatPlay(currentOrg);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Contacts', href: '/contacts', icon: Users2 },
    { name: 'Leads', href: '/leads', icon: Target },
    ...(isBharatPlayOrg ? [{ name: 'Registrations', href: '/registrations', icon: Ticket }] : []),
    { name: 'Deals', href: '/deals', icon: BarChart3 },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    ...(canViewTeam ? [{ name: 'Team', href: '/team', icon: UserCheck }] : []),
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const renderContent = (collapsed: boolean) => {
    if (collapsed) {
      return (
        <>
          {/* Niral Brand Header (Collapsed: Icon only) */}
          <div className="flex items-center justify-center h-14 border-b border-[#E7EAF0] px-2 relative group flex-shrink-0">
            <Link
              href="/"
              className="hover:opacity-85 transition-opacity"
              title="Niral"
            >
              <img
                src="/niral-icon.png"
                alt="Niral"
                className="w-7 h-7 object-contain flex-shrink-0"
              />
            </Link>
          </div>

          {/* Workspace Switcher (Collapsed: Logo/Icon button) */}
          <div className="p-2 border-b border-[#E7EAF0] flex justify-center flex-shrink-0">
            <OrganizationSwitcher isCollapsed={true} />
          </div>

          {/* Navigation Items (Icons only with tooltips) */}
          <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-center w-10 h-10 mx-auto rounded-md transition-colors relative group ${
                    isActive
                      ? 'bg-[#F0F4FE] text-[#3659C9] font-medium shadow-[0_1px_2px_rgba(54,89,201,0.08)]'
                      : 'text-[#4A5568] hover:text-[#171B26] hover:bg-[#F1F3F7]'
                  }`}
                  aria-label={item.name}
                >
                  <item.icon className={`w-4 h-4 transition-colors flex-shrink-0 ${isActive ? 'text-[#3659C9]' : 'text-[#697386]'}`} />
                  
                  {/* Floating Tooltip */}
                  <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded bg-[#171B26] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Footer / User Account docked at bottom (Collapsed) */}
          <div className="p-2 border-t border-[#E7EAF0] bg-white mt-auto flex flex-col items-center space-y-2 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-full bg-[#E2EAFA] text-[#3659C9] flex items-center justify-center text-xs font-semibold flex-shrink-0 cursor-default relative group"
            >
              {currentUser?.email?.[0]?.toUpperCase() || 'U'}
              <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded bg-[#171B26] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md">
                {currentUser?.full_name || currentUser?.email?.split('@')[0] || 'User'} ({currentRole || 'Owner'})
              </span>
            </div>

            <button
              onClick={signOut}
              className="w-8 h-8 flex items-center justify-center text-[#697386] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-md transition-colors relative group"
              aria-label="Sign Out"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded bg-[#171B26] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md">
                Sign Out
              </span>
            </button>

            <button
              onClick={() => handleSetPinned(true)}
              className="w-8 h-8 flex items-center justify-center text-[#697386] hover:text-[#3659C9] hover:bg-[#F0F4FE] rounded-md transition-colors relative group border border-[#E7EAF0]"
              aria-label="Pin sidebar to stay open"
              title="Click to stay open (Pin)"
            >
              <Pin className="w-4 h-4" />
              <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded bg-[#171B26] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md">
                Click to stay open (Pin)
              </span>
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        {/* Niral Brand Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-[#E7EAF0] flex-shrink-0">
          <Link
            href="/"
            onClick={() => onMobileClose?.()}
            className="flex items-center space-x-2.5 hover:opacity-85 transition-opacity cursor-pointer group"
            title="Niral"
          >
            <img
              src="/niral-icon.png"
              alt="Niral"
              className="w-7 h-7 object-contain flex-shrink-0 group-hover:scale-105 transition-transform"
            />
            <img
              src="/niral-wordmark.png"
              alt="NIRAL"
              className="h-3.5 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center space-x-1">
            {/* Desktop Pin / Unpin Button */}
            <button
              onClick={() => handleSetPinned(!isPinned)}
              className={`hidden md:flex p-1.5 rounded-md transition-colors ${
                isPinned
                  ? 'text-[#3659C9] bg-[#F0F4FE] hover:bg-[#E2EAFA]'
                  : 'text-[#697386] hover:text-[#3659C9] hover:bg-[#F0F4FE]'
              }`}
              title={isPinned ? 'Unpin sidebar (hover to expand)' : 'Pin sidebar to stay open'}
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'fill-[#3659C9] rotate-45' : ''} transition-transform`} />
            </button>

            {onMobileClose && (
              <button
                onClick={onMobileClose}
                className="md:hidden p-1.5 rounded-md text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Workspace Switcher Header */}
        <div className="p-2.5 border-b border-[#E7EAF0] flex-shrink-0">
          <OrganizationSwitcher isCollapsed={false} />
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onMobileClose?.()}
                className={`flex items-center space-x-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[#F0F4FE] text-[#3659C9] font-medium shadow-[0_1px_2px_rgba(54,89,201,0.08)]'
                    : 'text-[#4A5568] hover:text-[#171B26] hover:bg-[#F1F3F7] font-normal'
                }`}
              >
                <item.icon className={`w-4 h-4 transition-colors flex-shrink-0 ${isActive ? 'text-[#3659C9]' : 'text-[#697386]'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer / User Account docked at the absolute bottom */}
        <div className="p-3 border-t border-[#E7EAF0] bg-white mt-auto flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#E2EAFA] text-[#3659C9] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {currentUser?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="truncate">
                <p className="text-[13px] font-medium text-[#171B26] truncate leading-tight">
                  {currentUser?.full_name || currentUser?.email?.split('@')[0] || 'User'}
                </p>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                    currentRole === 'Owner'
                      ? 'bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]'
                      : currentRole === 'Admin'
                      ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                      : currentRole === 'Manager'
                      ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                      : 'bg-[#F7F8FA] text-[#697386] border-[#E7EAF0]'
                  }`}>
                    {currentRole || 'Owner'}
                  </span>
                  <span className="text-[11px] text-[#697386] truncate max-w-[90px]">
                    {currentUser?.email}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 text-[#697386] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-md transition-colors ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </>
    );
  };

  const isCollapsed = !isPinned && !isHovered;

  return (
    <>
      {/* Desktop Persistent Sidebar with Hover Expand & Pin to Stay */}
      <div
        className="hidden md:block select-none flex-shrink-0 transition-all duration-200 ease-in-out"
        style={{ width: isPinned ? '16rem' : '4rem' }}
      >
        <aside
          onMouseEnter={() => !isPinned && setIsHovered(true)}
          onMouseLeave={() => !isPinned && setIsHovered(false)}
          className={`border-r border-[#E7EAF0] bg-white flex flex-col h-screen fixed top-0 left-0 transition-all duration-200 ease-in-out select-none ${
            isPinned
              ? 'w-64 z-20 shadow-none'
              : isHovered
              ? 'w-64 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.14)]'
              : 'w-16 z-20 shadow-none'
          }`}
        >
          {renderContent(isCollapsed)}
        </aside>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden animate-in fade-in duration-150"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Slide-over Drawer (Always fully expanded for mobile touch) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col h-full select-none shadow-2xl transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderContent(false)}
      </aside>
    </>
  );
}
