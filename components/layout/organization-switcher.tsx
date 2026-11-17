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
  Loader2,
  Search,
  X,
  Sparkles,
} from 'lucide-react';
import Link from 'next/navigation';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from '../../lib/stores/toast-store';
import { isSuperAdmin } from '../../lib/permissions';

export function OrganizationSwitcher() {
  const { currentOrg, currentRole, currentUser, memberships, switchOrganization, isSwitchingOrg } = useWorkspace();
  const isSuper = isSuperAdmin(currentUser);
  const [isOpen, setIsOpen] = useState(false);
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === currentOrg?.id && pathname === '/dashboard') {
      setIsOpen(false);
      return;
    }
    setSwitchingOrgId(orgId);
    try {
      await switchOrganization(orgId);
      setIsOpen(false);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch workspace');
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const approvedMemberships = memberships.filter((m) => m.status === 'approved');
  const pendingMemberships = memberships.filter((m) => m.status === 'pending');

  const filteredApproved = approvedMemberships.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.organization.name.toLowerCase().includes(q) ||
      (item.organization.slug && item.organization.slug.toLowerCase().includes(q)) ||
      item.role.toLowerCase().includes(q)
    );
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Owner':
        return 'bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]';
      case 'Admin':
        return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]';
      case 'Manager':
        return 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
      case 'Employee':
        return 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]';
      default:
        return 'bg-[#F7F8FA] text-[#697386] border-[#E7EAF0]';
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitchingOrg}
        className="w-full flex items-center justify-between p-2 rounded-md border border-[#E7EAF0] bg-white hover:bg-[#F1F3F7] transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.03)] text-left group disabled:opacity-75"
      >
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-md bg-[#F1F3F7] border border-[#E7EAF0] flex items-center justify-center text-[#3659C9] font-medium flex-shrink-0 overflow-hidden">
            {isSwitchingOrg ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3659C9]" />
            ) : currentOrg?.logo_url ? (
              <img src={currentOrg.logo_url} alt={currentOrg.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-3.5 h-3.5 text-[#3659C9]" />
            )}
          </div>
          <span className="text-[13px] font-medium text-[#171B26] truncate">
            {isSwitchingOrg ? 'Switching...' : currentOrg?.name || 'Select Workspace'}
          </span>
        </div>
        {isSwitchingOrg ? (
          <Loader2 className="w-3.5 h-3.5 text-[#3659C9] animate-spin ml-2 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[#697386] group-hover:text-[#171B26] transition-transform ml-2 flex-shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-80 bg-white rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[#E7EAF0] z-50 py-1.5 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-medium text-[#697386] uppercase tracking-wider">
            <span>{isSuper ? `All Organizations (${approvedMemberships.length})` : `Workspaces (${approvedMemberships.length})`}</span>
            {isSuper && (
              <span className="text-[10px] bg-[#F5F3FF] text-[#5B21B6] border border-[#DDD6FE] px-1.5 py-0.5 rounded font-medium">
                Super Admin
              </span>
            )}
          </div>

          {/* Quick search filter for multiple organizations */}
          {approvedMemberships.length > 2 && (
            <div className="px-2 pt-0.5 pb-1.5">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-[#697386] absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search organizations..."
                  className="w-full pl-8 pr-7 py-1 text-[12px] bg-[#F7F8FA] border border-[#E7EAF0] rounded-md text-[#171B26] placeholder-[#697386] focus:outline-none focus:border-[#3659C9] focus:bg-white transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-[#697386] hover:text-[#171B26] p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto px-1.5 space-y-0.5">
            {filteredApproved.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#697386]">
                No organizations matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredApproved.map((item) => {
                const isSelected = item.organization.id === currentOrg?.id;
                const isItemSwitching = switchingOrgId === item.organization.id;
                return (
                  <button
                    key={item.organization.id}
                    disabled={Boolean(switchingOrgId) || isSwitchingOrg}
                    onClick={() => handleSwitchOrg(item.organization.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors ${
                      isSelected
                        ? 'bg-[#F0F4FE] text-[#171B26] font-medium'
                        : 'hover:bg-[#F1F3F7] text-[#171B26]'
                    } ${isItemSwitching ? 'opacity-70 bg-[#F0F4FE]' : ''}`}
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <div className="w-6 h-6 rounded bg-[#F1F3F7] border border-[#E7EAF0] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.organization.logo_url ? (
                          <img src={item.organization.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-3 h-3 text-[#697386]" />
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-[13px] truncate">{item.organization.name}</span>
                        <span className="text-[11px] text-[#697386] capitalize">{item.role}</span>
                      </div>
                    </div>
                    {isItemSwitching ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#3659C9] animate-spin flex-shrink-0 ml-2" />
                    ) : isSelected ? (
                      <Check className="w-3.5 h-3.5 text-[#3659C9] flex-shrink-0 ml-2" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {/* Pending memberships */}
          {pendingMemberships.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-[#E7EAF0] px-3">
              <div className="flex items-center space-x-1.5 text-[11px] font-medium text-[#B45309] mb-1">
                <Clock className="w-3 h-3" />
                <span>Pending Approvals ({pendingMemberships.length})</span>
              </div>
              <div className="space-y-1">
                {pendingMemberships.map((item) => (
                  <div
                    key={item.organization.id}
                    className="p-1.5 bg-[#FFFBEB] rounded border border-[#FDE68A] text-xs text-[#B45309] flex items-center justify-between"
                  >
                    <span className="truncate">{item.organization.name}</span>
                    <span className="text-[10px] bg-white px-1 py-0.5 rounded border border-[#FDE68A]">Awaiting</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-1.5 pt-1.5 border-t border-[#E7EAF0] px-1.5 space-y-0.5">
            {isSuper && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/onboarding?step=create');
                }}
                className="w-full flex items-center space-x-2 p-1.5 rounded-md text-[#171B26] hover:bg-[#F1F3F7] text-[13px] transition-colors text-left"
              >
                <div className="w-5 h-5 rounded border border-[#E7EAF0] flex items-center justify-center text-[#697386]">
                  <Plus className="w-3 h-3" />
                </div>
                <span>Create New Organization</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/onboarding');
              }}
              className="w-full flex items-center space-x-2 p-1.5 rounded-md text-[#171B26] hover:bg-[#F1F3F7] text-[13px] transition-colors text-left"
            >
              <div className="w-5 h-5 rounded border border-[#E7EAF0] flex items-center justify-center text-[#697386]">
                <Layers className="w-3 h-3" />
              </div>
              <span>View All Organizations</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/');
              }}
              className="w-full flex items-center space-x-2 p-1.5 rounded-md text-[#3659C9] hover:bg-blue-50 text-[13px] transition-colors text-left font-medium"
            >
              <div className="w-5 h-5 rounded border border-blue-200 bg-blue-50 flex items-center justify-center text-[#3659C9]">
                <Sparkles className="w-3 h-3" />
              </div>
              <span>Niral Suite & Other Services</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

