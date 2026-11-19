'use client';

import React from 'react';

export function Skeleton({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/80 ${className}`}
      {...props}
    />
  );
}

/**
 * Realistic Table Skeleton Loader with shimmering rows and custom column count.
 */
export function TableSkeleton({
  columns = 5,
  rows = 6,
  showAvatar = true,
}: {
  columns?: number;
  rows?: number;
  showAvatar?: boolean;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="animate-pulse border-b border-slate-100/90">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-4 px-4 whitespace-nowrap">
              {cIdx === 0 && showAvatar ? (
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-200/90 flex-shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 bg-slate-200/90 rounded w-28 sm:w-36" />
                    <div className="h-2.5 bg-slate-100 rounded w-20" />
                  </div>
                </div>
              ) : cIdx === 1 ? (
                <div className="space-y-1.5">
                  <div className="h-3 bg-slate-200/90 rounded w-24 sm:w-32" />
                  <div className="h-2.5 bg-slate-100 rounded w-16" />
                </div>
              ) : cIdx === columns - 1 ? (
                <div className="flex items-center justify-end space-x-2">
                  <div className="h-7 w-14 bg-slate-200/70 rounded-md" />
                </div>
              ) : cIdx === columns - 2 ? (
                <div className="h-5 w-20 bg-slate-200/80 rounded" />
              ) : (
                <div className="h-3.5 bg-slate-200/80 rounded w-20 sm:w-24" />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * KPI Stat Cards Skeleton Loader
 */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs animate-pulse flex items-center space-x-3.5"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-200/90 flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-2.5 bg-slate-200 rounded w-20" />
            <div className="h-6 bg-slate-200/90 rounded w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Kanban Board Skeleton Loader (for Deals & Pipelines)
 */
export function KanbanSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-start select-none animate-pulse">
      {Array.from({ length: columns }).map((_, cIdx) => (
        <div key={cIdx} className="bg-[#F7F8FA] rounded-xl border border-[#E7EAF0] p-3 space-y-3">
          {/* Column Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#E7EAF0]">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <div className="h-3.5 w-24 bg-slate-300 rounded" />
              <div className="h-4 w-6 bg-slate-200 rounded" />
            </div>
            <div className="h-3 w-12 bg-slate-200 rounded" />
          </div>

          {/* Card Skeletons */}
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, cardIdx) => (
              <div
                key={cardIdx}
                className="bg-white p-3.5 rounded-lg border border-[#E7EAF0] shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div className="h-4 bg-slate-200 rounded w-32" />
                  <div className="h-4 w-4 bg-slate-100 rounded" />
                </div>
                <div className="h-3 bg-slate-100 rounded w-20" />
                <div className="flex items-center justify-between pt-1">
                  <div className="h-5 w-16 bg-slate-200 rounded" />
                  <div className="h-3 w-16 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Task Row Skeletons
 */
export function TaskSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 animate-pulse">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="p-3.5 bg-white rounded-lg border border-[#E7EAF0] flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-5 h-5 rounded-full bg-slate-200 flex-shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-4 bg-slate-200 rounded w-48" />
              <div className="h-2.5 bg-slate-100 rounded w-32" />
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="h-5 w-16 bg-slate-200 rounded" />
            <div className="h-4 w-14 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
