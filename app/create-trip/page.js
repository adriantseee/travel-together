'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function CreateTrip() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [submissionTriggered, setSubmissionTriggered] = useState(false);
  
  // Form data state
  const [tripData, setTripData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    destination: '',
    coordinates: {
      lat: null,
      lng: null
    },
    city: '',
    country: '',
    tripType: 'leisure',
    travelers: 1,
    budget: {
      amount: '',
      currency: 'USD'
    },
    accommodation: '',
    transportation: [],
    activities: []
  });

  // Handle Enter key to prevent form submission
  const handleKeyDown = (e) => {
    // If Enter key is pressed and not in a textarea
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      // If not on the final step or not on the submit button
      if (currentStep !== 3 || e.target.type !== 'submit') {
        e.preventDefault(); // Prevent form submission
        
        // If on a valid step, move to next step instead
        if (currentStep < 3 && validateCurrentStep()) {
          nextStep();
        }
      }
    }
  };

  // Pre-defined options for select fields
  const tripTypes = [
    { id: 'leisure', label: 'Leisure' },
    { id: 'business', label: 'Business' },
    { id: 'family', label: 'Family' },
    { id: 'adventure', label: 'Adventure' },
    { id: 'cultural', label: 'Cultural' },
    { id: 'romantic', label: 'Romantic' }
  ];
  
  const currencies = [
    { code: 'USD', label: 'US Dollar ($)' },
    { code: 'EUR', label: 'Euro (€)' },
    { code: 'GBP', label: 'British Pound (£)' },
    { code: 'JPY', label: 'Japanese Yen (¥)' },
    { code: 'CAD', label: 'Canadian Dollar (C$)' },
    { code: 'AUD', label: 'Australian Dollar (A$)' }
  ];
  
  const accommodationTypes = [
    { id: 'hotel', label: 'Hotel' },
    { id: 'hostel', label: 'Hostel' },
    { id: 'airbnb', label: 'Airbnb / Vacation Rental' },
    { id: 'resort', label: 'Resort' },
    { id: 'camping', label: 'Camping' },
    { id: 'family', label: 'Family/Friends' },
    { id: 'other', label: 'Other' }
  ];
  
  const transportationTypes = [
    { id: 'flight', label: 'Flight' },
    { id: 'train', label: 'Train' },
    { id: 'car', label: 'Car Rental' },
    { id: 'bus', label: 'Bus' },
    { id: 'subway', label: 'Subway/Metro' },
    { id: 'bike', label: 'Bicycle' },
    { id: 'walk', label: 'Walking' },
    { id: 'boat', label: 'Boat/Ferry' },
    { id: 'rideshare', label: 'Rideshare (Uber/Lyft)' }
  ];
  
  const activityTypes = [
    { id: 'sightseeing', label: 'Sightseeing' },
    { id: 'museums', label: 'Museums & Galleries' },
    { id: 'food', label: 'Food & Dining' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'nature', label: 'Nature & Outdoors' },
    { id: 'sports', label: 'Sports & Recreation' },
    { id: 'relaxation', label: 'Relaxation & Wellness' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'nightlife', label: 'Nightlife' }
  ];

  // Mock destination search function - in a real app, would use a places API
  useEffect(() => {
    if (destinationSearchQuery.length >= 2) {
      // Simulate API call delay
      const timeoutId = setTimeout(() => {
        // Mock search results
        const mockResults = [
          { 
            name: 'New York', 
            country: 'United States', 
            coordinates: { lat: 40.7128, lng: -74.0060 } 
          },
          { 
            name: 'Paris', 
            country: 'France', 
            coordinates: { lat: 48.8566, lng: 2.3522 } 
          },
          { 
            name: 'Tokyo', 
            country: 'Japan', 
            coordinates: { lat: 35.6762, lng: 139.6503 } 
          },
          { 
            name: 'London', 
            country: 'United Kingdom', 
            coordinates: { lat: 51.5074, lng: -0.1278 }
          },
          { 
            name: 'Barcelona', 
            country: 'Spain', 
            coordinates: { lat: 41.3851, lng: 2.1734 }
          },
          { 
            name: 'Rome', 
            country: 'Italy', 
            coordinates: { lat: 41.9028, lng: 12.4964 }
          },
          { 
            name: 'Sydney', 
            country: 'Australia', 
            coordinates: { lat: -33.8688, lng: 151.2093 }
          },
          { 
            name: 'Dubai', 
            country: 'United Arab Emirates', 
            coordinates: { lat: 25.2048, lng: 55.2708 }
          },
          { 
            name: 'Singapore', 
            country: 'Singapore', 
            coordinates: { lat: 1.3521, lng: 103.8198 }
          },
          { 
            name: 'Bangkok', 
            country: 'Thailand', 
            coordinates: { lat: 13.7563, lng: 100.5018 }
          },
          { 
            name: 'Berlin', 
            country: 'Germany', 
            coordinates: { lat: 52.5200, lng: 13.4050 }
          },
          { 
            name: 'Amsterdam', 
            country: 'Netherlands', 
            coordinates: { lat: 52.3676, lng: 4.9041 }
          },
          { 
            name: 'Istanbul', 
            country: 'Turkey', 
            coordinates: { lat: 41.0082, lng: 28.9784 }
          },
          { 
            name: 'Seoul', 
            country: 'South Korea', 
            coordinates: { lat: 37.5665, lng: 126.9780 }
          },
          { 
            name: 'Kyoto', 
            country: 'Japan', 
            coordinates: { lat: 35.0116, lng: 135.7680 }
          },
          { 
            name: 'Venice', 
            country: 'Italy', 
            coordinates: { lat: 45.4408, lng: 12.3155 }
          },
          { 
            name: 'Hong Kong', 
            country: 'China', 
            coordinates: { lat: 22.3193, lng: 114.1694 }
          },
          { 
            name: 'San Francisco', 
            country: 'United States', 
            coordinates: { lat: 37.7749, lng: -122.4194 }
          },
          { 
            name: 'Rio de Janeiro', 
            country: 'Brazil', 
            coordinates: { lat: -22.9068, lng: -43.1729 }
          },
          { 
            name: 'Cape Town', 
            country: 'South Africa', 
            coordinates: { lat: -33.9249, lng: 18.4241 }
          },
          { 
            name: 'Marrakech', 
            country: 'Morocco', 
            coordinates: { lat: 31.6295, lng: -7.9811 }
          },
          { 
            name: 'Prague', 
            country: 'Czech Republic', 
            coordinates: { lat: 50.0755, lng: 14.4378 }
          },
          { 
            name: 'Vienna', 
            country: 'Austria', 
            coordinates: { lat: 48.2082, lng: 16.3738 }
          },
          { 
            name: 'Santorini', 
            country: 'Greece', 
            coordinates: { lat: 36.3932, lng: 25.4615 }
          },
          { 
            name: 'Bali', 
            country: 'Indonesia', 
            coordinates: { lat: -8.3405, lng: 115.0920 }
          }
        ].filter(city => 
          city.name.toLowerCase().includes(destinationSearchQuery.toLowerCase()) ||
          city.country.toLowerCase().includes(destinationSearchQuery.toLowerCase())
        );
        
        setSearchResults(mockResults);
        setShowSearchResults(mockResults.length > 0);
      }, 300);
      
      return () => clearTimeout(timeoutId);
    } else {
      setShowSearchResults(false);
    }
  }, [destinationSearchQuery]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      // Handle nested objects (e.g., coordinates.lat)
      const [objName, key] = name.split('.');
      setTripData(prev => ({
        ...prev,
        [objName]: {
          ...prev[objName],
          [key]: type === 'number' ? parseFloat(value) : value
        }
      }));
    } else if (type === 'checkbox') {
      // Handle checkbox inputs
      if (name === 'transportation' || name === 'activities') {
        if (checked) {
          setTripData(prev => ({
            ...prev,
            [name]: [...prev[name], value]
          }));
        } else {
          setTripData(prev => ({
            ...prev,
            [name]: prev[name].filter(item => item !== value)
          }));
        }
      }
    } else {
      // Handle regular inputs
      setTripData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Prevent form submission on Enter key in individual inputs
  const preventEnterSubmit = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If on a valid step, move to next step instead
      if (currentStep < 3 && validateCurrentStep()) {
        nextStep();
      }
    }
  };

  // Select a destination from search results
  const selectDestination = (destination) => {
    setTripData(prev => ({
      ...prev,
      destination: `${destination.name}, ${destination.country}`,
      city: destination.name,
      country: destination.country,
      coordinates: destination.coordinates
    }));
    setShowSearchResults(false);
  };

  // Navigation functions
  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  // Validate current step before proceeding
  const validateCurrentStep = () => {
    setError(null);
    
    if (currentStep === 1) {
      if (!tripData.name.trim()) {
        setError('Trip name is required');
        return false;
      }
      if (!tripData.destination.trim()) {
        setError('Destination is required');
        return false;
      }
    }
    
    if (currentStep === 2) {
      if (!tripData.startDate) {
        setError('Start date is required');
        return false;
      }
    }
    
    return true;
  };

  // Calculate trip duration helper function
  const calculateDuration = () => {
    if (!tripData.startDate || !tripData.endDate) return '';
    
    const startDate = new Date(tripData.startDate);
    const endDate = new Date(tripData.endDate);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
  };

  // Console logging for component rendering
  console.log('Component rendered, current step:', currentStep, 'submission triggered:', submissionTriggered);
  
  // Debug any form submissions on the document level
  useEffect(() => {
    const debugFormSubmits = (e) => {
      console.log('❗ FORM SUBMISSION DETECTED:', e.target);
      // Don't block if we're actually trying to submit
      if (!submissionTriggered) {
        console.log('❌ Blocking unexpected form submission');
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    document.addEventListener('submit', debugFormSubmits, true);
    return () => document.removeEventListener('submit', debugFormSubmits, true);
  }, [submissionTriggered]);
  
  // Clean method to handle the final trip creation
  const createTrip = async () => {
    console.log('🚀 Creating trip manually');
    setLoading(true);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      // Process data for database insertion with correct column names
      const tripToCreate = {
        name: tripData.name,
        description: tripData.description,
        start_date: tripData.startDate,
        end_date: tripData.endDate,
        created_by: user.id,
        community_post: false, // Default value
        city: tripData.city,
        country: tripData.country,
        destination: tripData.destination,
        latitude: tripData.coordinates.lat,
        longitude: tripData.coordinates.lng,
        trip_type: tripData.tripType,
        travelers: parseInt(tripData.travelers),
        budget_amount: tripData.budget.amount ? parseFloat(tripData.budget.amount) : null,
        budget_currency: tripData.budget.currency || 'USD',
        accommodation_type: tripData.accommodation,
        transportation: tripData.transportation,
        planned_activities: tripData.activities
      };
      
      console.log('Sending trip data to server:', tripToCreate);
      
      // Insert the trip
      const { data: newTrip, error: insertError } = await supabase
        .from('trips')
        .insert(tripToCreate)
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      console.log('Trip created successfully:', newTrip);
      router.push(`/itinerary/${newTrip.id}`);
    } catch (err) {
      console.error('Error creating trip:', err);
      setError(err.message);
      setLoading(false);
    }
  };
  
  // STEP 3 ISOLATED COMPONENT - no form elements whatsoever
  const Step3Component = () => {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-800">Trip Activities & Transportation</h2>
        
        {/* Debug info */}
        <div className="bg-yellow-50 p-2 mb-4 text-xs">
          <p>ISOLATED COMPONENT: No form elements</p>
          <p>Current step: {currentStep}</p>
        </div>
        
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">
            Transportation (select all that apply)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {transportationTypes.map(type => (
              <div key={type.id} className="flex items-center">
                <input
                  id={`transportation-${type.id}`}
                  name="transportation"
                  type="checkbox"
                  value={type.id}
                  checked={tripData.transportation.includes(type.id)}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`transportation-${type.id}`} className="ml-2 text-sm text-gray-700">
                  {type.label}
                </label>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">
            Activities (select all that apply)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {activityTypes.map(type => (
              <div key={type.id} className="flex items-center">
                <input
                  id={`activity-${type.id}`}
                  name="activities"
                  type="checkbox"
                  value={type.id}
                  checked={tripData.activities.includes(type.id)}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`activity-${type.id}`} className="ml-2 text-sm text-gray-700">
                  {type.label}
                </label>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-md p-4">
          <h3 className="text-md font-medium text-blue-800 mb-3">Trip Summary</h3>
          <div className="space-y-2 text-sm text-blue-700">
            <p><span className="font-medium">Name:</span> {tripData.name}</p>
            <p><span className="font-medium">Destination:</span> {tripData.destination}</p>
            <p><span className="font-medium">Dates:</span> {tripData.startDate ? new Date(tripData.startDate).toLocaleDateString() : 'Not set'} {tripData.endDate ? `- ${new Date(tripData.endDate).toLocaleDateString()}` : ''}</p>
            {tripData.startDate && tripData.endDate && (
              <p><span className="font-medium">Duration:</span> {calculateDuration()}</p>
            )}
            <p><span className="font-medium">Travelers:</span> {tripData.travelers}</p>
            <p><span className="font-medium">Trip Type:</span> {tripTypes.find(t => t.id === tripData.tripType)?.label}</p>
            {tripData.budget.amount && (
              <p><span className="font-medium">Budget:</span> {tripData.budget.amount} {tripData.budget.currency}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render the appropriate step of the form
  const renderStep = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800">Trip Basics</h2>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Trip Name*
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={tripData.name}
                onChange={handleInputChange}
                onKeyDown={preventEnterSubmit}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-gray-900 font-medium"
                placeholder="Summer Vacation to Italy"
              />
            </div>
            
            <div className="relative">
              <label htmlFor="destination" className="block text-sm font-medium text-gray-700">
                Destination*
              </label>
              <input
                id="destination"
                type="text"
                value={destinationSearchQuery}
                onChange={(e) => setDestinationSearchQuery(e.target.value)}
                onKeyDown={preventEnterSubmit}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-gray-900 font-medium"
                placeholder="Search for a city or country"
              />
              
              {showSearchResults && (
                <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-y-auto">
                  <ul className="rounded-md py-1 text-base">
                    {searchResults.map((result, index) => (
                      <li
                        key={index}
                        className="cursor-pointer px-4 py-2 hover:bg-blue-50 text-gray-900"
                        onClick={() => selectDestination(result)}
                      >
                        {result.name}, {result.country}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {tripData.destination && (
                <div className="mt-2 flex items-center">
                  <div className="rounded-md bg-blue-50 px-2 py-1 text-sm text-blue-700">
                    <span className="font-medium">{tripData.destination}</span>
                    <button
                      type="button"
                      className="ml-2 text-blue-500 hover:text-blue-700"
                      onClick={() => {
                        setTripData(prev => ({
                          ...prev,
                          destination: '',
                          city: '',
                          country: '',
                          coordinates: { lat: null, lng: null }
                        }));
                        setDestinationSearchQuery('');
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={tripData.description}
                onChange={handleInputChange}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-gray-900 font-medium"
                placeholder="A brief description of your trip"
              />
            </div>
            
            <div>
              <label htmlFor="tripType" className="block text-sm font-medium text-gray-700">
                Trip Type
              </label>
              <select
                id="tripType"
                name="tripType"
                value={tripData.tripType}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-gray-900 font-medium"
              >
                {tripTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="travelers" className="block text-sm font-medium text-gray-700">
                Number of Travelers
              </label>
              <input
                id="travelers"
                name="travelers"
                type="number"
                min="1"
                value={tripData.travelers}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-gray-900 font-medium"
              />
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800">Trip Dates & Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                  Start Date*
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={tripData.startDate}
                  onChange={handleInputChange}
                  onKeyDown={preventEnterSubmit}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-gray-900 font-medium"
                />
              </div>
              
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                  End Date
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={tripData.endDate}
                  min={tripData.startDate}
                  onChange={handleInputChange}
                  onKeyDown={preventEnterSubmit}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-gray-900 font-medium"
                />
              </div>
            </div>
            
            {tripData.startDate && tripData.endDate && (
              <div className="bg-blue-50 rounded-md p-3">
                <p className="text-sm text-blue-700">Trip Duration: {calculateDuration()}</p>
              </div>
            )}
            
            <div>
              <label htmlFor="accommodation" className="block text-sm font-medium text-gray-700">
                Primary Accommodation
              </label>
              <select
                id="accommodation"
                name="accommodation"
                value={tripData.accommodation}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-gray-900 font-medium"
              >
                <option value="">Select accommodation type</option>
                {accommodationTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="budget.amount" className="block text-sm font-medium text-gray-700">
                  Budget (Optional)
                </label>
                <input
                  id="budget.amount"
                  name="budget.amount"
                  type="number"
                  value={tripData.budget.amount}
                  onChange={handleInputChange}
                  onKeyDown={preventEnterSubmit}
                  min="0"
                  step="0.01"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-gray-900 font-medium"
                  placeholder="Estimated budget"
                />
              </div>
              
              <div>
                <label htmlFor="budget.currency" className="block text-sm font-medium text-gray-700">
                  Currency
                </label>
                <select
                  id="budget.currency"
                  name="budget.currency"
                  value={tripData.budget.currency}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-gray-900 font-medium"
                >
                  {currencies.map(currency => (
                    <option key={currency.code} value={currency.code}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Progress bar component
  const ProgressBar = () => {
    const steps = [
      { step: 1, label: 'Basics' },
      { step: 2, label: 'Dates & Details' },
      { step: 3, label: 'Activities & Review' }
    ];
    
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map(step => (
            <div key={step.step} className="flex flex-col items-center">
              <div 
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  currentStep === step.step ? 'bg-blue-600' : 
                  currentStep > step.step ? 'bg-green-500' : 'bg-gray-200'
                } text-white`}
              >
                {currentStep > step.step ? (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  step.step
                )}
              </div>
              <span className={`mt-1 text-xs ${
                currentStep === step.step ? 'font-medium text-blue-600' : 
                currentStep > step.step ? 'font-medium text-green-500' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 h-1 w-full bg-gray-200">
          <div 
            className="h-full bg-blue-600" 
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          ></div>
        </div>
      </div>
    );
  };

  // Return clean UI for different steps
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-blue-700 shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-white">Plan Your Trip</h1>
            <Link 
              href="/dashboard"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 border border-white"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>
      
      <main className="flex-grow mx-auto max-w-3xl w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white shadow sm:rounded-lg p-6">
          <ProgressBar />
          
          {/* CLEAN SLATE APPROACH */}
          {currentStep === 3 ? (
            <div className="isolated-container">
              <Step3Component />
              
              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </button>
                
                <button
                  id="manual-submit-button"
                  type="button"
                  onClick={() => {
                    console.log('Manual trip creation triggered');
                    setSubmissionTriggered(true);
                    createTrip();
                  }}
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center"
                >
                  {loading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {loading ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Steps 1-2 rendering (existing code) */}
              {currentStep === 1 && renderStep()}
              {currentStep === 2 && renderStep()}
              
              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : router.push('/dashboard')}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {currentStep === 1 ? 'Cancel' : 'Previous'}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    if (validateCurrentStep()) {
                      setCurrentStep(currentStep + 1);
                    }
                  }}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Next
                </button>
              </div>
            </>
          )}
          
          {/* Error message display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 