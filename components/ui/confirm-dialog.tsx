'use client';

import React, { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
  loadingText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading,
  loadingText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = isLoading !== undefined ? isLoading : internalLoading;

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (loading) return;
    try {
      setInternalLoading(true);
      if (onConfirm) await onConfirm();
    } catch (err) {
      // Caller should handle errors, but ensure loading state doesn't get stuck
      console.error('ConfirmDialog action error:', err);
    } finally {
      setInternalLoading(false);
    }
  };

  const defaultLoadingText = variant === 'danger' ? 'Deleting...' : 'Processing...';
  const displayLoadingText = loadingText || defaultLoadingText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="bg-white rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E7EAF0] max-w-sm w-full p-4 space-y-3.5 animate-in zoom-in-95 duration-150"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start space-x-3">
          <div
            className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
              variant === 'danger' ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]' : 'bg-[#F0F4FE] text-[#3659C9] border border-[#C7D6F5]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[14px] font-semibold text-[#171B26] leading-snug">{title}</h4>
            <p className="text-[12px] text-[#697386] mt-1 leading-relaxed">{message}</p>
          </div>
          <button
            onClick={() => {
              if (!loading) onCancel();
            }}
            disabled={loading}
            className="text-[#697386] hover:text-[#171B26] p-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E7EAF0]">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 text-[12px] font-medium text-[#171B26] hover:bg-[#F1F3F7] rounded-md border border-[#E7EAF0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={loading}
            className={`inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 text-[12px] font-medium text-white rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              variant === 'danger'
                ? 'bg-[#B91C1C] hover:bg-[#991B1B]'
                : 'bg-[#3659C9] hover:bg-[#2B47A1]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{displayLoadingText}</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
