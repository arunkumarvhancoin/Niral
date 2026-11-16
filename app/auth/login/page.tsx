'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirectParam = searchParams.get('redirect');
    const target = redirectParam
      ? `/onboarding?mode=signin&redirect=${encodeURIComponent(redirectParam)}`
      : '/onboarding?mode=signin';
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-[#3659C9] rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginRedirect />
    </Suspense>
  );
}
