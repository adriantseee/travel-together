'use client';

import { useState, useCallback, useRef } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import DnDCalendar from '../Calendar/DnDCalendar';
import MapsView from '../Maps/MapsView';
import FloatingChatButton from '../FloatingChatButton';

export default function AppLayout({ initialData, currentUser, onShareStatusChange, onShareWithUsers }) {
  const [activeScreen, setActiveScreen] = useState('itinerary');
  // Use useRef instead of useState for the calendar reference
  const calendarRef = useRef(null);
  const mapsRef = useRef(null);
  
  // Handle changing between screens - wrapped in useCallback
  const handleScreenChange = useCallback((screenId) => {
    setActiveScreen(screenId);
  }, []);
  
  // Handle adding events from maps to calendar - wrapped in useCallback
  const handleAddEventFromMap = useCallback((eventData) => {
    if (calendarRef.current && calendarRef.current.handleAddEventFromMap) {
      calendarRef.current.handleAddEventFromMap(eventData);
    } else {
      console.warn('Calendar reference or method not available');
    }
  }, []);

  // Handle adding events from assistant chat - wrapped in useCallback
  const handleAddEventFromChat = useCallback((eventData) => {
    // Convert chat event format to calendar event format
    const calendarEvent = {
      title: eventData.name,
      location: eventData.address,
      description: eventData.description,
      // Add any other fields your calendar component requires
      latitude: eventData.coordinates?.latitude,
      longitude: eventData.coordinates?.longitude,
      category: eventData.category
    };
    
    // Use the same method as maps to add to calendar
    handleAddEventFromMap(calendarEvent);
  }, [handleAddEventFromMap]);
  
  // New function to navigate to a location on the map
  const navigateToMapLocation = useCallback((place) => {
    // First, switch to the maps view
    setActiveScreen('maps');
    
    // If we have a place name but no coordinates, we need to search for it
    // using the Google Places API
    
    // Delay the navigation slightly to allow the maps component to render
    setTimeout(() => {
      if (mapsRef.current && mapsRef.current.navigateToPlace) {
        mapsRef.current.navigateToPlace(place);
      } else {
        console.warn('Maps reference or navigation method not available');
      }
    }, 300);
  }, []);
  
  // Render the active screen component - wrapped in useCallback
  const renderActiveScreen = useCallback(() => {
    switch (activeScreen) {
      case 'maps':
        console.log('RENDERING MAPS VIEW - Trip details being passed:', initialData);
        console.log('COORDINATES CHECK - Values being passed to MapsView:', {
          latitude: initialData?.latitude,
          longitude: initialData?.longitude,
          city: initialData?.city,
          country: initialData?.country
        });
        return <MapsView 
          ref={mapsRef}
          tripDetails={initialData} 
          onAddEvent={handleAddEventFromMap} 
        />;
      case 'itinerary':
      default:
        return (
          <DnDCalendar 
            ref={calendarRef}
            initialData={initialData} 
            currentUser={currentUser}
            onShareStatusChange={onShareStatusChange}
            onShareWithUsers={onShareWithUsers}
          />
        );
    }
  }, [activeScreen, initialData, currentUser, onShareStatusChange, onShareWithUsers, handleAddEventFromMap]);
  
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar activeScreen={activeScreen} onScreenChange={handleScreenChange} />
      <div className="flex-1 overflow-hidden">
        {renderActiveScreen()}
      </div>
      <FloatingChatButton 
        onAddEvent={handleAddEventFromChat} 
        tripDetails={initialData}
        navigateToMapLocation={navigateToMapLocation}
      />
    </div>
  );
} 