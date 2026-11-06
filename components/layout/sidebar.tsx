'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OrganizationSwitcher } from './organization-switcher';
import {
  LayoutDashboard,
  Users2,
  Target,
  BarChart3,
  CheckSquare,
  History,
  ShieldAlert,
  Settings,
  UserCheck,
  Building,
  LogOut,
  BookOpen,
} from 'lucide-react';
import { useWorkspace } from '../providers/workspace-provider';
import { useTutorialStore } from '../../lib/stores/tutorial-store';
import { hasPermission } from '../../lib/permissions';

export function Sidebar() {
  const pathname = usePathname();
  const { currentRole, currentStatus, currentUser, signOut } = useWorkspace();
  const { openTutorial } = useTutorialStore();

  const canViewTeam = currentRole === 'Owner' || currentRole === 'Admin' || currentRole === 'Manager';

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Contacts', href: '/contacts', icon: Users2 },
    { name: 'Leads', href: '/leads', icon: Target },
    { name: 'Deals', href: '/deals', icon: BarChart3 },
    { name: 'Tasks & Feed', href: '/tasks', icon: CheckSquare },
    ...(canViewTeam ? [{ name: 'Team', href: '/team', icon: UserCheck }] : []),
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-200/80 bg-white flex flex-col h-screen sticky top-0 select-none flex-shrink-0 z-20">
      {/* Niral Brand Header */}
      <div className="flex items-center space-x-2.5 px-4 py-3.5 border-b border-slate-100">
        <img src="/niral-icon.png" alt="Niral" className="w-8 h-8 object-contain flex-shrink-0" />
        <img src="/niral-wordmark.png" alt="NIRAL" className="h-4 w-auto object-contain" />
      </div>

      {/* Workspace Switcher Header */}
      <div className="p-3 border-b border-slate-200/80">
        <OrganizationSwitcher />
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary-50 text-primary-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* Quick Tour Button */}
        <div className="pt-2 mt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => openTutorial(0)}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold text-primary-700 bg-primary-50/70 hover:bg-primary-100/80 transition-colors cursor-pointer text-left"
          >
            <BookOpen className="w-4 h-4 text-primary-600 flex-shrink-0" />
            <span>CRM Quick Tour</span>
          </button>
        </div>
      </div>

      {/* Footer / User Account docked at the absolute bottom */}
      <div className="p-3 border-t border-slate-200/80 bg-white mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs flex-shrink-0">
              {currentUser?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                {currentUser?.full_name || currentUser?.email?.split('@')[0] || 'User'}
              </p>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                  currentRole === 'Owner'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : currentRole === 'Admin'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : currentRole === 'Manager'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  {currentRole || 'Owner'}
                </span>
                <span className="text-[11px] text-slate-400 truncate max-w-[90px]">
                  {currentUser?.email}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

