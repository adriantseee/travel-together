'use client';

import { useState, useCallback, useRef } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import DnDCalendar from '../Calendar/DnDCalendar';
import MapsView from '../Maps/MapsView';
import AssistantView from '../Assistant/AssistantView';

export default function AppLayout({ initialData, currentUser, onShareStatusChange, onShareWithUsers }) {
  const [activeScreen, setActiveScreen] = useState('itinerary');
  // Use useRef instead of useState for the calendar reference
  const calendarRef = useRef(null);
  
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
          tripDetails={initialData} 
          onAddEvent={handleAddEventFromMap} 
        />;
      case 'assistant':
        return <AssistantView tripDetails={initialData} />;
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
    </div>
  );
} 