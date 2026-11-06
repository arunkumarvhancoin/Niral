'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Link as LinkIcon, Check, Loader2 } from 'lucide-react';
import { toast } from '../../lib/stores/toast-store';

interface LogoUploadProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  label?: string;
}

export function LogoUpload({ value, onChange, disabled = false, label = 'Organization Logo' }: LogoUploadProps) {
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process uploaded file (compress via canvas for optimal storage size)
  const processFile = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WebP, SVG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit');
      return;
    }

    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;

      // If SVG, keep raw data URL
      if (file.type === 'image/svg+xml') {
        onChange(result);
        setIsProcessing(false);
        return;
      }

      // Optimize raster images through canvas (max 400x400)
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL('image/png', 0.9);
          onChange(optimizedDataUrl);
        } else {
          onChange(result);
        }
        setIsProcessing(false);
      };
      img.onerror = () => {
        onChange(result);
        setIsProcessing(false);
      };
      img.src = result;
    };

    reader.onerror = () => {
      toast.error('Failed to read file');
      setIsProcessing(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
      setIsUrlMode(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setUrlInput('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">{label}</label>
        {!disabled && (
          <button
            type="button"
            onClick={() => setIsUrlMode(!isUrlMode)}
            className="text-[11px] font-medium text-primary-600 hover:text-primary-700 transition-colors flex items-center space-x-1"
          >
            {isUrlMode ? (
              <>
                <Upload className="w-3 h-3" />
                <span>Upload from file</span>
              </>
            ) : (
              <>
                <LinkIcon className="w-3 h-3" />
                <span>Or use image URL</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {/* URL Input Mode */}
      {isUrlMode ? (
        <div className="flex items-center space-x-2">
          <input
            type="url"
            disabled={disabled}
            placeholder="https://example.com/logo.png"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-1 focus:ring-primary-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleApplyUrl}
            disabled={disabled || !urlInput.trim()}
            className="px-3 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setIsUrlMode(false)}
            className="px-2.5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      ) : value ? (
        /* Preview Mode (when logo exists) */
        <div className="flex items-center space-x-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={value} alt="Logo preview" className="w-full h-full object-contain p-1" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800">Current Logo</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {value.startsWith('data:') ? 'Custom uploaded file' : value}
            </p>
            {!disabled && (
              <div className="flex items-center space-x-2 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Change image
                </button>
                <span className="text-slate-300">&bull;</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] font-medium text-rose-600 hover:text-rose-700 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Upload Dropzone Mode */
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-primary-500 bg-primary-50/50'
              : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50/50'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {isProcessing ? (
            <div className="py-2 flex flex-col items-center justify-center space-y-1.5">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              <p className="text-xs font-medium text-slate-600">Processing logo image...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                <Upload className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                <span className="text-primary-600 hover:underline">Click to upload logo</span> or drag and drop
              </p>
              <p className="text-[11px] text-slate-400">
                PNG, JPG, WebP or SVG (max. 5MB)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

