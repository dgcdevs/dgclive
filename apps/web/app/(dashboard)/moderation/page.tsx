'use client';

import { useUser } from '@/lib/use-user';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ModerationDashboard } from '@/app/components/moderation-dashboard';
import { Shield } from 'lucide-react';

export default function ModerationPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'ADMIN' && user.role !== 'MEDIA'))) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MEDIA')) {
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-white">Moderation Dashboard</h1>
          <p className="text-white/60">Manage chat violations and user moderation</p>
        </div>
      </div>

      {/* Moderation Component */}
      <ModerationDashboard />
    </div>
  );
}
