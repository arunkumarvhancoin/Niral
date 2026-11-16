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
          className="pointer-events-auto flex items-start space-x-2.5 p-3 rounded-lg border border-[#E7EAF0] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all animate-in slide-in-from-top-2 duration-150"
          role="alert"
        >
          <div className="flex-shrink-0 mt-0.5">
            {item.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#047857]" />}
            {item.type === 'error' && <AlertCircle className="w-4 h-4 text-[#B91C1C]" />}
            {item.type === 'info' && <Info className="w-4 h-4 text-[#3659C9]" />}
          </div>
          <div className="flex-1 text-[13px] text-[#171B26]">
            {item.title && <div className="font-semibold mb-0.5">{item.title}</div>}
            <div className="leading-snug text-[#171B26]">{item.message}</div>
          </div>
          <button
            onClick={() => removeToast(item.id)}
            className="flex-shrink-0 text-[#697386] hover:text-[#171B26] p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

