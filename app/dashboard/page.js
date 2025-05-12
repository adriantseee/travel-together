'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import ProfileForm from '../components/ProfileForm';
import TripsList from '../components/TripsList';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const router = useRouter();

  console.log('Dashboard page rendered');
  
  const fetchUserProfile = async (userId) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "row not found" error
        throw error;
      }

      setProfile(data || null);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    console.log('Dashboard useEffect triggered');
    
    const getUser = async () => {
      console.log('Fetching user data');
      try {
        const { data, error } = await supabase.auth.getUser();
        console.log('User data response:', data, error);
        
        if (error) {
          console.error('Error fetching user:', error);
          router.push('/login');
          return;
        }
        
        setUser(data.user);
        setLoading(false);
        
        if (!data.user) {
          console.log('No user found, redirecting to login');
          router.push('/login');
        } else {
          console.log('User found:', data.user.email);
          fetchUserProfile(data.user.id);
        }
      } catch (error) {
        console.error('Exception in getUser:', error);
        setLoading(false);
        router.push('/login');
      }
    };

    getUser();
  }, [router]);

  const handleSignOut = async () => {
    try {
      console.log('Signing out');
      await supabase.auth.signOut();
      console.log('Sign out successful');
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleProfileComplete = async () => {
    if (user) {
      fetchUserProfile(user.id);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <button
            onClick={handleSignOut}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </header>
      
      <main className="flex-grow mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {user && (
          <>
            {!profile && !profileLoading ? (
              <ProfileForm user={user} onProfileComplete={handleProfileComplete} />
            ) : profileLoading ? (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <p>Loading profile...</p>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">
                  Welcome, {profile.name || user.email}!
                </h2>
                
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-medium text-gray-900">Your Profile</h3>
                  <div className="mt-2 text-sm text-gray-700">
                    <p>Email: {user.email}</p>
                    {profile.country && <p>Country: {profile.country}</p>}
                    {profile.age && <p>Age: {profile.age}</p>}
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-6">
              <TripsList userId={user.id} />
            </div>
          </>
        )}
      </main>
    </div>
  );
} 