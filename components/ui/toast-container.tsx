'use client';

import React from 'react';
import { useToastStore, ToastItem } from '../../lib/stores/toast-store';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full">
      {toasts.map((item: ToastItem) => (
        <div
          key={item.id}
          className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-xs transition-all animate-in slide-in-from-top-2 duration-200 ${
            item.type === 'success'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : item.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-950'
              : 'bg-blue-50/95 border-blue-200 text-blue-950'
          }`}
          role="alert"
        >
          <div className="flex-shrink-0 mt-0.5">
            {item.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {item.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
            {item.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
          </div>
          <div className="flex-1 text-xs">
            {item.title && <div className="font-semibold mb-0.5">{item.title}</div>}
            <div className="leading-snug">{item.message}</div>
          </div>
          <button
            onClick={() => removeToast(item.id)}
            className="flex-shrink-0 text-slate-400 hover:text-slate-700 p-0.5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

