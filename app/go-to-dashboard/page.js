'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GoToDashboard() {
  const router = useRouter();

  useEffect(() => {
    // Trying router first
    try {
      router.push('/dashboard');
    } catch (e) {
      console.error('Navigation error:', e);
      // Fallback to direct navigation
      window.location.href = '/dashboard';
    }
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-xl mb-4">Redirecting to Dashboard...</h1>
      <p>
        If you're not redirected automatically, 
        <a href="/dashboard" className="ml-1 text-blue-600 hover:underline">
          click here
        </a>
      </p>
    </div>
  );
} 