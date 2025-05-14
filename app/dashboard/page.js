'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import ProfileForm from '../components/ProfileForm';
import TripsList from '../components/TripsList';
import Sidebar from '../components/Sidebar/Sidebar';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
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
  
  const handleScreenChange = (screenId) => {
    setActiveScreen(screenId);
  };

  // Handle click away from user menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    
    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Clean up event listener
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuRef]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Dashboard navigation items - currently only dashboard, can be expanded later
  const dashboardNavItems = [
    {
      id: 'dashboard',
      label: 'My Trips',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    }
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="h-screen w-20 bg-blue-700 text-white flex flex-col py-4 shadow-lg">
        <div className="flex justify-center mb-8">
          <Link href="/dashboard">
            <div className="bg-white rounded-full p-1 cursor-pointer">
              <svg className="w-8 h-8 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1">
          <ul className="flex flex-col items-center space-y-4">
            {dashboardNavItems.map(item => (
              <li key={item.id} className="w-full">
                <button
                  onClick={() => handleScreenChange(item.id)}
                  className={`w-full py-3 flex flex-col items-center transition-colors ${
                    activeScreen === item.id 
                      ? 'bg-blue-800 text-white' 
                      : 'text-blue-200 hover:bg-blue-600'
                  }`}
                >
                  <div className="flex justify-center">{item.icon}</div>
                  <span className="text-xs mt-1">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
            <div className="flex items-center space-x-4">
              {user && profile && (
                <div className="relative">
                  <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center focus:outline-none"
                  >
                    <div className="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center text-blue-600 font-medium mr-2">
                      {profile.name ? profile.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-gray-700 hidden md:inline-block">
                      {profile.name || user.email}
                    </span>
                    <svg className="w-4 h-4 ml-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showUserMenu && (
                    <div ref={userMenuRef} className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
                      <button 
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        
        <main className="p-6">
          {user && (
            <>
              {!profile && !profileLoading ? (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800">Complete Your Profile</h2>
                  <ProfileForm user={user} onProfileComplete={handleProfileComplete} />
                </div>
              ) : profileLoading ? (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800">
                    Welcome, {profile.name || user.email}!
                  </h2>
                  
                  <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                    <h3 className="font-medium text-blue-700 mb-2">Your Profile</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700">
                      <div>
                        <span className="text-gray-500">Email: </span>
                        <span>{user.email}</span>
                      </div>
                      {profile.country && (
                        <div>
                          <span className="text-gray-500">Country: </span>
                          <span>{profile.country}</span>
                        </div>
                      )}
                      {profile.age && (
                        <div>
                          <span className="text-gray-500">Age: </span>
                          <span>{profile.age}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                </div>
                <TripsList userId={user.id} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
} 