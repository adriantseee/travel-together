'use client';

import { useState, useEffect, useRef } from 'react';
import DraggableEvent from './DraggableEvent';
import ShareModal from './ShareModal';
import { getUserColor } from './utils';
import { supabase } from '../../lib/supabase';

export default function DnDCalendar({ initialData, currentUser, onShareStatusChange, onShareWithUsers }) {
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [days, setDays] = useState([]);
  const [eventHeights, setEventHeights] = useState({});
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [realTimeStatus, setRealTimeStatus] = useState('connecting');
  const [activeUsers, setActiveUsers] = useState([]);
  const shareButtonRef = useRef(null);
  const [newEventData, setNewEventData] = useState({
    activity: '',
    time: '09:00',
    duration: 60
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

  // Initialize trip details and user from props if available
  useEffect(() => {
    if (initialData) {
      setTripDetails(prevDetails => ({
        ...prevDetails,
        ...initialData
      }));
    }
    
    if (currentUser) {
      setUser({
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar
      });
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
                createdAt: event.created_at
              };
              
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
    };

    fetchEvents();

    console.log('Setting up real-time channel for trip:', tripDetails.id);
    
    // Set up real-time subscription with more logging
    const channel = supabase
      .channel(`trip-${tripDetails.id}`)
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users = Object.values(presenceState).flat();
        console.log('Presence sync:', users);
        setActiveUsers(users);
        setRealTimeStatus('connected');
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'trip_events',
        filter: `trip_id=eq.${tripDetails.id}`
      }, (payload) => {
        console.log('Real-time event received:', payload.eventType, payload.new?.id);
        handleRealtimeEvent(payload);
      })
      .subscribe(async (status) => {
        console.log('Channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          // Track presence of the current user
          await channel.track({
            user_id: user.id,
            name: user.name,
            avatar: user.avatar,
            online_at: new Date().toISOString()
          });
          setRealTimeStatus('connected');
        } else {
          setRealTimeStatus('error');
        }
      });

    realtimeChannelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up real-time channel');
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [tripDetails.id, tripDetails.numberOfDays]);

  // Handle real-time database events
  const handleRealtimeEvent = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    console.log('Processing real-time event:', eventType, newRecord?.id || oldRecord?.id);
    
    if (eventType === 'INSERT') {
      // Add new event
      const dayIndex = newRecord.day_index || 0;
      
      const newEvent = {
        id: newRecord.id,
        activity: newRecord.activity,
        time: newRecord.time,
        endTime: newRecord.end_time,
        createdBy: {
          id: newRecord.created_by_user_id,
          name: newRecord.created_by_name,
          avatar: newRecord.created_by_avatar
        },
        createdAt: newRecord.created_at
      };
      
      // Use functional state update that doesn't depend on previous state
      setDays(prevDays => {
        // Create a copy of all days
        const newDays = [...prevDays];
        
        // Ensure the day array exists
        if (!newDays[dayIndex]) {
          newDays[dayIndex] = [];
        }
        
        // Remove any existing event with the same ID (prevents duplicates)
        newDays[dayIndex] = newDays[dayIndex].filter(e => e.id !== newEvent.id);
        
        // Add the new event
        newDays[dayIndex] = [...newDays[dayIndex], newEvent];
        
        // Sort by time
        newDays[dayIndex].sort((a, b) => {
          const [aHour, aMinute] = a.time.split(':').map(Number);
          const [bHour, bMinute] = b.time.split(':').map(Number);
          return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
        });
        
        return newDays;
      });
      
      // Calculate event height (this is also idempotent)
      setEventHeights(prev => ({
        ...prev,
        [newRecord.id]: calculateEventHeight(newRecord.time, newRecord.end_time)
      }));
    }
    
    else if (eventType === 'UPDATE') {
      // Update existing event in a more idempotent way
      const oldDayIndex = oldRecord.day_index;
      const newDayIndex = newRecord.day_index;
      
      const updatedEvent = {
        id: newRecord.id,
        activity: newRecord.activity,
        time: newRecord.time,
        endTime: newRecord.end_time,
        createdBy: {
          id: newRecord.created_by_user_id,
          name: newRecord.created_by_name,
          avatar: newRecord.created_by_avatar
        },
        createdAt: newRecord.created_at
      };
      
      setDays(prev => {
        // Create a fresh copy of all days
        const newDays = [...prev];
        
        // Always remove the event from ALL days first to prevent any duplicates
        for (let i = 0; i < newDays.length; i++) {
          if (newDays[i]) {
            newDays[i] = newDays[i].filter(e => e.id !== updatedEvent.id);
          }
        }
        
        // Ensure target day exists
        if (!newDays[newDayIndex]) {
          newDays[newDayIndex] = [];
        }
        
        // Add the updated event
        newDays[newDayIndex] = [...newDays[newDayIndex], updatedEvent];
        
        // Sort the target day
        newDays[newDayIndex].sort((a, b) => {
          const [aHour, aMinute] = a.time.split(':').map(Number);
          const [bHour, bMinute] = b.time.split(':').map(Number);
          return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
        });
        
        return newDays;
      });
      
      // Update event height
      setEventHeights(prev => ({
        ...prev,
        [newRecord.id]: calculateEventHeight(newRecord.time, newRecord.end_time)
      }));
    }
    
    else if (eventType === 'DELETE') {
      // Remove deleted event
      const dayIndex = oldRecord.day_index;
      
      setDays(prev => {
        const newDays = [...prev];
        if (newDays[dayIndex]) {
          newDays[dayIndex] = newDays[dayIndex].filter(e => e.id !== oldRecord.id);
        }
        return newDays;
      });
      
      // Remove event height
      setEventHeights(prev => {
        const newHeights = { ...prev };
        delete newHeights[oldRecord.id];
        return newHeights;
      });
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
    
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    // Convert minutes to rem (4rem = 1 hour)
    return ((endTotalMinutes - startTotalMinutes) / 60) * 4;
  };

  // Modified handleAddEvent to save to database and broadcast to other users
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
    
    // Create the new event object
    const newEvent = {
      id: newEventId,
      activity: newEventData.activity,
      time: newEventData.time,
      endTime: endTime,
      createdBy: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      createdAt: new Date().toISOString()
    };

    // Add to UI immediately
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
    
    // Calculate and set event heights
    setEventHeights(prev => ({
      ...prev,
      [newEventId]: calculateEventHeight(newEventData.time, endTime)
    }));
    
    // Save to the database
    try {
      const { data, error } = await supabase
        .from('trip_events')
        .insert({
          id: newEventId,
          trip_id: tripDetails.id,
          day_index: currentDayIndex,
          activity: newEventData.activity,
          time: newEventData.time,
          end_time: endTime,
          created_by_user_id: user.id,
          created_by_name: user.name,
          created_by_avatar: user.avatar,
          created_at: new Date().toISOString()
        });
        
      if (error) {
        console.error('Error saving event to database:', error);
      } else {
        console.log('Event saved to database:', data);
      }
    } catch (err) {
      console.error('Failed to save event:', err);
    }
    
    // Reset new event form
    setNewEventData({
      activity: '',
      time: '09:00',
      duration: 60
    });
    
    // Close the modal
    setIsAddEventModalOpen(false);
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
            <span className={`w-10 text-sm text-gray-500`}>
              {`${displayHour}:00`}
            </span>
            <div className={`flex-grow border-t border-gray-200`}></div>
          </div>
        </div>
      );
    });
  };

  // Modified handleTimeUpdate to save changes to database
  const handleTimeUpdate = async (eventId, newTime) => {
    // Find the event to update
    let eventToUpdate = null;
    let eventDayIndex = currentDayIndex;
    
    for (let i = 0; i < days.length; i++) {
      const event = days[i]?.find(e => e.id === eventId);
      if (event) {
        eventToUpdate = event;
        eventDayIndex = i;
        break;
      }
    }
    
    if (!eventToUpdate) return;
    
    setDays(oldDays => {
      const newDays = [...oldDays];
      const currentDay = [...newDays[currentDayIndex]];

      const timeToDecimal = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours + minutes/60;
      };

      const decimalToTime = (decimal) => {
        const hours = Math.floor(decimal);
        const minutes = Math.round((decimal % 1) * 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      };
      
      const getEventDuration = (eventId) => eventHeights[eventId] / 4;

      const movingEvent = currentDay.find(e => e.id === eventId);
      const movingEventTime = timeToDecimal(newTime);
      const movingEventDuration = getEventDuration(eventId);
      const movingEventEnd = movingEventTime + movingEventDuration;

      const overlappingEvent = currentDay.find(event => {
        if (event.id === eventId) return false;
        
        const eventTime = timeToDecimal(event.time);
        const eventEnd = eventTime + getEventDuration(event.id);

        return (
          (movingEventTime >= eventTime && movingEventTime < eventEnd) ||
          (movingEventEnd > eventTime && movingEventEnd <= eventEnd) ||
          (movingEventTime <= eventTime && movingEventEnd >= eventEnd)
        );
      });

      if (!overlappingEvent) {
        // Just update the position of the dragged event
        const updatedDay = currentDay.map(event => {
          if (event.id === eventId) {
            // Calculate new end time
            const eventDuration = getEventDuration(eventId);
            const newEndDecimal = timeToDecimal(newTime) + eventDuration;
            const newEndTime = decimalToTime(newEndDecimal);
            
            return { 
              ...event, 
              time: newTime,
              endTime: newEndTime
            };
          }
          return event;
        });
        
        newDays[currentDayIndex] = updatedDay.sort((a, b) => 
          timeToDecimal(a.time) - timeToDecimal(b.time)
        );
        
        // Update in database
        const updatedEvent = updatedDay.find(e => e.id === eventId);
        if (updatedEvent) {
          console.log('Sending update to database for event:', eventId);
          
          supabase
            .from('trip_events')
            .update({
              time: updatedEvent.time,
              end_time: updatedEvent.endTime,
              updated_at: new Date().toISOString()
            })
            .eq('id', eventId)
            .then(({ data, error }) => {
              if (error) {
                console.error('Error updating event in database:', error);
              } else {
                console.log('Successfully updated event in database:', data);
              }
            });
        }
        
        return newDays;
      }

      // Handle case where we need to swap events
      let updatedEvents = currentDay.map(event => {
        if (event.id === eventId) {
          return { ...event, time: overlappingEvent.time };
        }
        if (event.id === overlappingEvent.id) {
          return { ...event, time: movingEvent.time };
        }
        return event;
      });

      // Sort and adjust events to prevent overlaps
      updatedEvents.sort((a, b) => timeToDecimal(a.time) - timeToDecimal(b.time));

      // Adjust end times based on new positions
      for (let i = 0; i < updatedEvents.length; i++) {
        const currentEvent = updatedEvents[i];
        const duration = getEventDuration(currentEvent.id);
        const endDecimal = timeToDecimal(currentEvent.time) + duration;
        
        currentEvent.endTime = decimalToTime(endDecimal);
        
        // If not the last event, ensure no overlap with next event
        if (i < updatedEvents.length - 1) {
          const nextEvent = updatedEvents[i + 1];
          const nextStartDecimal = timeToDecimal(nextEvent.time);
          
          if (endDecimal > nextStartDecimal) {
            nextEvent.time = currentEvent.endTime;
            
            // Recursively update subsequent events if needed
            for (let j = i + 1; j < updatedEvents.length - 1; j++) {
              const currEvent = updatedEvents[j];
              const nextEvent = updatedEvents[j + 1];
              const currEndDecimal = timeToDecimal(currEvent.time) + getEventDuration(currEvent.id);
              const currEndTime = decimalToTime(currEndDecimal);
              currEvent.endTime = currEndTime;
              
              const nextStartDecimal = timeToDecimal(nextEvent.time);
              
              if (currEndDecimal > nextStartDecimal) {
                nextEvent.time = currEndTime;
              }
            }
          }
        }
      }

      newDays[currentDayIndex] = updatedEvents;
      
      // Update all affected events in database
      updatedEvents.forEach(event => {
        supabase
          .from('trip_events')
          .update({
            time: event.time,
            end_time: event.endTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', event.id)
          .then(({ error }) => {
            if (error) {
              console.error(`Error updating event ${event.id} in database:`, error);
            }
          });
      });
      
      return newDays;
    });
  };

  // Toggle edit mode
  const toggleEditMode = (dayIndex) => {
    if (currentDayIndex === dayIndex && !isEditMode) {
      // Switching to edit mode on the already selected day
      setIsEditMode(true);
    } else if (currentDayIndex === dayIndex && isEditMode) {
      // Switching back to normal mode
      setIsEditMode(false);
    } else {
      // Switching to a different day - always starts in normal mode
      setCurrentDayIndex(dayIndex);
      setIsEditMode(false);
    }
  };

  return (
    <div className="h-screen w-full bg-white flex flex-col overflow-hidden">
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
                    {isEditMode && <span className="ml-2 text-sm font-normal text-orange-600">(Collaborative Edit Mode)</span>}
                  </h2>
                  {isEditMode && (
                    <p className="text-xs text-orange-500 mt-1">
                      Each contributor has their own column to add events without conflicts
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
                  <button 
                    onClick={() => setIsEditMode(false)}
                    className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors text-sm mr-2"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Exit Edit Mode
                  </button>
                )}
                <button 
                  onClick={() => setIsAddEventModalOpen(true)}
                  className="flex items-center px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors text-sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Event
                </button>
              </div>
            </div>
          </div>

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
                      // Edit mode with columns per contributor
                      <div className="flex w-full h-full">
                        {/* Get all unique contributors for the current day */}
                        {(() => {
                          // Get unique participants plus current user
                          const allParticipants = [
                            ...(tripDetails.participants || []),
                            // Add current user if not already in participants
                            ...(!tripDetails.participants?.some(p => p.id === user.id) ? [user] : [])
                          ];
                          
                          const columnWidth = 100 / Math.max(1, allParticipants.length);
                          
                          return allParticipants.map((participant, index) => (
                            <div 
                              key={participant.id} 
                              className="h-full border-r border-gray-200 relative" 
                              style={{ width: `${columnWidth}%` }}
                            >
                              {/* Contributor name header */}
                              <div className={`sticky top-0 py-2 px-3 text-center z-20 ${getUserColor(participant.id)}`}>
                                <div className="text-sm truncate font-medium">
                                  {participant.id === user.id ? 'My Events' : participant.name}
                                </div>
                              </div>
                              
                              {/* Events for this contributor */}
                              {days[currentDayIndex]?.filter(event => 
                                event.createdBy?.id === participant.id
                              ).map((event) => (
                                <DraggableEvent
                                  key={event.id}
                                  event={event}
                                  height={eventHeights[event.id] || 4}
                                  onTimeUpdate={
                                    event.createdBy?.id === user.id 
                                      ? handleTimeUpdate 
                                      : undefined
                                  }
                                  isEditable={event.createdBy?.id === user.id}
                                  columnWidth={columnWidth}
                                  columnIndex={index}
                                />
                              ))}
                              
                              {/* Add button for current user's column */}
                              {participant.id === user.id && (
                                <button
                                  onClick={() => {
                                    setNewEventData(prev => ({
                                      ...prev,
                                      contributorColumn: index
                                    }));
                                    setIsAddEventModalOpen(true);
                                  }}
                                  className="absolute bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-md"
                                >
                                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    ) : (
                      // Normal mode - single calendar view
                      days[currentDayIndex]?.map((event) => (
                        <DraggableEvent
                          key={event.id}
                          event={event}
                          height={eventHeights[event.id] || 4}
                          onTimeUpdate={handleTimeUpdate}
                        />
                      ))
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
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Add New Event</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Name
                </label>
                <input
                  type="text"
                  value={newEventData.activity}
                  onChange={(e) => setNewEventData(prev => ({ ...prev, activity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <select
                  value={newEventData.duration}
                  onChange={(e) => setNewEventData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
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

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setIsAddEventModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEvent}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
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
} 