'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { use } from 'react';
import { supabase } from '../../lib/supabase';
import AppLayout from '@/app/components/Layout/AppLayout';

export default function TripItinerary({ params }) {
  const tripId = params.id;
  const [trip, setTrip] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSharingToPublic, setIsSharingToPublic] = useState(false);
  const [isSharingWithUsers, setIsSharingWithUsers] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchTripData = async () => {
      try {
        // Get current user to check permissions
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          throw userError;
        }
        
        if (!user) {
          router.push('/login');
          return;
        }

        setUserId(user.id);
        
        // Get current user profile
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (!profileError) {
          setCurrentUser({
            id: user.id,
            name: userProfile.name || user.email,
            avatar: userProfile.avatar_url
          });
        } else {
          setCurrentUser({
            id: user.id,
            name: user.email,
            avatar: null
          });
        }
        
        // Use RPC functions directly from the client instead of API routes
        console.log('Checking trip access rights for user:', user.id, 'trip:', tripId);
        
        // Check if user is owner or participant
        const { data: isParticipant, error: participantError } = await supabase.rpc('is_trip_participant', { 
          check_trip_id: tripId,
          check_user_id: user.id
        });
        
        if (participantError) {
          console.error('Error checking participation:', participantError);
          setError('Failed to verify access to this trip');
          setLoading(false);
          return;
        }
        
        console.log('Participation check result:', isParticipant);
        
        if (!isParticipant) {
          console.log('User has no access to this trip');
          setError('You do not have access to this trip');
          setLoading(false);
          return;
        }
        
        // Get trip data using the RPC function
        const { data: tripData, error: tripError } = await supabase.rpc('get_trip_by_id', { 
          trip_id: tripId 
        });
        
        if (tripError) {
          console.error('Error fetching trip:', tripError);
          setError('Trip not found');
          setLoading(false);
          return;
        }
        
        // The RPC function returns an array, get the first item
        const trip = tripData && tripData.length > 0 ? tripData[0] : null;
        console.log('Trip data from RPC:', trip);
        
        // ADD DETAILED COORDINATE DEBUGGING
        console.log('COORDINATE INSPECTION - Trip data from DB:', {
          tripId: trip?.id,
          latitude: trip?.latitude,
          longitude: trip?.longitude,
          latitudeType: typeof trip?.latitude,
          longitudeType: typeof trip?.longitude,
          city: trip?.city,
          country: trip?.country,
          hasValidCoordinates: Boolean(trip?.latitude && trip?.longitude)
        });
        
        if (!trip) {
          setError('Trip not found');
          setLoading(false);
          return;
        }
        
        setTrip(trip);
        
        // Fetch participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('trip_participants')
          .select('*')
          .eq('trip_id', tripId);
          
        if (participantsError) {
          console.error('Error fetching participants:', participantsError);
        } else {
          // Then separately fetch user profiles for each participant
          if (participantsData && participantsData.length > 0) {
            const participantUserIds = participantsData.map(p => p.user_id);
            
            const { data: userProfiles, error: profilesError } = await supabase
              .from('user_profiles')
              .select('*')
              .in('id', participantUserIds);
              
            if (profilesError) {
              console.error('Error fetching user profiles:', profilesError);
            }
            
            // Combine participant data with profiles
            const enrichedParticipants = participantsData.map(participant => {
              const matchingProfile = userProfiles?.find(profile => profile.id === participant.user_id);
              return {
                ...participant,
                user_profiles: matchingProfile || null
              };
            });
            
            setParticipants(enrichedParticipants);
          } else {
            setParticipants([]);
          }
        }
      } catch (error) {
        console.error('Error fetching trip data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (tripId) {
      fetchTripData();
    }
  }, [tripId, router]);

  // Handle sharing status changes
  const handleShareStatusChange = async ({ isPublic, tripId }) => {
    try {
      setIsSharingToPublic(true);
      
      // Update the trip's community_post status in the database
      const { data, error } = await supabase
        .from('trips')
        .update({ community_post: isPublic })
        .eq('id', tripId);
        
      if (error) {
        console.error('Error updating trip sharing status:', error);
        alert('Failed to update sharing status. Please try again.');
      } else {
        console.log('Trip sharing status updated successfully');
        
        // Update the local trip state to reflect the change
        setTrip(prev => ({
          ...prev,
          community_post: isPublic
        }));
      }
    } catch (error) {
      console.error('Error in handleShareStatusChange:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setIsSharingToPublic(false);
    }
  };

  // Handle sharing with specific users
  const handleShareWithUsers = async ({ tripId, emails }) => {
    try {
      setIsSharingWithUsers(true);
      
      // Step 1: Check which emails correspond to existing users
      const emailPromises = emails.map(async (email) => {
        // Look for the user in user_profiles (we need to join with auth.users)
        // Since we can't query auth.users directly, we'll check if a profile exists with a matching email
        // This will be more reliable than the admin API which isn't accessible to regular users
        const { data: userProfiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select(`
            id,
            name,
            email:id(email)
          `)
          .limit(1);
        
        // Alternative approach - try to query the database directly to find the user by email
        // This won't directly expose the email but can tell us if the user exists
        const { data, error: countError } = await supabase
          .rpc('check_user_exists_by_email', { check_email: email });
            
        const userExists = data?.[0]?.user_exists;
        
        if (!userExists || countError) {
          // No user found with this email, we would send invitation email
          console.log(`No user found for email: ${email}`);
          return { email, exists: false };
        }
        
        // Now get user profile to have the userId
        const { data: userProfile, error: userProfileError } = await supabase
          .rpc('get_user_id_by_email', { check_email: email });
        
        if (userProfileError || !userProfile || !userProfile[0]) {
          console.error(`Error getting user id for email ${email}:`, userProfileError);
          return { email, exists: false };
        }
        
        const userId = userProfile[0].user_id;
        
        // Check if user is already a participant
        const { data: existingParticipant, error: participantError } = await supabase
          .from('trip_participants')
          .select('*')
          .eq('trip_id', tripId)
          .eq('user_id', userId)
          .maybeSingle();
          
        if (existingParticipant) {
          // User is already a participant
          return { email, exists: true, userId, alreadyParticipant: true };
        }
        
        // User exists but is not a participant yet
        return { email, exists: true, userId, alreadyParticipant: false };
      });
      
      const usersToProcess = await Promise.all(emailPromises);
      console.log('Users to process:', usersToProcess);
      
      // Step 2: Add existing users as participants
      const addParticipantPromises = usersToProcess
        .filter(user => user.exists && !user.alreadyParticipant)
        .map(async (user) => {
          // Add user as a contributor (using 'member' to match schema default)
          const { data: insertResult, error } = await supabase
            .from('trip_participants')
            .insert({
              trip_id: tripId,
              user_id: user.userId,
              role: 'member',
              joined_at: new Date().toISOString()
            });
            
            console.log(`Sharing trip ${tripId} with user ${user.userId}, result:`, insertResult, error);
            
          if (error) {
            console.error(`Failed to add user ${user.email}:`, error);
            return { ...user, added: false, error };
          }
          
          return { ...user, added: true };
        });
        
      const addedParticipants = await Promise.all(addParticipantPromises);
      
      // Step 3: Send emails to all users (if email edge function exists)
      // For existing site users - notification that they've been added to a trip
      // For non-users - invitation to join the site and view the trip
      const emailNotificationPromises = usersToProcess.map(async (user) => {
        try {
          if (user.exists && !user.alreadyParticipant) {
            // Send notification to existing user
            console.log('Email notification would be sent to existing user:', user.email);
            /* Commenting out until email function is implemented
            try {
              await supabase.functions.invoke('send-trip-invitation', {
                body: { 
                  email: user.email,
                  tripId,
                  tripName: trip.name,
                  invitedBy: currentUser.name,
                  isExistingUser: true
                }
              });
            } catch (e) {
              console.log('Edge function not available or error sending email:', e);
            }
            */
          } else if (!user.exists) {
            // Send invitation to new user
            console.log('Email invitation would be sent to new user:', user.email);
            /* Commenting out until email function is implemented
            try {
              await supabase.functions.invoke('send-trip-invitation', {
                body: { 
                  email: user.email,
                  tripId,
                  tripName: trip.name,
                  invitedBy: currentUser.name,
                  isExistingUser: false
                }
              });
            } catch (e) {
              console.log('Edge function not available or error sending email:', e);
            }
            */
          }
          return { ...user, emailSent: true };
        } catch (error) {
          console.error(`Failed to send email to ${user.email}:`, error);
          return { ...user, emailSent: false, error };
        }
      });
      
      await Promise.all(emailNotificationPromises);
      
      // Step 4: Fetch updated participants list
      const { data: updatedParticipants, error: fetchError } = await supabase
        .from('trip_participants')
        .select(`
          *,
          user_profiles:user_id (*)
        `)
        .eq('trip_id', tripId);
        
      if (!fetchError && updatedParticipants) {
        setParticipants(updatedParticipants);
      }
      
      // Success notification
      const newUsersCount = usersToProcess.filter(u => !u.exists).length;
      const existingUsersCount = usersToProcess.filter(u => u.exists && !u.alreadyParticipant).length;
      
      let message = 'Sharing complete. ';
      if (existingUsersCount > 0) {
        message += `${existingUsersCount} user${existingUsersCount > 1 ? 's' : ''} added as contributors. `;
      }
      if (newUsersCount > 0) {
        message += `Invitations sent to ${newUsersCount} new user${newUsersCount > 1 ? 's' : ''}.`;
      }
      
      alert(message);
      
      return true;
    } catch (error) {
      console.error('Error sharing with users:', error);
      alert('Failed to share with some users. Please try again.');
      return false;
    } finally {
      setIsSharingWithUsers(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="text-red-500 text-xl mb-4">{error}</div>
        <p className="mb-6 text-gray-600">You may not have access to this trip or it may not exist.</p>
        <Link href="/dashboard" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="bg-yellow-50 p-4 rounded-md">
          <p className="text-yellow-700">Trip not found or you don't have access to view it.</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline mt-2 inline-block">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Calculate trip duration in days
  const calculateTripDuration = () => {
    if (!trip.start_date || !trip.end_date) return 3; // Default to 3 days if dates not set
    
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Include both start and end date
  };

  // Format trip data for the calendar
  const tripDetails = {
    id: trip?.id,
    name: trip?.name,
    city: trip?.destination,
    description: trip?.description,
    numberOfDays: calculateTripDuration(),
    participants: participants?.map(p => ({
      id: p.user_id,
      name: p.user_profiles?.name || 'Anonymous',
      avatar: p.user_profiles?.avatar_url || `https://i.pravatar.cc/300?u=${p.user_id}`,
      role: p.role || 'participant'
    })),
    isPublic: trip?.community_post || false,
    latitude: trip?.latitude,
    longitude: trip?.longitude,
    country: trip?.country,
    destination: trip?.destination
  };

  // Debug the data being passed to AppLayout
  console.log('INITIALDATA CHECK - Data being passed to AppLayout:', {
    tripId: trip?.id,
    latitude: trip?.latitude,
    longitude: trip?.longitude,
    fullTripObject: trip
  });

  return (
    <AppLayout
      initialData={tripDetails}
      currentUser={currentUser}
      onShareStatusChange={handleShareStatusChange}
      onShareWithUsers={handleShareWithUsers}
    />
  );
} 