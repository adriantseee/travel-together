'use client';

import { useState, useEffect } from 'react';

export default function MapsView({ tripDetails }) {
  const [isLoading, setIsLoading] = useState(true);
  
  // This is a placeholder for the actual maps implementation
  // You would integrate with Google Maps, Mapbox, or another mapping service here
  
  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto py-4 px-6">
          <h1 className="text-2xl font-bold">Trip Maps</h1>
          <p className="text-blue-100 mt-1">{tripDetails?.city || 'Your Trip Destination'}</p>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="h-full flex flex-col space-y-4">
            <div className="bg-gray-100 rounded-lg p-4 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Trip Locations</h2>
              <div className="bg-white border border-gray-200 rounded-lg h-64 flex items-center justify-center">
                <p className="text-gray-500">Map integration will be displayed here</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-100 rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-2">Nearby Attractions</h3>
                <ul className="space-y-2">
                  <li className="bg-white p-3 rounded border border-gray-200">Attraction 1</li>
                  <li className="bg-white p-3 rounded border border-gray-200">Attraction 2</li>
                  <li className="bg-white p-3 rounded border border-gray-200">Attraction 3</li>
                </ul>
              </div>
              
              <div className="bg-gray-100 rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-2">Transportation Options</h3>
                <ul className="space-y-2">
                  <li className="bg-white p-3 rounded border border-gray-200">Public Transit</li>
                  <li className="bg-white p-3 rounded border border-gray-200">Taxi / Rideshare</li>
                  <li className="bg-white p-3 rounded border border-gray-200">Rental Cars</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 