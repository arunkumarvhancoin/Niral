'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '../components/providers/workspace-provider';

export default function RootPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useWorkspace();

  useEffect(() => {
    if (!isLoading) {
      if (currentUser) {
        router.replace('/dashboard');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [currentUser, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-6 h-6 border-2 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );
}
