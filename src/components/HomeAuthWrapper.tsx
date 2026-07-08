'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { LandingPage } from '@/components/LandingPage';
import Dashboard from '@/components/Dashboard';

export default function HomeAuthWrapper() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  if (!user) {
    return <LandingPage />;
  }

  return <Dashboard user={user} />;
}
