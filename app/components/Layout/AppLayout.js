'use client';

import { useState } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import DnDCalendar from '../Calendar/DnDCalendar';
import MapsView from '../Maps/MapsView';
import AssistantView from '../Assistant/AssistantView';

export default function AppLayout({ initialData, currentUser, onShareStatusChange, onShareWithUsers }) {
  const [activeScreen, setActiveScreen] = useState('itinerary');
  
  // Handle changing between screens
  const handleScreenChange = (screenId) => {
    setActiveScreen(screenId);
  };
  
  // Render the active screen component
  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'maps':
        return <MapsView tripDetails={initialData} />;
      case 'assistant':
        return <AssistantView tripDetails={initialData} />;
      case 'itinerary':
      default:
        return (
          <DnDCalendar 
            initialData={initialData} 
            currentUser={currentUser}
            onShareStatusChange={onShareStatusChange}
            onShareWithUsers={onShareWithUsers}
          />
        );
    }
  };
  
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar activeScreen={activeScreen} onScreenChange={handleScreenChange} />
      <div className="flex-1 overflow-hidden">
        {renderActiveScreen()}
      </div>
    </div>
  );
} 