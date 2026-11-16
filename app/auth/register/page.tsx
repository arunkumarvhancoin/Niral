'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';

function RegisterRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/onboarding?mode=signup');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-[#3659C9] rounded-full animate-spin" />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterRedirect />
    </Suspense>
  );
}
