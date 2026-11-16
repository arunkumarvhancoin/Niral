'use client';

import React from 'react';
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
} from 'lucide-react';
import { useWorkspace } from '../providers/workspace-provider';
import { hasPermission, isBharatPlay } from '../../lib/permissions';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { currentOrg, currentRole, currentStatus, currentUser, signOut } = useWorkspace();

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

  const sidebarContent = (
    <>
      {/* Niral Brand Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E7EAF0]">
        <div className="flex items-center space-x-2.5">
          <img src="/niral-icon.png" alt="Niral" className="w-7 h-7 object-contain flex-shrink-0" />
          <img src="/niral-wordmark.png" alt="NIRAL" className="h-3.5 w-auto object-contain" />
        </div>
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

      {/* Workspace Switcher Header */}
      <div className="p-2.5 border-b border-[#E7EAF0]">
        <OrganizationSwitcher />
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
      <div className="p-3 border-t border-[#E7EAF0] bg-white mt-auto">
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

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-[#E7EAF0] bg-white flex-col h-screen sticky top-0 select-none flex-shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden animate-in fade-in duration-150"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Slide-over Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col h-full select-none shadow-2xl transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

