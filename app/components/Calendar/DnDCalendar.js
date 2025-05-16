'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import DraggableEvent from './DraggableEvent';
import ShareModal from './ShareModal';
import { getUserColor } from './utils';
import { supabase } from '../../lib/supabase';
// Add import for Leaflet (OpenStreetMap)
import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet components with no SSR
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const useMapEvents = dynamic(
  () => import('react-leaflet').then((mod) => mod.useMapEvents),
  { ssr: false }
);

// Define pin icon outside component to avoid recreation
let pinIcon = null;

const DnDCalendar = forwardRef(({ initialData, currentUser, onShareStatusChange, onShareWithUsers }, ref) => {
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [days, setDays] = useState([]);
  const [localEditDays, setLocalEditDays] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [eventHeights, setEventHeights] = useState({});
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [realTimeStatus, setRealTimeStatus] = useState('connecting');
  const [activeUsers, setActiveUsers] = useState([]);
  const [personalCopyTracker] = useState(new Set()); // Track events that already have personal copies to prevent duplicates
  const shareButtonRef = useRef(null);
  const [newEventData, setNewEventData] = useState({
    activity: '',
    time: '09:00',
    duration: 60,
    location: '',
    coordinates: null // To store latitude and longitude
  });
  const [tripDetails, setTripDetails] = useState({
    name: 'Summer Getaway',
    city: 'New York',
    description: 'Exploring the vibrant streets and iconic landmarks of the Big Apple.',
    numberOfDays: 3,
    participants: [
      { id: 1, name: 'John Doe', avatar: 'https://i.pravatar.cc/150?img=1' },
      { id: 2, name: 'Jane Smith', avatar: 'https://i.pravatar.cc/150?img=5' },
      { id: 3, name: 'Alex Johnson', avatar: 'https://i.pravatar.cc/150?img=9' },
    ],
    isPublic: false
  });
  const [user, setUser] = useState({
    id: currentUser?.id || 'default-user',
    name: currentUser?.name || 'Current User',
    avatar: currentUser?.avatar || `https://i.pravatar.cc/150?u=default`
  });
  const realtimeChannelRef = useRef(null);
  const [proposedEvents, setProposedEvents] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  // Add state for notification
  const [notification, setNotification] = useState(null);
  const mapRef = useRef(null);
  const [isPinMode, setIsPinMode] = useState(false);

  // Initialize trip details and user from props if available
  useEffect(() => {
    if (initialData) {
      setTripDetails(prevDetails => ({
        ...prevDetails,
        ...initialData
      }));
      
      console.log("Trip details participants:", initialData.participants);
    }
    
    if (currentUser) {
      setUser({
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar
      });
      
      console.log("Current user:", currentUser);
    }
  }, [initialData, currentUser]);

  // Initialize with empty days based on trip duration
  useEffect(() => {
    if (days.length === 0) {
      const initialDays = Array(tripDetails.numberOfDays).fill().map(() => []);
      setDays(initialDays);
    }
  }, [days.length, tripDetails.numberOfDays]);

  // Load existing events from database and set up real-time sync
  useEffect(() => {
    if (!tripDetails.id) return;

    const fetchEvents = async () => {
      try {
        // Fetch all events for this trip from the database
        const { data: eventsData, error } = await supabase
          .from('trip_events')
          .select('*')
          .eq('trip_id', tripDetails.id)
          .order('time');

        if (error) {
          console.error('Error fetching events:', error);
          return;
        }

        if (eventsData && eventsData.length > 0) {
          // Organize events by day
          const eventsByDay = Array(tripDetails.numberOfDays).fill().map(() => []);
          
          console.log("Raw events data from database:", eventsData);
          
          eventsData.forEach(event => {
            const dayIndex = event.day_index || 0;
            if (dayIndex >= 0 && dayIndex < tripDetails.numberOfDays) {
              const processedEvent = {
                id: event.id,
                activity: event.activity,
                time: event.time,
                endTime: event.end_time,
                createdBy: {
                  id: event.created_by_user_id,
                  name: event.created_by_name,
                  avatar: event.created_by_avatar
                },
                createdAt: event.created_at,
                status: event.status || 'approved' // Default to approved for backward compatibility
              };
              
              console.log("Processing event:", processedEvent.id, "created by:", processedEvent.createdBy);
              
              // Only add approved events to main view
              eventsByDay[dayIndex].push(processedEvent);
              
              // Calculate and set event heights
              setEventHeights(prev => ({
                ...prev,
                [event.id]: calculateEventHeight(event.time, event.end_time)
              }));
            }
          });
          
          setDays(eventsByDay);
        }
      } catch (err) {
        console.error('Failed to fetch events:', err);
      }

      // Also fetch user's personal edits if they exist
      try {
        const { data: userEdits, error } = await supabase
          .from('user_edits')
          .select('*')
          .eq('trip_id', tripDetails.id)
          .eq('is_active', true)
          .order('time');

        if (!error && userEdits && userEdits.length > 0) {
          // We found user-specific edits, prepare them for potential loading into edit mode
          console.log('Found user-specific edits:', userEdits.length);
          
          // We'll load these when the user enters edit mode
        }
      } catch (err) {
        // Table might not exist yet, which is fine
        console.log('No personal edits found (this is normal for first-time users)');
      }
    };

    fetchEvents();

    console.log('Setting up real-time channel for trip:', tripDetails.id);
    
    // Set up real-time subscription with a simpler approach
    const channel = supabase
      .channel(`trip-${tripDetails.id}`)
      // Presence handling
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const usersMap = new Map();
        Object.values(presenceState).flat().forEach(presence => {
          const existingUser = usersMap.get(presence.user_id);
          if (!existingUser || new Date(presence.online_at) > new Date(existingUser.online_at)) {
            usersMap.set(presence.user_id, presence);
          }
        });
        
        const uniqueUsers = Array.from(usersMap.values());
        setActiveUsers(uniqueUsers);
        setRealTimeStatus('connected');
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      
      // Main calendar events subscription - simplified
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'trip_events',
        filter: `trip_id=eq.${tripDetails.id}`
      }, (payload) => {
        console.log('Real-time event received for trip_events:', payload.eventType, payload.new?.id);
        
        // Simplest approach: Just reload all data on any change
        fetchEvents();
      })
      
      // User edits subscription - simplified
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_edits',
        filter: `trip_id=eq.${tripDetails.id}`
      }, (payload) => {
        console.log('Real-time event received for user_edits:', payload.eventType, payload.new?.id);
        
        // If in edit mode, reload all data to ensure everything is up to date
        if (isEditMode && currentDayIndex !== null) {
          toggleEditMode(currentDayIndex);
        }
      })
      
      .subscribe(async (status) => {
        console.log('Channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          // Track presence
          await channel.track({
            user_id: user.id,
            name: user.name,
            avatar: user.avatar,
            online_at: new Date().toISOString(),
            client_id: `${user.id}-${Date.now()}`
          });
          setRealTimeStatus('connected');
          
          // Refresh data when connected
          fetchEvents();
        } else {
          setRealTimeStatus('error');
        }
      });

    realtimeChannelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up real-time channel');
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.untrack().then(() => {
          supabase.removeChannel(realtimeChannelRef.current);
        });
      }
    };
  }, [tripDetails.id, tripDetails.numberOfDays]);

  // Show notification to user
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    
    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };
  
  // Update refreshAllData to be silent during regular refreshes
  const refreshAllData = (showNotification = false) => {
    if (!tripDetails.id) return;
    
    // Only show notification when specifically requested or for significant events
    if (showNotification) {
      showNotification('Refreshing calendar data...', 'info');
    }
    
    // Special handling for edit mode - completely reload personal edits
    if (isEditMode) {
      console.log('In edit mode, doing a complete refresh of personal edits...');
      
      // Load ONLY current user's edits for this trip
      supabase
        .from('user_edits')
        .select('*')
        .eq('trip_id', tripDetails.id)
        .eq('user_id', user.id) // Only current user's edits
        .eq('is_active', true)
        .order('time')
        .then(({ data: currentUserEdits, error: fetchError }) => {
          if (fetchError) {
            console.error('Error fetching user edits:', fetchError);
            return;
          }
          
          console.log(`Loaded ${currentUserEdits?.length || 0} user edits in refresh`);
          
          if (currentUserEdits && currentUserEdits.length > 0) {
            // Create a completely new copy of the days array
            const refreshedLocalDays = Array(tripDetails.numberOfDays).fill().map(() => []);
            
            // Get all shared events from days array to maintain them
            for (let i = 0; i < days.length; i++) {
              if (days[i]) {
                const sharedEvents = days[i].filter(e => !e.isPersonalEdit);
                if (sharedEvents.length > 0) {
                  refreshedLocalDays[i] = [...sharedEvents];
                }
              }
            }
            
            // Process current user's edits
            currentUserEdits.forEach(edit => {
              const dayIndex = edit.day_index || 0;
              if (dayIndex >= 0 && dayIndex < tripDetails.numberOfDays) {
                if (!refreshedLocalDays[dayIndex]) {
                  refreshedLocalDays[dayIndex] = [];
                }
                
                // Create processed event - same as in loadPersonalEdits
                const processedEdit = {
                  id: edit.id,
                  activity: edit.activity,
                  time: edit.time,
                  endTime: edit.end_time,
                  createdBy: {
                    id: edit.created_by_user_id,
                    name: edit.created_by_name,
                    avatar: edit.created_by_avatar
                  },
                  createdAt: edit.created_at,
                  isPersonalEdit: true,
                  createdByUserId: edit.user_id,
                  otherUserEdit: false, // Always false since we're only loading current user's edits
                  lastUpdated: Date.now()
                };
                
                // Add the edit to the refreshed days
                refreshedLocalDays[dayIndex].push(processedEdit);
                
                // Update event heights
                setEventHeights(prev => ({
                  ...prev,
                  [edit.id]: calculateEventHeight(edit.time, edit.end_time)
                }));
              }
            });
            
            // Sort each day's events by time
            for (let i = 0; i < refreshedLocalDays.length; i++) {
              if (refreshedLocalDays[i]) {
                refreshedLocalDays[i].sort((a, b) => {
                  const [aHour, aMinute] = a.time.split(':').map(Number);
                  const [bHour, bMinute] = b.time.split(':').map(Number);
                  return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
                });
              }
            }
            
            // Completely replace the localEditDays with fresh data
            setLocalEditDays(refreshedLocalDays);
            
            if (showNotification) {
              showNotification('Personal edits updated', 'success');
            }
          }
        });
    }
    
    // Always refresh the main calendar data
    // Set a flag to track if there are any changes
    let hasChanges = false;
    let updatedDays = null;
    
    // Fetch events for the main calendar
    supabase
      .from('trip_events')
      .select('*')
      .eq('trip_id', tripDetails.id)
      .order('time')
      .then(({ data: eventsData, error }) => {
        if (error) {
          console.error('Error fetching events:', error);
          if (showNotification) {
            showNotification('Error refreshing data', 'error');
          }
          return;
        }

        if (eventsData && eventsData.length > 0) {
          console.log('Fetched events data:', eventsData.length);
          
          // Process events
          const eventsByDay = Array(tripDetails.numberOfDays).fill().map(() => []);
          
          eventsData.forEach(event => {
            const dayIndex = event.day_index || 0;
            if (dayIndex >= 0 && dayIndex < tripDetails.numberOfDays) {
              const processedEvent = {
                id: event.id,
                activity: event.activity,
                time: event.time,
                endTime: event.end_time,
                createdBy: {
                  id: event.created_by_user_id,
                  name: event.created_by_name,
                  avatar: event.created_by_avatar
                },
                createdAt: event.created_at,
                status: event.status || 'approved'
              };
              
              eventsByDay[dayIndex].push(processedEvent);
              
              // Calculate and set event heights (important for proper display)
              const eventHeight = calculateEventHeight(event.time, event.end_time);
              setEventHeights(prev => ({
                ...prev,
                [event.id]: eventHeight
              }));
              
              // Check if this event has changed compared to current state
              if (days[dayIndex]) {
                const existingEvent = days[dayIndex].find(e => e.id === event.id);
                if (!existingEvent || 
                    existingEvent.time !== event.time || 
                    existingEvent.endTime !== event.end_time || 
                    existingEvent.activity !== event.activity) {
                  hasChanges = true;
                }
              } else {
                hasChanges = true;
              }
            }
          });
          
          // Sort each day's events by time
          for (let i = 0; i < eventsByDay.length; i++) {
            if (eventsByDay[i]) {
              eventsByDay[i].sort((a, b) => {
                const [aHour, aMinute] = a.time.split(':').map(Number);
                const [bHour, bMinute] = b.time.split(':').map(Number);
                return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
              });
            }
          }
          
          // Check if there are changes in the number of events
          for (let i = 0; i < Math.max(days.length, eventsByDay.length); i++) {
            const currentDayEvents = days[i] || [];
            const newDayEvents = eventsByDay[i] || [];
            if (currentDayEvents.length !== newDayEvents.length) {
              hasChanges = true;
              break;
            }
          }
          
          // Update main calendar if there are changes
          if (hasChanges) {
            console.log('Changes detected, updating days state');
            
            // Force a complete re-render by creating new references
            updatedDays = [...eventsByDay];
            setDays(updatedDays);
            
            // Only show notification for significant changes, not regular refreshes
            if (showNotification) {
              showNotification('Calendar updated with new changes', 'success');
            }
          } else {
            console.log('No changes detected in the events data');
          }
        }
      });
  };

  // Add a new function for directly updating DOM positions based on event times
  const forceUpdateEventPosition = (eventId, time) => {
    try {
      // Calculate position directly from time
      const [hours, minutes] = time.split(':').map(Number);
      const hourPosition = hours * 4;
      const minutePosition = (minutes / 60) * 4;
      const newPosition = hourPosition + minutePosition;
      
      // Find the DOM element
      const eventElement = document.getElementById(`event-${eventId}`);
      if (eventElement) {
        // Apply position directly to DOM
        eventElement.style.transition = 'top 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
        eventElement.style.top = `${newPosition}rem`;
        console.log(`Directly updated DOM position for event ${eventId} to ${newPosition}rem (${time})`);
        
        // Add visual indication that it was updated
        eventElement.classList.add('event-updated');
        setTimeout(() => {
          eventElement.classList.remove('event-updated');
        }, 800);
      }
    } catch (err) {
      console.error('Error updating event position directly:', err);
    }
  };

  // Modify the real-time database handler to use direct position updates
  const handleRealtimeEvent = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    console.log('Processing real-time event:', eventType, newRecord?.id || oldRecord?.id, 'for table:', payload.table);
    
    // Process based on which table the event is for
    if (payload.table === 'trip_events') {
      // Process shared events (main calendar)
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const record = newRecord;
        const eventStatus = record.status || 'approved';
        
        // Create processed event object
        const processedEvent = {
          id: record.id,
          activity: record.activity,
          time: record.time,
          endTime: record.end_time,
          createdBy: {
            id: record.created_by_user_id,
            name: record.created_by_name,
            avatar: record.created_by_avatar
          },
          createdAt: record.created_at,
          status: eventStatus
        };
        
        // Handle based on status
        if (eventStatus === 'proposed') {
          if (doUserIdsMatch(record.created_by_user_id, user.id)) {
            // Update proposed events if I'm the creator
            setProposedEvents(prev => {
              const exists = prev.some(e => e.id === processedEvent.id);
              if (exists) {
                return prev.map(e => e.id === processedEvent.id ? processedEvent : e);
              } else {
                return [...prev, processedEvent];
              }
            });
          } else {
            // Update pending approvals if created by others
            setPendingApprovals(prev => {
              const exists = prev.some(e => e.id === processedEvent.id);
              if (exists) {
                return prev.map(e => e.id === processedEvent.id ? processedEvent : e);
              } else {
                return [...prev, processedEvent];
              }
            });
          }
        } 
        else if (eventStatus === 'approved') {
          // Remove from proposed or pending if it was there
          setProposedEvents(prev => prev.filter(e => e.id !== processedEvent.id));
          setPendingApprovals(prev => prev.filter(e => e.id !== processedEvent.id));
          
          // Update the main days array for immediate display
          setDays(prevDays => {
            const dayIndex = record.day_index || 0;
            const newDays = [...prevDays];
            
            // Ensure the day exists
            if (!newDays[dayIndex]) {
              newDays[dayIndex] = [];
            }
            
            // Remove any existing version first
            newDays[dayIndex] = newDays[dayIndex].filter(e => e.id !== processedEvent.id);
            
            // Add the updated event
            newDays[dayIndex] = [...newDays[dayIndex], processedEvent];
            
            // Sort by time
            newDays[dayIndex].sort((a, b) => {
              const [aHour, aMinute] = a.time.split(':').map(Number);
              const [bHour, bMinute] = b.time.split(':').map(Number);
              return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
            });
            
            return newDays;
          });
          
          // Force update DOM position directly for immediate feedback
          forceUpdateEventPosition(record.id, record.time);
          
          console.log("Updated main days array with new/updated event");
        }
        else if (eventStatus === 'rejected') {
          // Remove from all lists
          setProposedEvents(prev => prev.filter(e => e.id !== processedEvent.id));
          setPendingApprovals(prev => prev.filter(e => e.id !== processedEvent.id));
        }
        
        // Update event height regardless of status
        setEventHeights(prev => ({
          ...prev,
          [record.id]: calculateEventHeight(record.time, record.end_time)
        }));
      }
      else if (eventType === 'DELETE') {
        const recordId = oldRecord.id;
        
        // Remove from all possible locations
        setDays(prev => {
          return prev.map(day => 
            day ? day.filter(e => e.id !== recordId) : day
          );
        });
        
        setProposedEvents(prev => prev.filter(e => e.id !== recordId));
        setPendingApprovals(prev => prev.filter(e => e.id !== recordId));
        
        // Remove event height
        setEventHeights(prev => {
          const newHeights = { ...prev };
          delete newHeights[recordId];
          return newHeights;
        });
        
        console.log("Removed deleted event from main days array");
      }
    }
    else if (payload.table === 'user_edits') {
      // Process user edits events
      const record = payload.new || payload.old;
      
      // Get user ID from the record
      const editUserId = record.user_id;
      const currentUserId = user.id;
      
      console.log(`Edit from user ${editUserId}, current user is ${currentUserId}`);
      
      // Check if this edit is from the current user
      const isCurrentUserEdit = doUserIdsMatch(editUserId, currentUserId);
      
      // Handle based on whether it's the current user's edit or another user's edit
      const dayIndex = record.day_index;
      
      if ((eventType === 'INSERT' || eventType === 'UPDATE') && isEditMode && localEditDays) {
        // Process the event data
        const processedEvent = {
          id: record.id,
          activity: record.activity,
          time: record.time,
          endTime: record.end_time,
          createdBy: {
            id: record.created_by_user_id,
            name: record.created_by_name,
            avatar: record.created_by_avatar
          },
          createdAt: record.created_at,
          isPersonalEdit: true,
          createdByUserId: record.user_id,
          otherUserEdit: !isCurrentUserEdit // Flag if it's from another user
        };
        
        // Update the localEditDays state
        setLocalEditDays(prev => {
          if (!prev) return prev;
          
          const newDays = [...prev];
          
          if (!newDays[dayIndex]) {
            newDays[dayIndex] = [];
          }
          
          // Remove any existing version of this event
          newDays[dayIndex] = newDays[dayIndex].filter(e => e.id !== record.id);
          
          // Add the new/updated event
          newDays[dayIndex].push(processedEvent);
          
          // Sort by time
          newDays[dayIndex].sort((a, b) => {
            const [aHour, aMinute] = a.time.split(':').map(Number);
            const [bHour, bMinute] = b.time.split(':').map(Number);
            return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
          });
          
          return newDays;
        });
        
        // Force update DOM position directly for immediate feedback
        forceUpdateEventPosition(record.id, record.time);
        
        // Update event height
        setEventHeights(prev => ({
          ...prev,
          [record.id]: calculateEventHeight(record.time, record.end_time)
        }));
        
        console.log(`Updated localEditDays with ${isCurrentUserEdit ? 'current' : 'other'} user's edit: ${record.id}`);
        
        // If it's the current user's edit, also update the unsaved changes flag
        if (isCurrentUserEdit) {
          setHasUnsavedChanges(true);
        }
      } 
      else if (eventType === 'DELETE' && isEditMode && localEditDays) {
        // Remove from local edits
        setLocalEditDays(prev => {
          if (!prev) return prev;
          
          return prev.map(day => 
            day ? day.filter(e => e.id !== record.id) : day
          );
        });
        
        // Remove event height
        setEventHeights(prev => {
          const newHeights = { ...prev };
          delete newHeights[record.id];
          return newHeights;
        });
        
        console.log(`Removed deleted edit ${record.id} from localEditDays`);
        
        // If it's the current user's edit, also update the unsaved changes flag
        if (isCurrentUserEdit) {
          setHasUnsavedChanges(true);
        }
      }
    }
  };

  // Handle share button click
  const handleShareButtonClick = (e) => {
    e.preventDefault();
    setIsShareModalOpen(true);
  };

  // Handle sharing to community
  const handleShareToCommunity = (isPublic) => {
    setTripDetails(prev => ({
      ...prev,
      isPublic
    }));
    
    // Notify parent component about the change
    if (onShareStatusChange) {
      onShareStatusChange({
        isPublic,
        tripId: tripDetails.id
      });
    }
  };

  // Handle sharing with specific users
  const handleShareWithUsers = async (emailList) => {
    if (onShareWithUsers) {
      return onShareWithUsers({
        tripId: tripDetails.id,
        emails: emailList
      });
    }
    return Promise.resolve();
  };

  // Calculate event height based on time difference
  const calculateEventHeight = (startTime, endTime) => {
    if (!startTime || !endTime) return 4; // Default height (1 hour)
    
    try {
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      
      // Handle case where end time is on the next day
      let durationMinutes = endTotalMinutes - startTotalMinutes;
      if (durationMinutes <= 0) {
        durationMinutes += 24 * 60;
      }
      
      // Convert minutes to rem (4rem = 1 hour)
      const height = (durationMinutes / 60) * 4;
      
      // Ensure minimum height of 2rem for very short events
      return Math.max(2, height);
    } catch (err) {
      console.error("Error calculating event height:", err, { startTime, endTime });
      return 4; // Default height (1 hour)
    }
  };

  // Fix the saveEditModeChanges function to save to user_edits table
  const saveEditModeChanges = async () => {
    if (!localEditDays || !isEditMode) return;
    
    const currentDayEvents = localEditDays[currentDayIndex] || [];
    
    try {
      // Check if user_edits table exists
      try {
        // Execute SQL to create the table if it doesn't exist
        await supabase.rpc('exec_sql', {
          sql_query: `
            CREATE TABLE IF NOT EXISTS user_edits (
              id TEXT PRIMARY KEY,
              trip_id UUID NOT NULL,
              user_id UUID NOT NULL,
              day_index INTEGER NOT NULL,
              activity TEXT NOT NULL,
              time TEXT NOT NULL,
              end_time TEXT NOT NULL,
              created_by_user_id UUID NOT NULL,
              created_by_name TEXT NOT NULL,
              created_by_avatar TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              is_active BOOLEAN DEFAULT TRUE,
              original_event_id TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_user_edits_trip_user ON user_edits(trip_id, user_id);
            CREATE INDEX IF NOT EXISTS idx_user_edits_day ON user_edits(day_index);
            CREATE INDEX IF NOT EXISTS idx_user_edits_original ON user_edits(original_event_id);
          `
        });
      } catch (err) {
        console.log('Error ensuring user_edits table exists (might already exist):', err);
      }
      
      // Get existing user edits for this trip/day
      const { data: existingEdits, error: fetchError } = await supabase
        .from('user_edits')
        .select('id')
        .eq('trip_id', tripDetails.id)
        .eq('user_id', user.id)
        .eq('day_index', currentDayIndex);
        
      if (fetchError) {
        console.error('Error fetching existing user edits:', fetchError);
        return;
      }
      
      const existingEditIds = existingEdits ? existingEdits.map(e => e.id) : [];
      
      // Upsert all current events in this day
      for (const event of currentDayEvents) {
        // Filter out other users' events that might be in the local day 
        if (event.otherUserEdit || (event.createdBy?.id !== user.id && event.createdByUserId !== user.id)) {
          console.log(`Skipping save for event ${event.id} as it belongs to another user`);
          continue;
        }

        // Prepare event data for saving
        const eventData = {
          id: event.id,
          trip_id: tripDetails.id,
          user_id: user.id,
          day_index: currentDayIndex,
          activity: event.activity,
          time: event.time,
          end_time: event.endTime,
          created_by_user_id: user.id,
          created_by_name: user.name,
          created_by_avatar: user.avatar,
          created_at: event.createdAt || new Date().toISOString(),
          is_active: true
          // No longer using original_event_id in the database
        };
        
        try {
          // Check if this event exists in user's edits
          if (existingEditIds.includes(event.id)) {
            // Update existing event
            const { error } = await supabase
              .from('user_edits')
              .update(eventData)
              .eq('id', event.id);
              
            if (error) {
              console.error('Error updating user edit:', error);
            } else {
              console.log('Updated user edit:', event.id);
            }
          } else {
            // Insert new event
            const { error } = await supabase
              .from('user_edits')
              .insert(eventData);
              
            if (error) {
              console.error('Error inserting user edit:', error);
            } else {
              console.log('Inserted user edit:', event.id);
            }
          }
        } catch (err) {
          console.error('Error saving user edit:', err);
        }
      }
      
      // Find events that were removed
      if (existingEdits) {
        const currentDayEventIds = currentDayEvents.map(e => e.id);
        const dayEventIdsToRemove = existingEdits
          .filter(e => !currentDayEventIds.includes(e.id))
          .map(e => e.id);
          
        // Delete removed events
        if (dayEventIdsToRemove.length > 0) {
          try {
            const { error } = await supabase
              .from('user_edits')
              .delete()
              .in('id', dayEventIdsToRemove);
              
            if (error) {
              console.error('Error deleting removed user edits:', error);
            } else {
              console.log('Deleted removed user edits:', dayEventIdsToRemove);
            }
          } catch (err) {
            console.error('Error deleting user edits:', err);
          }
        }
      }
      
      // Success - all changes saved
      setHasUnsavedChanges(false);
      
      // Show a visual confirmation
      alert('Changes saved to your personal calendar!');
      
      // Refresh data to show the latest state
      refreshAllData();
      
    } catch (err) {
      console.error('Error in save process:', err);
    }
  };

  // Add a function to refresh shared events from the database
  const refreshSharedEvents = async () => {
    console.log('Refreshing shared events from database...');
    try {
      const { data: sharedEvents, error } = await supabase
        .from('trip_events')
        .select('*')
        .eq('trip_id', tripDetails.id)
        .order('time');
        
      if (error) {
        console.error('Error fetching shared events:', error);
        return;
      }
      
      if (sharedEvents) {
        console.log(`Fetched ${sharedEvents.length} shared events from database`);
        
        // Process and update the days state
        const refreshedDays = Array(tripDetails.numberOfDays).fill().map(() => []);
        
        sharedEvents.forEach(event => {
          const dayIndex = event.day_index || 0;
          if (dayIndex >= 0 && dayIndex < tripDetails.numberOfDays) {
            const processedEvent = {
              id: event.id,
              activity: event.activity,
              time: event.time,
              endTime: event.end_time,
              createdBy: {
                id: event.created_by_user_id,
                name: event.created_by_name,
                avatar: event.created_by_avatar
              },
              createdAt: event.created_at,
              status: event.status || 'approved'
            };
            
            refreshedDays[dayIndex].push(processedEvent);
            
            // Update event heights
            setEventHeights(prev => ({
              ...prev,
              [event.id]: calculateEventHeight(event.time, event.end_time)
            }));
          }
        });
        
        // Sort each day's events
        for (let i = 0; i < refreshedDays.length; i++) {
          if (refreshedDays[i]) {
            refreshedDays[i].sort((a, b) => {
              const [aHour, aMinute] = a.time.split(':').map(Number);
              const [bHour, bMinute] = b.time.split(':').map(Number);
              return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
            });
          }
        }
        
        // Update state with fresh data
        setDays(refreshedDays);
      }
    } catch (err) {
      console.error('Error refreshing shared events:', err);
    }
  };
  
  // Add a clean exit function
  const exitEditMode = () => {
    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Discard changes?")) {
        // Discard changes, refresh shared events, and exit
        refreshAllData();
        setLocalEditDays(null);
        setHasUnsavedChanges(false);
        setIsEditMode(false);
      }
    } else {
      // No changes to save, just refresh and exit
      refreshAllData();
      setLocalEditDays(null);
      setIsEditMode(false);
    }
  };

  // Add a new function to copy the current global schedule to personal view
  const copyGlobalToPersonal = async () => {
    if (!isEditMode || !localEditDays) {
      showNotification('You need to be in edit mode to copy the global schedule', 'error');
      return;
    }
    
    if (!confirm('Copy all events from the global schedule to your personal view?')) {
      return;
    }
    
    showNotification('Copying global schedule to your personal view...', 'info');
    
    try {
      // Get current day's global events
      const globalEvents = days[currentDayIndex] || [];
      
      if (globalEvents.length === 0) {
        showNotification('No global events to copy on this day', 'info');
        return;
      }
      
      // Create a deep copy of localEditDays to avoid direct state mutation
      const updatedLocalDays = [...localEditDays];
      
      // Make sure the current day exists
      if (!updatedLocalDays[currentDayIndex]) {
        updatedLocalDays[currentDayIndex] = [];
      }
      
      // Create a set of existing personal copies to avoid duplicates
      // For this we'll check existing IDs that might reference the original event
      const existingPersonalCopies = new Set();
      
      updatedLocalDays[currentDayIndex].forEach(event => {
        if (event.originalEventId) {
          existingPersonalCopies.add(event.originalEventId);
        }
        
        // Also check ID pattern
        if (event.id.startsWith('personal-')) {
          const parts = event.id.split('-');
          if (parts.length >= 2) {
            existingPersonalCopies.add(parts[1]);
          }
        }
      });
      
      // Track newly created copies for database insertion
      const newPersonalCopies = [];
      
      // Create personal copies for each global event that doesn't already have one
      globalEvents.forEach(globalEvent => {
        // Skip if we already have a personal copy of this event
        if (existingPersonalCopies.has(globalEvent.id)) {
          console.log(`Skipping creation for ${globalEvent.id} - already has a personal copy`);
          return;
        }
        
        // Create a personal copy with a unique ID
        const personalCopyId = `personal-${globalEvent.id}-${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        const personalCopy = {
          id: personalCopyId,
          activity: globalEvent.activity,
          time: globalEvent.time,
          endTime: globalEvent.endTime,
          createdBy: {
            id: user.id,
            name: user.name,
            avatar: user.avatar
          },
          originalCreatedBy: {
            id: globalEvent.createdBy?.id,
            name: globalEvent.createdBy?.name,
            avatar: globalEvent.createdBy?.avatar
          },
          createdAt: new Date().toISOString(),
          isPersonalEdit: true,
          createdByUserId: user.id,
          otherUserEdit: false,
          lastUpdated: Date.now(),
          forceRender: Date.now() + Math.random(),
          originalEventId: globalEvent.id
        };
        
        // Add to our local state
        updatedLocalDays[currentDayIndex].push(personalCopy);
        
        // Update event heights
        setEventHeights(prev => ({
          ...prev,
          [personalCopyId]: calculateEventHeight(globalEvent.time, globalEvent.endTime)
        }));
        
        // Track for database insertion
        newPersonalCopies.push({
          personalCopy,
          dayIndex: currentDayIndex
        });
        
        // Add to tracking set
        personalCopyTracker.add(`${globalEvent.id}-${user.id}`);
      });
      
      // Sort the day's events by time
      updatedLocalDays[currentDayIndex].sort((a, b) => {
        const [aHour, aMinute] = a.time.split(':').map(Number);
        const [bHour, bMinute] = b.time.split(':').map(Number);
        return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
      });
      
      // Update state immediately
      setLocalEditDays(updatedLocalDays);
      
      // Save all new personal copies to database
      let saveCount = 0;
      for (const { personalCopy, dayIndex } of newPersonalCopies) {
        try {
          const { error } = await supabase
            .from('user_edits')
            .insert({
              id: personalCopy.id,
              trip_id: tripDetails.id,
              user_id: user.id,
              day_index: dayIndex,
              activity: personalCopy.activity,
              time: personalCopy.time,
              end_time: personalCopy.endTime,
              created_by_user_id: user.id,
              created_by_name: user.name,
              created_by_avatar: user.avatar,
              created_at: personalCopy.createdAt,
              is_active: true
            });
            
          if (error) {
            console.error('Error saving personal copy to database:', error);
          } else {
            saveCount++;
          }
        } catch (err) {
          console.error('Failed to save personal copy to database:', err);
        }
      }
      
      // Show success notification
      showNotification(`Successfully copied ${saveCount} events from global schedule`, 'success');
      
    } catch (err) {
      console.error('Error copying global schedule:', err);
      showNotification('Error copying global schedule', 'error');
    }
  };

  // Modified toggle edit mode to use the clean exit
  const toggleEditMode = (dayIndex) => {
    if (currentDayIndex === dayIndex && !isEditMode) {
      // Switching to edit mode on the already selected day
      setIsEditMode(true);
      
      // Create a local copy of the current day for editing
      // This will represent a user's personal view
      const localDays = [...days];
      
      // Load all users' personal edits for this trip and create instances of public events
      const loadPersonalEdits = async () => {
        try {
          // Show loading indicator
          const loadingMessage = document.createElement('div');
          loadingMessage.textContent = 'Loading personal edits...';
          loadingMessage.style.position = 'fixed';
          loadingMessage.style.top = '10px';
          loadingMessage.style.right = '10px';
          loadingMessage.style.padding = '8px 16px';
          loadingMessage.style.backgroundColor = '#4299e1';
          loadingMessage.style.color = 'white';
          loadingMessage.style.borderRadius = '4px';
          loadingMessage.style.zIndex = '9999';
          document.body.appendChild(loadingMessage);
          
          // IMPORTANT: Only fetch the current user's edits
          const { data: currentUserEdits, error: fetchError } = await supabase
            .from('user_edits')
            .select('*')
            .eq('trip_id', tripDetails.id)
            .eq('user_id', user.id) // Only fetch current user's edits
            .eq('is_active', true)
            .order('time');
          
          if (fetchError) {
            console.error('Error fetching user edits:', fetchError);
            document.body.removeChild(loadingMessage);
            return [];  // Return empty array instead of localDays to avoid including public events
          }
          
          console.log(`Loaded ${currentUserEdits?.length || 0} personal edits for current user`);
          
          // Create fresh empty days array - do NOT include public events
          const personalDays = Array(tripDetails.numberOfDays).fill().map(() => []);
          
          // Generate a base timestamp
          const baseTimestamp = Date.now();
          
          // Process only current user's edits
          if (currentUserEdits && currentUserEdits.length > 0) {
            currentUserEdits.forEach(edit => {
              const dayIndex = edit.day_index || 0;
              if (dayIndex >= 0 && dayIndex < tripDetails.numberOfDays) {
                if (!personalDays[dayIndex]) {
                  personalDays[dayIndex] = [];
                }
                
                // Create processed event
                const processedEdit = {
                  id: edit.id,
                  activity: edit.activity,
                  time: edit.time,
                  endTime: edit.end_time,
                  createdBy: {
                    id: edit.created_by_user_id,
                    name: edit.created_by_name,
                    avatar: edit.created_by_avatar
                  },
                  createdAt: edit.created_at,
                  isPersonalEdit: true,
                  createdByUserId: edit.user_id,
                  otherUserEdit: false, // Always false since we're only loading current user's edits
                  lastUpdated: Date.now(),
                  forceRender: baseTimestamp + Math.random(), // Add unique timestamp
                  // This is only used for in-memory tracking
                  originalEventId: edit.id.startsWith('personal-') ? edit.id.split('-')[1] : null
                };
                
                // Add the edit to the appropriate day
                personalDays[dayIndex].push(processedEdit);
                
                // Update event heights
                setEventHeights(prev => ({
                  ...prev,
                  [edit.id]: calculateEventHeight(edit.time, edit.end_time)
                }));
              }
            });
          }
          
          // Sort each day's events by time
          for (let i = 0; i < personalDays.length; i++) {
            if (personalDays[i]) {
              personalDays[i].sort((a, b) => {
                const [aHour, aMinute] = a.time.split(':').map(Number);
                const [bHour, bMinute] = b.time.split(':').map(Number);
                return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
              });
            }
          }
          
          // Remove loading message
          document.body.removeChild(loadingMessage);
          
          // Return clean personal days array without any public events or other users' edits
          return personalDays;
        } catch (err) {
          console.error('Error loading personal edits:', err);
          return Array(tripDetails.numberOfDays).fill().map(() => []); // Return empty array
        }
      };
      
      // Load personal edits and then set local days
      loadPersonalEdits().then(enrichedLocalDays => {
        setLocalEditDays(enrichedLocalDays);
        setHasUnsavedChanges(false);
      });
    } else if (currentDayIndex === dayIndex && isEditMode) {
      // Exiting edit mode on current day
      exitEditMode();
    } else {
      // Switching to a different day
      if (isEditMode && hasUnsavedChanges) {
        if (confirm("You have unsaved changes. Discard changes?")) {
          // Discard changes, set new day, refresh shared events, and exit edit mode
          setCurrentDayIndex(dayIndex);
          refreshAllData();
          setLocalEditDays(null);
          setHasUnsavedChanges(false);
          setIsEditMode(false);
        }
      } else if (isEditMode) {
        // No changes, just switch days and exit edit mode
        setCurrentDayIndex(dayIndex);
        refreshAllData();
        setLocalEditDays(null);
        setIsEditMode(false);
      } else {
        // Not in edit mode, just switch days
        setCurrentDayIndex(dayIndex);
      }
    }
  };

  // Add a new function for publishing personal changes to the main calendar
  const publishToMainCalendar = async () => {
    if (!localEditDays || !isEditMode) return;
    
    if (confirm('Publish your personal changes to the main shared calendar? This will be visible to everyone.')) {
      const currentDayEvents = localEditDays[currentDayIndex] || [];
      
      // Keep track of success
      let success = true;
      
      // Save each event to trip_events
      for (const event of currentDayEvents) {
        // Only publish the current user's personal edits
        if ((event.isPersonalEdit && doUserIdsMatch(event.createdBy?.id, user.id)) || 
            doUserIdsMatch(event.createdByUserId, user.id)) {
          try {
            // Prepare event data
            const eventData = {
              id: event.originalEventId || event.id, // Use original ID if this is a copy of a public event
              trip_id: tripDetails.id,
              day_index: currentDayIndex,
              activity: event.activity,
              time: event.time,
              end_time: event.endTime,
              created_by_user_id: user.id,
              created_by_name: user.name,
              created_by_avatar: user.avatar,
              created_at: event.createdAt || new Date().toISOString()
            };
            
            // Determine if this is a personal edit of an existing public event or a new event
            const isEditOfPublicEvent = !!event.originalEventId;
            
            if (isEditOfPublicEvent) {
              console.log(`Publishing updates to existing public event ${event.originalEventId}`);
              
              // Update the existing public event
              const { error } = await supabase
                .from('trip_events')
                .update({
                  activity: event.activity,
                  time: event.time,
                  end_time: event.endTime,
                  // Don't update created_by fields to preserve original creator
                  // Don't update created_at to preserve original timestamp
                })
                .eq('id', event.originalEventId);
                
              if (error) {
                console.error('Error updating existing public event:', error);
                success = false;
              } else {
                console.log(`Successfully updated public event ${event.originalEventId}`);
              }
            } else {
              // Check if this event already exists in trip_events
              const { data: existingEvent, error: checkError } = await supabase
                .from('trip_events')
                .select('id')
                .eq('id', event.id)
                .single();
              
              if (checkError && !checkError.message.includes('No rows found')) {
                console.error('Error checking for existing event:', checkError);
                success = false;
                continue;
              }
              
              if (existingEvent) {
                // Update existing event
                const { error } = await supabase
                  .from('trip_events')
                  .update(eventData)
                  .eq('id', event.id);
                  
                if (error) {
                  console.error('Error updating event in trip_events:', error);
                  success = false;
                } else {
                  console.log('Updated event in trip_events:', event.id);
                }
              } else {
                // Insert new event
                const { error } = await supabase
                  .from('trip_events')
                  .insert(eventData);
                  
                if (error) {
                  console.error('Error inserting event to trip_events:', error);
                  success = false;
                } else {
                  console.log('Inserted event to trip_events:', event.id);
                }
              }
            }
          } catch (err) {
            console.error('Error publishing event to main calendar:', err);
            success = false;
          }
        } else {
          console.log(`Skipping publishing event ${event.id} as it's not owned by current user`);
        }
      }
      
      if (success) {
        showNotification('Changes published to the main calendar! They are now visible to everyone.', 'success');
        
        // Refresh data to show the published changes to everyone
        refreshAllData(true);
      } else {
        showNotification('Some changes could not be published. Please try again.', 'error');
      }
    }
  };

  // Fix to ensure events in edit mode only show CURRENT user's events
  const handleAddEvent = async () => {
    if (!newEventData.activity.trim() || !newEventData.time) {
      return;
    }
    
    const newEventId = `event-${Math.random().toString(36).substring(2, 9)}`;
    
    // Calculate end time based on duration
    const [hours, minutes] = newEventData.time.split(':').map(Number);
    const durationHours = Math.floor(newEventData.duration / 60);
    const durationMinutes = newEventData.duration % 60;
    
    let endHours = hours + durationHours;
    let endMinutes = minutes + durationMinutes;
    
    if (endMinutes >= 60) {
      endHours += 1;
      endMinutes -= 60;
    }
    
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    
    // Create the new event object with location data
    const newEvent = {
      id: newEventId,
      activity: newEventData.activity,
      time: newEventData.time,
      endTime: endTime,
      location: newEventData.location || '',
      coordinates: newEventData.coordinates || null,
      createdBy: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      createdAt: new Date().toISOString()
    };
    
    // In edit mode, mark as personal edit
    if (isEditMode) {
      newEvent.isPersonalEdit = true;
    }

    // Add to UI immediately
    if (isEditMode) {
      // In edit mode, add to localEditDays
      setLocalEditDays(prev => {
        const newDays = [...prev];
        
        // If the day doesn't exist, create it
        if (!newDays[currentDayIndex]) {
          newDays[currentDayIndex] = [];
        }
        
        // Add the new event
        const updatedDay = [...newDays[currentDayIndex], newEvent];
        
        // Sort by time
        updatedDay.sort((a, b) => {
          const [aHour, aMinute] = a.time.split(':').map(Number);
          const [bHour, bMinute] = b.time.split(':').map(Number);
          return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
        });
        
        newDays[currentDayIndex] = updatedDay;
        
        setHasUnsavedChanges(true);
        return newDays;
      });
      
      // Save to user_edits table with location data
      try {
        const { error } = await supabase
          .from('user_edits')
          .insert({
            id: newEventId,
            trip_id: tripDetails.id,
            user_id: user.id,
            day_index: currentDayIndex,
            activity: newEventData.activity,
            time: newEventData.time,
            end_time: endTime,
            location: newEventData.location || '',
            coordinates: newEventData.coordinates ? JSON.stringify(newEventData.coordinates) : null,
            created_by_user_id: user.id,
            created_by_name: user.name,
            created_by_avatar: user.avatar,
            created_at: new Date().toISOString(),
            is_active: true
          });
          
        if (error) {
          console.error('Error saving event to user_edits:', error);
        } else {
          console.log('Successfully saved event to user_edits:', newEventId);
        }
      } catch (err) {
        console.error('Failed to save event to user_edits:', err);
      }
    } else {
      // In normal mode, add to days
      setDays(prev => {
        const newDays = [...prev];
        
        // If the day doesn't exist, create it
        if (!newDays[currentDayIndex]) {
          newDays[currentDayIndex] = [];
        }
        
        // Add the new event
        const updatedDay = [...newDays[currentDayIndex], newEvent];
        
        // Sort by time
        updatedDay.sort((a, b) => {
          const [aHour, aMinute] = a.time.split(':').map(Number);
          const [bHour, bMinute] = b.time.split(':').map(Number);
          return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
        });
        
        newDays[currentDayIndex] = updatedDay;
        
        return newDays;
      });
      
      // Save to trip_events table with location data
      try {
        const { error } = await supabase
          .from('trip_events')
          .insert({
            id: newEventId,
            trip_id: tripDetails.id,
            day_index: currentDayIndex,
            activity: newEventData.activity,
            time: newEventData.time,
            end_time: endTime,
            location: newEventData.location || '',
            coordinates: newEventData.coordinates ? JSON.stringify(newEventData.coordinates) : null,
            created_by_user_id: user.id,
            created_by_name: user.name,
            created_by_avatar: user.avatar,
            created_at: new Date().toISOString()
          });
          
        if (error) {
          console.error('Error saving event to trip_events:', error);
        } else {
          console.log('Successfully saved event to trip_events:', newEventId);
        }
      } catch (err) {
        console.error('Failed to save event to trip_events:', err);
      }
    }
    
    // Calculate and set event heights
    setEventHeights(prev => ({
      ...prev,
      [newEventId]: calculateEventHeight(newEventData.time, endTime)
    }));
    
    // Reset new event form
    setNewEventData({
      activity: '',
      time: '09:00',
      duration: 60,
      location: '',
      coordinates: null
    });
    
    // Close the modal
    setIsAddEventModalOpen(false);
  };

  // Helper function to check if two user IDs match, considering different formats
  const doUserIdsMatch = (id1, id2) => {
    if (!id1 || !id2) return false;
    
    // Try different comparison approaches
    return (
      id1 === id2 || 
      String(id1) === String(id2) ||
      id1.toString() === id2.toString() ||
      id1.includes(id2) ||
      id2.includes(id1)
    );
  };
  
  // Generate time markers for the calendar view (hourly lines)
  const generateTimeMarkers = () => {
    // Generate markers for each hour (0-23) plus an additional marker for the next day (hour 24)
    return Array.from({ length: 25 }).map((_, i) => {
      const hour = i;
      // For the last hour (24), display as 00:00
      const displayHour = hour === 24 ? '00' : String(hour).padStart(2, '0');
      
      return (
        <div key={i} className="absolute w-full" style={{ top: `${i * 4}rem` }}>
          <div className="flex items-center">
            <span className="w-10 text-sm font-medium text-gray-600 time-marker">
              {`${displayHour}:00`}
            </span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
        </div>
      );
    });
  };

  // Handle event time updates when events are dragged
  const handleTimeUpdate = async (eventId, newTime, newEndTime) => {
    // Ensure we have both values with defaults if needed
    newTime = newTime || '00:00';
    newEndTime = newEndTime || '01:00';
    
    console.log(`Updating event ${eventId} to time ${newTime}-${newEndTime}`);
    
    // Get the element to animate
    const eventElement = document.getElementById(`event-${eventId}`);
    
    // Update event in the appropriate state based on edit mode
    if (isEditMode && localEditDays) {
      // Find the event in localEditDays first
      let eventFound = false;
      let eventDayIndex = -1;
      let isOtherUsersEdit = false;
      
      // Clone the current state to make updates
      const updatedLocalEditDays = [...localEditDays];
      
      // Search through all days to find the event
      for (let i = 0; i < updatedLocalEditDays.length; i++) {
        if (!updatedLocalEditDays[i]) continue;
        
        const eventIndex = updatedLocalEditDays[i].findIndex(e => e.id === eventId);
        if (eventIndex >= 0) {
          // Check if this is another user's edit - if so, we shouldn't modify it
          if (updatedLocalEditDays[i][eventIndex].otherUserEdit) {
            console.error("Cannot modify another user's personal edit");
            showNotification("You cannot modify another user's personal edit", "error");
            isOtherUsersEdit = true;
            return; // Exit early
          }
          
          // Update the event with new time values and force new render timestamp
          updatedLocalEditDays[i] = [...updatedLocalEditDays[i]];
          updatedLocalEditDays[i][eventIndex] = {
            ...updatedLocalEditDays[i][eventIndex],
            time: newTime,
            endTime: newEndTime,
            forceRender: Date.now() + Math.random() // Force re-render with unique timestamp
          };
          
          // Sort the events by time
          updatedLocalEditDays[i].sort((a, b) => {
            const [aHour, aMinute] = a.time.split(':').map(Number);
            const [bHour, bMinute] = b.time.split(':').map(Number);
            return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
          });
          
          eventFound = true;
          eventDayIndex = i;
          break;
        }
      }
      
      if (eventFound && !isOtherUsersEdit) {
        // Update height immediately to ensure smooth visual update
        setEventHeights(prev => ({
          ...prev,
          [eventId]: calculateEventHeight(newTime, newEndTime)
        }));
        
        // Update state with the modified version
        setLocalEditDays(updatedLocalEditDays);
        
        // Auto-save changes - no need to mark unsaved changes anymore
        // setHasUnsavedChanges(true);
        
        // Update in the user_edits table if this is the user's own event
        const event = updatedLocalEditDays[eventDayIndex].find(e => e.id === eventId);
        
        if (event) {
          try {
            const { error } = await supabase
              .from('user_edits')
              .update({
                time: newTime,
                end_time: newEndTime
              })
              .eq('id', eventId)
              .eq('user_id', user.id);
              
            if (error) {
              console.error('Error updating event time in user_edits:', error);
              showNotification('Could not update event time', 'error');
            } else {
              console.log('Updated event time in user_edits:', eventId);
              
              // Add animation class
              if (eventElement) {
                eventElement.classList.add('event-updated');
                setTimeout(() => {
                  eventElement.classList.remove('event-updated');
                }, 800);
              }
              
              // Add notification for successful update
              showNotification(`Event moved to ${newTime}`, 'success');
              
              // Do a complete data refresh using the EXACT same method as initial load
              // This is critical to solve the syncing issue!
              setTimeout(async () => {
                // Use the direct reload function instead of refreshAllData
                await forceReloadPersonalEdits();
              }, 200);
            }
          } catch (err) {
            console.error('Failed to update event time in user_edits:', err);
          }
        }
      } else if (!isOtherUsersEdit) {
        console.error('Event not found in localEditDays:', eventId);
      }
    } else {
      // Update in normal mode (days)
      let eventFound = false;
      let eventDayIndex = -1;
      
      // Clone current state to make updates
      const updatedDays = [...days];
      
      // Find the day containing this event
      for (let i = 0; i < updatedDays.length; i++) {
        if (!updatedDays[i]) continue;
        
        const eventIndex = updatedDays[i].findIndex(e => e.id === eventId);
        if (eventIndex >= 0) {
          // Update the event
          updatedDays[i] = [...updatedDays[i]];
          updatedDays[i][eventIndex] = {
            ...updatedDays[i][eventIndex],
            time: newTime,
            endTime: newEndTime
          };
          
          // Sort the events by time
          updatedDays[i].sort((a, b) => {
            const [aHour, aMinute] = a.time.split(':').map(Number);
            const [bHour, bMinute] = b.time.split(':').map(Number);
            return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
          });
          
          eventFound = true;
          eventDayIndex = i;
          break;
        }
      }
      
      if (eventFound) {
        // Update height immediately for smooth visual update
        setEventHeights(prev => ({
          ...prev,
          [eventId]: calculateEventHeight(newTime, newEndTime)
        }));
        
        // Update state with modified version
        setDays(updatedDays);
        
        // Update in the trip_events table
        try {
          const { error } = await supabase
            .from('trip_events')
            .update({
              time: newTime,
              end_time: newEndTime
            })
            .eq('id', eventId);
            
          if (error) {
            console.error('Error updating event time in trip_events:', error);
            showNotification('Could not update event time', 'error');
          } else {
            console.log('Updated event time in trip_events:', eventId);
            
            // Add animation class
            if (eventElement) {
              eventElement.classList.add('event-updated');
              setTimeout(() => {
                eventElement.classList.remove('event-updated');
              }, 800);
            }
            
            // Add notification for successful update
            showNotification(`Event moved to ${newTime}`, 'success');
            
            // Force refresh UI with new time values
            setTimeout(() => {
              refreshAllData();
            }, 100);
          }
        } catch (err) {
          console.error('Failed to update event time in trip_events:', err);
        }
      } else {
        console.error('Event not found in days:', eventId);
      }
    }
  };

  // Add polling for updates to ensure real-time functionality works
  useEffect(() => {
    if (!tripDetails.id) return;
    
    console.log('Setting up polling for trip:', tripDetails.id);
    
    // Use the direct reload for consistent behavior
    const pollInterval = setInterval(async () => {
      console.log('Polling for updates...');
      
      // Handle based on edit mode state
      if (isEditMode) {
        // In edit mode, use the same loading approach as when entering edit mode
        await forceReloadPersonalEdits();
        
        // Also directly sync DOM positions for all events
        setTimeout(() => {
          // Find all events in the DOM and force update their positions
          const allEventElements = document.querySelectorAll('[id^="event-"]');
          allEventElements.forEach(element => {
            const eventId = element.id.replace('event-', '');
            const time = element.getAttribute('data-time');
            if (time) {
              forceUpdateEventPosition(eventId, time);
            }
          });
        }, 100);
      } else {
        // In normal mode, use standard refresh
        refreshAllData();
      }
    }, 5000); // Reduce frequency: Poll every 5 seconds instead of 1 second
    
    // Set initial poll time
    localStorage.setItem(`lastPoll_${tripDetails.id}`, Date.now().toString());
    localStorage.setItem(`lastEditPoll_${tripDetails.id}`, Date.now().toString());
    
    // Clean up interval on unmount
    return () => {
      clearInterval(pollInterval);
    };
  }, [tripDetails.id, isEditMode]);

  // Add a new function to more directly reload the data in the exact same way as initial load
  const forceReloadPersonalEdits = async () => {
    try {
      // Fetch only current user's edits
      const { data: currentUserEdits, error: fetchError } = await supabase
        .from('user_edits')
        .select('*')
        .eq('trip_id', tripDetails.id)
        .eq('user_id', user.id) // Only fetch current user's edits
        .eq('is_active', true)
        .order('time');
      
      if (fetchError) {
        console.error('Error fetching user edits for reload:', fetchError);
        return;
      }
      
      console.log(`Force reloaded ${currentUserEdits?.length || 0} personal edits for current user`);
      
      // Start with completely fresh data
      const freshLocalDays = Array(tripDetails.numberOfDays).fill().map(() => []);
      
      // Track events to update directly in the DOM
      const eventsToUpdate = [];
      
      // Helper function definition (keeping this the same)
      // ... existing savePersonalCopyToDatabase function ...
      
      // Process only current user's edits
      if (currentUserEdits && currentUserEdits.length > 0) {
        currentUserEdits.forEach(edit => {
          const dayIndex = edit.day_index || 0;
          if (dayIndex >= 0 && dayIndex < tripDetails.numberOfDays) {
            if (!freshLocalDays[dayIndex]) {
              freshLocalDays[dayIndex] = [];
            }
            
            // Create processed event - EXACTLY as in loadPersonalEdits
            const processedEdit = {
              id: edit.id,
              activity: edit.activity,
              time: edit.time,
              endTime: edit.end_time,
              createdBy: {
                id: edit.created_by_user_id,
                name: edit.created_by_name,
                avatar: edit.created_by_avatar
              },
              createdAt: edit.created_at,
              isPersonalEdit: true,
              createdByUserId: edit.user_id,
              otherUserEdit: false, // Always false since we're only loading current user's edits
              forceRender: Date.now() + Math.random(), // Ensure each gets a unique timestamp
              // Only for in-memory tracking
              originalEventId: edit.id.startsWith('personal-') ? edit.id.split('-')[1] : null
            };
            
            // Add the edit to the appropriate day
            freshLocalDays[dayIndex].push(processedEdit);
            
            // Update event heights
            setEventHeights(prev => ({
              ...prev,
              [edit.id]: calculateEventHeight(edit.time, edit.end_time)
            }));
            
            // Track for direct DOM update
            eventsToUpdate.push({
              id: edit.id,
              time: edit.time
            });
          }
        });
      }
      
      // The rest of the function remains the same for creating personal copies...
      // ... existing code ...
      
      // Set the completely fresh state with only current user's edits
      setLocalEditDays(freshLocalDays);
      
      // After React has processed the state update, force direct DOM updates
      setTimeout(() => {
        eventsToUpdate.forEach(event => {
          forceUpdateEventPosition(event.id, event.time);
          
          // Also update the data-time attribute directly
          const element = document.getElementById(`event-${event.id}`);
          if (element) {
            element.setAttribute('data-time', event.time);
          }
        });
      }, 50);
      
      return true;
    } catch (err) {
      console.error('Error in force reload personal edits:', err);
    }
    
    return false;
  };

  // Add a cleanup function to remove duplicate personal copies
  const cleanupDuplicates = async () => {
    if (!isEditMode || !localEditDays || !tripDetails.id) {
      showNotification('Please enter edit mode to clean up duplicates', 'error');
      return;
    }
    
    showNotification('Cleaning up duplicate personal copies...', 'info');
    
    try {
      // Fetch all user edits from database
      const { data: allEdits, error } = await supabase
        .from('user_edits')
        .select('*')
        .eq('trip_id', tripDetails.id)
        .eq('user_id', user.id);
        
      if (error) {
        console.error('Error fetching user edits for cleanup:', error);
        showNotification('Error fetching user edits', 'error');
        return;
      }
      
      if (!allEdits || allEdits.length === 0) {
        showNotification('No user edits found to clean up', 'info');
        return;
      }
      
      console.log(`Found ${allEdits.length} total user edits to check for duplicates`);
      
      // Group by derived original event ID (from ID pattern)
      const eventGroups = {};
      
      // Process each edit to extract original event ID from ID pattern
      allEdits.forEach(edit => {
        // Only process personal copies
        if (edit.id.startsWith('personal-')) {
          const parts = edit.id.split('-');
          if (parts.length >= 2) {
            const originalId = parts[1];
            
            if (!eventGroups[originalId]) {
              eventGroups[originalId] = [];
            }
            
            eventGroups[originalId].push(edit);
          }
        }
      });
      
      // Find groups with duplicates (more than one edit per original event)
      let duplicateCount = 0;
      const idsToDelete = [];
      
      Object.keys(eventGroups).forEach(originalId => {
        const group = eventGroups[originalId];
        
        if (group.length > 1) {
          // Sort by created_at and keep only the newest one
          group.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          
          // Keep the first (newest) and mark the rest for deletion
          const toDelete = group.slice(1).map(edit => edit.id);
          idsToDelete.push(...toDelete);
          duplicateCount += toDelete.length;
        }
      });
      
      if (idsToDelete.length === 0) {
        showNotification('No duplicates found', 'info');
        return;
      }
      
      console.log(`Found ${duplicateCount} duplicates to remove`);
      
      // Delete duplicates in batches of 100 to avoid hitting API limits
      const batchSize = 100;
      let deletedCount = 0;
      
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        
        const { error: deleteError } = await supabase
          .from('user_edits')
          .delete()
          .in('id', batch);
          
        if (deleteError) {
          console.error('Error deleting duplicates:', deleteError);
        } else {
          deletedCount += batch.length;
          console.log(`Deleted ${batch.length} duplicates (${deletedCount}/${duplicateCount})`);
        }
      }
      
      showNotification(`Successfully removed ${deletedCount} duplicate personal copies`, 'success');
      
      // Force reload to update the UI with the cleaned up data
      await forceReloadPersonalEdits();
      
    } catch (err) {
      console.error('Error in duplicate cleanup:', err);
      showNotification('Error cleaning up duplicates', 'error');
    }
  };

  // Expose methods to parent components through ref
  useImperativeHandle(ref, () => ({
    handleAddEventFromMap: (eventData) => {
      console.log('Received event from map:', eventData);
      
      // Set the day index based on the event data
      if (typeof eventData.day_index === 'number') {
        setCurrentDayIndex(eventData.day_index);
      }
      
      // Prepare event data in the format expected by the calendar
      const newEvent = {
        activity: eventData.activity || 'New Event',
        time: eventData.time || '12:00',
        duration: eventData.duration || 60,
        location: eventData.location || '',
        coordinates: eventData.coordinates || null
      };
      
      // Set the event data and open the add event modal
      setNewEventData(newEvent);
      setIsAddEventModalOpen(true);
    }
  }));

  // Map marker component
  const LocationMarker = () => {
    const map = useMapEvents({
      // Now we're only using this for map initialization
      load: () => {
        // Just to keep the map reference up to date
        if (map) {
          mapRef.current = map;
        }
      }
    });
    
    // Only show the actual marker when coordinates are selected
    return newEventData.coordinates ? (
      <Marker 
        position={[newEventData.coordinates.lat, newEventData.coordinates.lng]}
      />
    ) : null;
  };

  // Place pin at center of current map view
  const placePinAtCenter = () => {
    if (!mapRef.current) return;
    
    // Get the center coordinates of the current map view
    const center = mapRef.current.getCenter();
    const lat = center.lat;
    const lng = center.lng;
    
    // Visual feedback
    const notification = document.createElement('div');
    notification.className = 'map-notification';
    notification.textContent = 'Placing pin at center of map...';
    notification.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(59, 130, 246, 0.9);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
    `;
    mapRef.current.getContainer().appendChild(notification);
    
    // Update state with coordinates
    setNewEventData(prev => ({
      ...prev,
      coordinates: { lat, lng }
    }));
    
    // Get address from coordinates using reverse geocoding
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en&addressdetails=1`)
      .then(response => response.json())
      .then(data => {
        if (data.display_name) {
          setNewEventData(prev => ({
            ...prev,
            location: data.display_name
          }));
          
          // Update notification with success message
          notification.textContent = 'Address found!';
          notification.style.backgroundColor = 'rgba(16, 185, 129, 0.9)'; // Green for success
        }
      })
      .catch(err => {
        console.error('Error fetching location name:', err);
        // Update notification with error message
        notification.textContent = 'Could not fetch address. Try again.';
        notification.style.backgroundColor = 'rgba(239, 68, 68, 0.9)'; // Red for error
      })
      .finally(() => {
        // Remove notification after delay
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 3000);
      });
  };

  // Toggle pin drop mode
  const togglePinMode = () => {
    setIsPinMode(!isPinMode);
  };

  // Add search functionality for locations
  const handleLocationSearch = (e) => {
    e.preventDefault();
    const searchTerm = newEventData.location;
    
    if (!searchTerm) return;
    
    // Add explicit language parameter to ensure English results
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&accept-language=en&addressdetails=1`)
      .then(response => response.json())
      .then(data => {
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          setNewEventData(prev => ({
            ...prev,
            coordinates: {
              lat: parseFloat(lat),
              lng: parseFloat(lon)
            },
            location: data[0].display_name
          }));
          
          // Center map on the found location
          if (mapRef.current) {
            mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 13);
          }
        }
      })
      .catch(err => console.error('Error searching location:', err));
  };

  return (
    <div className="h-screen w-full bg-white flex flex-col overflow-hidden">
      <style jsx global>{`
        @keyframes updatePulse {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        
        .event-updated {
          animation: updatePulse 0.8s ease-out;
        }
        
        /* Improved colors for better readability */
        input, select, textarea {
          color: #1f2937 !important; /* text-gray-800 */
          font-weight: 500 !important;
        }
        
        .calendar-container .draggable-event h4 {
          color: #111827 !important; /* text-gray-900 */
          font-weight: 600 !important;
        }
        
        /* Make time markers more visible */
        .calendar-container .time-marker {
          color: #4b5563 !important; /* text-gray-600 */
          font-weight: 500 !important;
        }
        
        /* Improve event background colors */
        .calendar-container .draggable-event.personal-edit {
          background-color: #ffedd5 !important; /* bg-orange-100 */
          border-color: #fb923c !important; /* border-orange-400 */
        }
        
        .calendar-container .draggable-event:not(.personal-edit) {
          background-color: #f3f4f6 !important; /* bg-gray-100 */
          border-color: #6b7280 !important; /* border-gray-500 */
        }
      `}</style>
      
      {/* Notification */}
      {notification && (
        <div 
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-md shadow-lg transition-all duration-300 ${
            notification.type === 'error' ? 'bg-red-500 text-white' :
            notification.type === 'success' ? 'bg-green-500 text-white' :
            'bg-blue-500 text-white'
          }`}
          style={{ opacity: notification ? 1 : 0 }}
        >
          {notification.message}
        </div>
      )}
      
      {/* Header with trip details */}
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto py-4 px-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{tripDetails.name}</h1>
              <p className="text-blue-100 mt-1">{tripDetails.city}</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex -space-x-2">
                {/* Show active users first */}
                {activeUsers.length > 0 && activeUsers.map(active => (
                  <div 
                    key={`active-${active.user_id}`} 
                    className="relative" 
                    title={`${active.name} (Online)`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full border-2 border-green-400 flex items-center justify-center text-sm font-medium ${getUserColor(active.user_id)}`}
                    >
                      {(active.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white"></span>
                  </div>
                ))}
                
                {/* Then show other participants */}
                {tripDetails.participants && tripDetails.participants
                  .filter(p => !activeUsers.some(a => a.user_id === p.id))
                  .map(participant => (
                    <div key={participant.id} className="relative" title={participant.name}>
                      <div
                        className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-sm font-medium ${getUserColor(participant.id || participant.name)}`}
                      >
                        {(participant.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    </div>
                  ))
                }
              </div>
              <button 
                ref={shareButtonRef}
                onClick={handleShareButtonClick}
                className="ml-2 bg-blue-500 hover:bg-blue-400 rounded-full w-8 h-8 flex items-center justify-center text-white relative"
              >
                <span>+</span>
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm text-blue-100 max-w-3xl">{tripDetails.description}</p>
          
          <div className="mt-2 flex items-center gap-2">
            {isEditMode && (
              <span className="bg-orange-500 text-xs text-white px-2 py-1 rounded-full inline-flex items-center animate-pulse">
                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Personal Edit Mode
              </span>
            )}
            
            {tripDetails.isPublic && (
              <span className="bg-blue-500 text-xs text-white px-2 py-1 rounded-full inline-flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Public Itinerary
              </span>
            )}
            
            <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center ${
              realTimeStatus === 'connected' 
                ? 'bg-green-500 text-white' 
                : realTimeStatus === 'connecting' 
                ? 'bg-yellow-500 text-white'
                : 'bg-red-500 text-white'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                realTimeStatus === 'connected' 
                  ? 'bg-green-300 animate-pulse' 
                  : realTimeStatus === 'connecting' 
                  ? 'bg-yellow-300 animate-pulse'
                  : 'bg-red-300'
              } mr-1`}></span>
              {realTimeStatus === 'connected' 
                ? 'Live' 
                : realTimeStatus === 'connecting'
                ? 'Connecting...'
                : 'Offline'
              }
            </span>
            
            {/* Add notification badge for pending approvals */}
            {pendingApprovals.length > 0 && (
              <span className="bg-red-500 text-xs text-white px-2 py-1 rounded-full inline-flex items-center animate-pulse">
                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {pendingApprovals.length} Pending Approval
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Side navigation */}
        <div className="w-20 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          {Array.from({ length: tripDetails.numberOfDays }, (_, i) => i + 1).map(day => (
            <button
              key={day}
              onClick={() => toggleEditMode(day - 1)}
              className={`w-full py-4 px-0 text-center border-l-4 ${
                currentDayIndex === day - 1 && !isEditMode
                ? 'bg-blue-50 text-blue-600 font-medium border-blue-600' 
                : currentDayIndex === day - 1 && isEditMode
                ? 'bg-orange-50 text-orange-600 font-medium border-orange-600'
                : 'text-gray-700 hover:bg-gray-100 border-transparent'
              }`}
            >
              <div className="text-lg font-medium">{day}</div>
              <div className="text-xs uppercase">Day</div>
              {currentDayIndex === day - 1 && isEditMode && (
                <div className="text-xs mt-1 text-orange-600">Edit Mode</div>
              )}
            </button>
          ))}
        </div>

        {/* Calendar container */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
          {/* Day header */}
          <div className={`bg-white border-b border-gray-200 py-3 px-6 shadow-sm ${isEditMode ? 'bg-orange-50' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => toggleEditMode(Math.max(0, currentDayIndex - 1))}
                  disabled={currentDayIndex === 0}
                  className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex flex-col">
                  <h2 className={`text-xl font-semibold ${isEditMode ? 'text-orange-600' : 'text-gray-800'}`}>
                    Day {currentDayIndex + 1}
                    {isEditMode && <span className="ml-2 text-sm font-normal text-orange-600">(Personal Edit Mode)</span>}
                  </h2>
                  {isEditMode && (
                    <p className="text-xs text-orange-500 mt-1">
                      Your changes are auto-saved. Only you can see these changes until you publish them.
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => toggleEditMode(Math.min(days.length - 1, currentDayIndex + 1))}
                  disabled={currentDayIndex === days.length - 1}
                  className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center space-x-2">
                {isEditMode && (
                  <>
                    <button 
                      onClick={exitEditMode}
                      className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors text-sm mr-2"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Exit Edit Mode
                    </button>
                    <button 
                      onClick={copyGlobalToPersonal}
                      className="flex items-center px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors text-sm mr-2"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Global Schedule
                    </button>
                  </>
                )}
                
                {/* Remove the Add Event button - now this will be done from the map */}
              </div>
            </div>
            
            {/* Add instructions banner for how to add events */}
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-md p-3 flex items-center text-blue-800">
              <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-medium">New:</span> To add events to your itinerary, go to the <span className="font-semibold">Maps</span> tab and search for locations. You can search for specific places, restaurants, hotels, and attractions.
              </div>
            </div>
          </div>

          {/* Pending approvals section */}
          {pendingApprovals.length > 0 && !isEditMode && (
            <div className="bg-yellow-50 p-4 border-b border-yellow-200">
              <h3 className="text-yellow-800 font-medium mb-2">Pending Approvals</h3>
              <div className="space-y-2">
                {pendingApprovals.map(event => (
                  <div key={event.id} className="flex items-center justify-between bg-white p-3 rounded-md border border-yellow-200 shadow-sm">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full overflow-hidden mr-3">
                        <img src={event.createdBy.avatar} alt={event.createdBy.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-medium">{event.activity}</p>
                        <p className="text-sm text-gray-600">
                          Day {event.dayIndex + 1} at {event.time} • Proposed by {event.createdBy.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => rejectProposedEvent(event.id)}
                        className="bg-white text-red-600 border border-red-300 hover:bg-red-50 px-3 py-1 rounded-md text-sm"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => approveProposedEvent(event.id)}
                        className="bg-green-600 text-white hover:bg-green-700 px-3 py-1 rounded-md text-sm"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Your proposals section */}
          {proposedEvents.length > 0 && !isEditMode && (
            <div className="bg-blue-50 p-4 border-b border-blue-200">
              <h3 className="text-blue-800 font-medium mb-2">Your Proposed Changes</h3>
              <div className="space-y-2">
                {proposedEvents.map(event => (
                  <div key={event.id} className="flex items-center justify-between bg-white p-3 rounded-md border border-blue-200 shadow-sm">
                    <div>
                      <p className="font-medium">{event.activity}</p>
                      <p className="text-sm text-gray-600">
                        Day {event.dayIndex + 1} at {event.time} • Waiting for approval
                      </p>
                    </div>
                    <div className="text-xs text-blue-600 px-2 py-1 bg-blue-100 rounded-full">
                      Pending
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Calendar grid */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="bg-white h-full">
              <div className="relative calendar-container h-full" style={{ minHeight: '100rem' }}>
                {/* Background for time blocks */}
                <div className="absolute inset-0">
                  <div className="relative h-full">
                    {Array.from({ length: 25 }).map((_, i) => {
                      return (
                        <div 
                          key={`bg-${i}`} 
                          className="absolute left-0 right-0 bg-white" 
                          style={{ 
                            top: `${i * 4}rem`, 
                            height: '4rem',
                            borderBottom: '1px solid #f3f4f6'
                          }}
                        ></div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Time markers */}
                <div className="absolute inset-0 pl-4">
                  <div className="relative h-full">
                    {generateTimeMarkers()}
                  </div>
                </div>
                
                {/* Events */}
                <div className="absolute inset-0 z-10" style={{ top: '0.6rem' }}>
                  <div className="relative h-full">
                    {isEditMode ? (
                      // Edit mode - SINGLE VIEW of current user's personal edits
                      // Replace the multi-column view with a single column for the current user
                      <div className="w-full h-full">
                        {/* Get only the current user's personal edits */}
                        {(() => {
                          console.log('Rendering personal edits for current user in single view');
                          
                          // Get all personal edits for the current user
                          const personalEvents = (localEditDays || [])[currentDayIndex] || [];
                          console.log('Personal events found:', personalEvents.length);
                          
                          return personalEvents.map((event) => (
                            <DraggableEvent
                              key={`personal-${event.id}-${event.time}`}
                              event={event}
                              height={eventHeights[event.id] || 4}
                              onTimeUpdate={handleTimeUpdate}
                              isEditable={true}
                            />
                          ));
                        })()}
                        
                        {/* Instructions instead of Add button */}
                        <div className="absolute bottom-4 right-4 bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-md shadow-sm max-w-xs">
                          <p className="text-sm font-medium">Use the Map view to search for locations and add them to your calendar.</p>
                        </div>
                      </div>
                    ) : (
                      // Normal mode - single calendar view - use normal days array
                      days[currentDayIndex]?.map((event) => {
                        // Check if current user is the owner of the trip
                        const isOwner = tripDetails.participants?.some(
                          p => p.id === user.id && p.role === 'owner'
                        );
                        
                        // Allow editing if user created the event OR if user is the trip owner
                        const canEdit = event.createdBy?.id === user.id || isOwner;
                        
                        return (
                          <DraggableEvent
                            key={event.id}
                            event={event}
                            height={eventHeights[event.id] || 4}
                            onTimeUpdate={canEdit ? handleTimeUpdate : undefined}
                            isEditable={canEdit}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Share Modal */}
      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        trip={tripDetails}
        onShareToCommunity={handleShareToCommunity}
        onShareWithUsers={handleShareWithUsers}
      />
      
      {/* Add Event Modal */}
      {isAddEventModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[600px] max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Add New Event</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Name
                </label>
                <input
                  type="text"
                  value={newEventData.activity}
                  onChange={(e) => setNewEventData(prev => ({ ...prev, activity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-gray-900 font-medium"
                  placeholder="Enter event name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={newEventData.time}
                  onChange={(e) => setNewEventData(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-gray-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <select
                  value={newEventData.duration}
                  onChange={(e) => setNewEventData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-gray-900 font-medium"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newEventData.location}
                    onChange={(e) => setNewEventData(prev => ({ ...prev, location: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-gray-900 font-medium"
                    placeholder="Search for a location or click on the map"
                  />
                  <button
                    onClick={handleLocationSearch}
                    className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Search
                  </button>
                </div>
                <div className="h-48 w-full border border-gray-300 rounded-md overflow-hidden relative">
                  {typeof window !== 'undefined' && (
                    <MapContainer
                      center={[40.7128, -74.0060]} // Default to NYC
                      zoom={13}
                      style={{ height: '100%', width: '100%' }}
                      whenCreated={mapInstance => {
                        mapRef.current = mapInstance;
                      }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
                      />
                      <LocationMarker />
                      
                      {/* Center marker that shows where the pin will be placed */}
                      <div className="center-marker" style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '20px',
                        height: '20px',
                        marginTop: '-20px', /* Offset for the marker height */
                        marginLeft: '-10px',
                        zIndex: 1000,
                        pointerEvents: 'none'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{
                          filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))',
                          color: '#ef4444'
                        }}>
                          <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </MapContainer>
                  )}
                  
                  {/* Place pin button - positioned at the bottom */}
                  <button 
                    className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-[999] px-4 py-1.5 rounded-md shadow-md bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                    onClick={placePinAtCenter}
                  >
                    Place Pin at Center
                  </button>
                </div>
                
                <div className="mt-2 bg-blue-50 p-2 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-700 flex items-center mb-1">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    How to select a location:
                  </p>
                  <ol className="text-xs text-blue-700 list-decimal ml-5">
                    <li>Pan and zoom the map to your desired location</li>
                    <li>Position the red pin marker over your location</li>
                    <li>Click "Place Pin at Center" to select that location</li>
                    <li>Or search for a place using the search box above</li>
                  </ol>
                </div>
                {newEventData.coordinates && (
                  <div className="mt-2 bg-green-50 p-2 rounded-md border border-green-200">
                    <p className="text-sm text-green-700 font-medium flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Location Selected!
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {newEventData.location || 'Unknown location'}
                    </p>
                    <p className="text-xs text-green-600 opacity-75">
                      Coordinates: {newEventData.coordinates.lat.toFixed(6)}, {newEventData.coordinates.lng.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setIsAddEventModalOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEvent}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Add Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default DnDCalendar;