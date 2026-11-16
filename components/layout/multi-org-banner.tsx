'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../providers/workspace-provider';
import { Shield, Filter, ChevronDown, X, Building2 } from 'lucide-react';

interface MultiOrgBannerProps {
  moduleName?: string;
  className?: string;
}

export function MultiOrgBanner({ moduleName = 'CRM records', className = '' }: MultiOrgBannerProps) {
  const {
    isSuperAdmin,
    currentOrg,
    memberships,
    selectedOrgIds,
    effectiveOrgIds,
    isAllOrgsSelected,
    isMultiOrgActive,
    toggleOrgSelection,
    selectAllOrgs,
    selectCurrentOrgOnly,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isSuperAdmin) return null;

  const approvedMemberships = memberships.filter((m) => m.status === 'approved');
  const isOnlyCurrent = selectedOrgIds.length === 1 && selectedOrgIds[0] === currentOrg?.id;

  return (
    <div className={`bg-white text-[#171B26] rounded-lg p-3 sm:px-4 sm:py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] border border-[#E7EAF0] ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-md bg-[#F0F4FE] border border-[#C7D6F5] flex items-center justify-center text-[#3659C9] flex-shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-[13px] font-semibold text-[#171B26] tracking-tight">
                Super Admin Multi-Organization View
              </h2>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#F0F4FE] text-[#3659C9] border border-[#C7D6F5]">
                Universal Oversight
              </span>
            </div>
            <p className="text-[12px] text-[#697386] mt-0.5">
              Viewing {moduleName} across {isAllOrgsSelected ? 'all' : effectiveOrgIds.length} of {approvedMemberships.length} organizations in this software.
            </p>
          </div>
        </div>

        {/* Selection Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={selectAllOrgs}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              isAllOrgsSelected
                ? 'bg-[#3659C9] text-white shadow-[0_1px_2px_rgba(54,89,201,0.2)]'
                : 'bg-white hover:bg-[#F1F3F7] text-[#171B26] border border-[#E7EAF0]'
            }`}
          >
            All Organizations ({approvedMemberships.length})
          </button>

          {currentOrg && (
            <button
              type="button"
              onClick={selectCurrentOrgOnly}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                isOnlyCurrent
                  ? 'bg-[#3659C9] text-white shadow-[0_1px_2px_rgba(54,89,201,0.2)]'
                  : 'bg-white hover:bg-[#F1F3F7] text-[#171B26] border border-[#E7EAF0]'
              }`}
            >
              Current Only ({currentOrg.name})
            </button>
          )}

          {/* Multi-Select Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white text-[#171B26] hover:bg-[#F1F3F7] border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors"
            >
              <Filter className="w-3 h-3 text-[#697386]" />
              <span>Choose ({effectiveOrgIds.length})</span>
              <ChevronDown className="w-3 h-3 text-[#697386]" />
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white text-[#171B26] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[#E7EAF0] z-50 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#E7EAF0]">
                  <span className="text-xs font-semibold text-[#171B26]">Select Organizations</span>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllOrgs}
                      className="text-[#3659C9] hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-[#E7EAF0]">|</span>
                    <button
                      type="button"
                      onClick={selectCurrentOrgOnly}
                      className="text-[#697386] hover:text-[#171B26]"
                    >
                      Current Only
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-0.5 py-1">
                  {approvedMemberships.map((m) => {
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
        </div>
      </div>

      {/* Selected Organization Badges */}
      <div className="mt-2.5 pt-2.5 border-t border-[#E7EAF0] flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-[#697386] mr-1 font-medium">Included:</span>
        {effectiveOrgIds.map((id) => {
          const org = approvedMemberships.find((m) => m.organization.id === id)?.organization;
          if (!org) return null;
          return (
            <span
              key={id}
              className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7F8FA] text-[#171B26] border border-[#E7EAF0]"
            >
              <span className="truncate max-w-[140px]">{org.name}</span>
              {effectiveOrgIds.length > 1 && (
                <button
                  type="button"
                  onClick={() => toggleOrgSelection(id)}
                  className="text-[#697386] hover:text-[#171B26]"
                  title={`Remove ${org.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

