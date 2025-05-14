'use client';

import { useCallback, memo } from 'react';
import Link from 'next/link';

const Sidebar = ({ activeScreen, onScreenChange }) => {
  const navItems = [
    {
      id: 'itinerary',
      label: 'Itinerary',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'maps',
      label: 'Maps',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      )
    },
    {
      id: 'assistant',
      label: 'Assistant',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    }
  ];
  
  // Memoize the handle click function
  const handleNavClick = useCallback((itemId) => {
    onScreenChange(itemId);
  }, [onScreenChange]);
  
  return (
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
          {navItems.map(item => (
            <li key={item.id} className="w-full">
              <button
                onClick={() => handleNavClick(item.id)}
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
      
      <div className="mt-auto flex justify-center">
        <button className="p-2 rounded-full hover:bg-blue-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Memoize the entire component to prevent unnecessary re-renders
export default memo(Sidebar); 