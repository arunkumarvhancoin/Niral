'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ActivitiesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tasks');
  }, [router]);

  return null;
}
