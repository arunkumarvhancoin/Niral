'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../providers/workspace-provider';
import {
  ChevronDown,
  Building2,
  Plus,
  Compass,
  Check,
  Clock,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/navigation';
import { useRouter } from 'next/navigation';

export function OrganizationSwitcher() {
  const { currentOrg, currentRole, memberships, switchOrganization } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const approvedMemberships = memberships.filter((m) => m.status === 'approved');
  const pendingMemberships = memberships.filter((m) => m.status === 'pending');

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Owner':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Admin':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Manager':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Employee':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 transition-colors shadow-sm text-left group"
      >
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-primary-600 flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-xs overflow-hidden">
            {currentOrg?.logo_url ? (
              <img src={currentOrg.logo_url} alt={currentOrg.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-4 h-4 text-white" />
            )}
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate">
            {currentOrg?.name || 'Select Workspace'}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform ml-2 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
            Approved Workspaces
          </div>

          <div className="max-h-56 overflow-y-auto px-1.5 space-y-1">
            {approvedMemberships.map((item) => {
              const isSelected = item.organization.id === currentOrg?.id;
              return (
                <button
                  key={item.organization.id}
                  onClick={() => {
                    switchOrganization(item.organization.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-slate-100/90 text-slate-900 font-medium'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.organization.logo_url ? (
                        <img src={item.organization.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-sm truncate">{item.organization.name}</span>
                      <span className="text-[11px] text-slate-500 capitalize">{item.role}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary-600 flex-shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Pending memberships */}
          {pendingMemberships.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 px-3">
              <div className="flex items-center space-x-1.5 text-xs font-medium text-amber-600 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Pending Approvals ({pendingMemberships.length})</span>
              </div>
              <div className="space-y-1">
                {pendingMemberships.map((item) => (
                  <div
                    key={item.organization.id}
                    className="p-1.5 bg-amber-50/60 rounded text-xs text-amber-800 flex items-center justify-between"
                  >
                    <span className="truncate">{item.organization.name}</span>
                    <span className="text-[10px] bg-amber-200/70 px-1 py-0.5 rounded text-amber-900">Awaiting Admin</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-slate-100 px-1.5 space-y-1">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/onboarding?step=create');
              }}
              className="w-full flex items-center space-x-2.5 p-2 rounded-lg text-slate-700 hover:bg-slate-50 text-sm transition-colors text-left font-medium"
            >
              <div className="w-6 h-6 rounded border border-dashed border-slate-300 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <span>Create New Organization</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/onboarding');
              }}
              className="w-full flex items-center space-x-2.5 p-2 rounded-lg text-slate-700 hover:bg-slate-50 text-sm transition-colors text-left font-medium"
            >
              <div className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <span>View All Organizations</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

