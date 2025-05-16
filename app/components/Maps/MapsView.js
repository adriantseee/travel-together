'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../../lib/supabase';
import { Loader } from '@googlemaps/js-api-loader';
import axios from 'axios';

// Don't import Leaflet directly, we'll load it dynamically
// import L from 'leaflet';

// Add a variable to detect if we're on the client side
const isClient = typeof window !== 'undefined';

// Explicit Mapbox style definition to ensure it's loaded properly
const mapStyles = `
  .mapboxgl-map {
    width: 100%;
    height: 100%;
  }
  .mapboxgl-canvas {
    width: 100% !important;
    height: 100% !important;
  }
  .marker {
    cursor: pointer;
  }
`;

// Define marker types with their icons and colors
const markerTypes = {
  hotel: {
    icon: 'hotel',
    color: '#0066ff',
    label: 'Hotels'
  },
  restaurant: {
    icon: 'restaurant',
    color: '#ff9900',
    label: 'Restaurants'
  },
  activity: {
    icon: 'attractions',
    color: '#33cc33',
    label: 'Activities'
  },
  transport: {
    icon: 'directions_car',
    color: '#cc3366',
    label: 'Transport'
  }
};

// Transport types with their colors
const transportColors = {
  walking: '#33cc33',
  driving: '#cc3366',
  transit: '#0066ff',
  cycling: '#ff9900',
  metro: '#9933cc'  // Add metro/train with a purple color
};

// Use environment variables for the API tokens
// Fallback to placeholders if not available
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.placeholder_token';
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || 'your_google_api_key';

// Debug environment variables
console.log('Environment check for tokens:', {
  MAPBOX_TOKEN_PREFIX: MAPBOX_TOKEN.substring(0, 6),
  MAPBOX_TOKEN_LENGTH: MAPBOX_TOKEN.length,
  GOOGLE_API_KEY_PREFIX: GOOGLE_MAPS_API_KEY.substring(0, 6),
  GOOGLE_API_KEY_LENGTH: GOOGLE_MAPS_API_KEY.length,
  NODE_ENV: process.env.NODE_ENV
});

// Cache mechanism for API responses
const apiCache = {
  places: new Map(),
  directions: new Map(),
  osm: new Map(),
  
  // Get from cache with expiration (24 hours)
  get(type, key) {
    const cache = this[type];
    const item = cache.get(key);
    
    if (!item) return null;
    
    // Check if cache is still valid (24 hours)
    if (Date.now() - item.timestamp > 24 * 60 * 60 * 1000) {
      cache.delete(key);
      return null;
    }
    
    return item.data;
  },
  
  // Set value in cache with timestamp
  set(type, key, data) {
    this[type].set(key, {
      data,
      timestamp: Date.now()
    });
  }
};

// Simple fallback map rendering function using Canvas when Mapbox fails
const renderFallbackMap = (container, center) => {
  if (!container) {
    console.error('Cannot render fallback map: container is null');
    return false;
  }

  try {
    console.log('Rendering fallback map on container with center:', center);
    
    // FALLBACK: Ensure we're using valid coordinates even for fallback
    let mapCenterLng = -74.006; // New York default
    let mapCenterLat = 40.7128;
    
    if (center) {
      mapCenterLng = center.lng;
      mapCenterLat = center.lat;
    } else if (tripDetails && typeof tripDetails === 'object') {
      console.log('FALLBACK MAP - Checking coordinates:', {
        directLat: tripDetails.latitude,
        directLng: tripDetails.longitude
      });
      
      if (tripDetails.latitude && tripDetails.longitude) {
        mapCenterLng = Number(tripDetails.longitude);
        mapCenterLat = Number(tripDetails.latitude);
        console.log('FALLBACK: Using direct coordinates');
      }
    }
    
    // First make sure container is visible and properly sized
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.minHeight = '400px';
    container.style.position = 'relative';
    
    // Clear any existing content
    container.innerHTML = '';
    
    // Add a simple message at the top
    const messageDiv = document.createElement('div');
    messageDiv.style.position = 'absolute';
    messageDiv.style.top = '10px';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translateX(-50%)';
    messageDiv.style.backgroundColor = 'rgba(255,255,255,0.9)';
    messageDiv.style.padding = '5px 10px';
    messageDiv.style.borderRadius = '4px';
    messageDiv.style.fontSize = '12px';
    messageDiv.style.zIndex = '1000';
    messageDiv.innerHTML = 'Using fallback map. Mapbox could not be initialized.';
    container.appendChild(messageDiv);
    
    // Try using a simple canvas-based map
    const canvas = document.createElement('canvas');
    canvas.width = container.offsetWidth || 800;
    canvas.height = container.offsetHeight || 600;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    container.appendChild(canvas);

    // Draw a simple map representation
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return false;
    }

    // Draw background
    ctx.fillStyle = '#e6e8eb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#d0d5db';
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw center marker
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Draw marker circle
    ctx.fillStyle = '#ff4d4f';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw text for the center
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`, centerX, centerY + 24);
    
    // Add "Fallback Map" text
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Fallback Map (Map APIs unavailable)', centerX, 30);
    
    console.log('Fallback map rendered successfully');
    return true;
    
  } catch (error) {
    console.error('Error rendering fallback map:', error);
    
    // Last resort: add text explanation
    try {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h3>Map Unavailable</h3>
          <p>We couldn't load any map due to technical issues.</p>
          <p>Location: ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}</p>
        </div>
      `;
      return true;
    } catch (e) {
      console.error('Even the last resort fallback failed:', e);
      return false;
    }
  }
};

// Initialize a Leaflet map 
const initLeafletMap = (container, center) => {
  try {
    // Create a new div for the Leaflet map
    const mapDiv = document.createElement('div');
    mapDiv.style.width = '100%';
    mapDiv.style.height = '100%';
    mapDiv.id = 'leaflet-map-container';
    container.appendChild(mapDiv);
    
    // Initialize the map
    const leafletMap = L.map('leaflet-map-container').setView([center.lat, center.lng], 13);
    
    // Add the OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMap);
    
    // Add a marker at the center
    L.marker([center.lat, center.lng]).addTo(leafletMap)
      .bindPopup('Your location')
      .openPopup();
    
    // Add a "Fallback Map" overlay
    const customControl = L.control({position: 'topleft'});
    customControl.onAdd = function() {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      div.style.padding = '8px';
      div.style.background = 'white';
      div.style.border = '2px solid rgba(0,0,0,0.2)';
      div.style.borderRadius = '4px';
      div.innerHTML = '<strong>Fallback Map</strong><br/>(Mapbox unavailable)';
      return div;
    };
    customControl.addTo(leafletMap);
    
    console.log('Leaflet map initialized successfully');
    
  } catch (e) {
    console.error('Error initializing Leaflet map:', e);
    renderBasicCanvasMap(container, center);
  }
};

// Basic canvas fallback if even Leaflet fails
const renderBasicCanvasMap = (container, center) => {
  try {
    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.width = container.offsetWidth || 800;
    canvas.height = container.offsetHeight || 600;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    // Simple map rendering
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = '#e6e8eb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#d0d5db';
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw center marker
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Draw marker circle
    ctx.fillStyle = '#ff4d4f';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw text for the center
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`, centerX, centerY + 24);
    
    // Add "Fallback Map" text
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Fallback Map (Map APIs unavailable)', centerX, 30);
    
    console.log('Basic canvas map rendered');
    
  } catch (error) {
    console.error('Error rendering basic canvas map:', error);
    
    // Last resort - text message
    container.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h3>Map Unavailable</h3>
        <p>Sorry, we couldn't load any map. This may be due to network issues or browser compatibility.</p>
        <p>Location: ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}</p>
      </div>
    `;
  }
};

export default function MapsView({ tripDetails, onAddEvent }) {
  // State variables
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);
  const [activeLayers, setActiveLayers] = useState({
    hotels: true,
    restaurants: true,
    activities: true,
    transport: true
  });
  const [mapMarkers, setMapMarkers] = useState([]);
  const [tripLocations, setTripLocations] = useState([]);
  const [nearbyAttractions, setNearbyAttractions] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [draggedMarker, setDraggedMarker] = useState(null);
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [googlePlacesService, setGooglePlacesService] = useState(null);
  const [containerReady, setContainerReady] = useState(false);
  const [useFixedContainer, setUseFixedContainer] = useState(false);
  
  // Add search state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSearchResult, setSelectedSearchResult] = useState(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchTime, setSearchTime] = useState('12:00');
  const [searchDuration, setSearchDuration] = useState(60);
  
  // State for multi-stop routing
  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [routingPoints, setRoutingPoints] = useState([]); // Array of {lng, lat}
  const [multiStopRouteDetails, setMultiStopRouteDetails] = useState(null); // { path: [], duration: 0, distance: 0 }
  const [routingPointMarkers, setRoutingPointMarkers] = useState([]); // Array of Mapbox marker instances
  const [transportMode, setTransportMode] = useState('driving'); // Add transportation mode state
  
  // Add state for the event modal
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventDetails, setEventDetails] = useState({
    name: '',
    startTime: '12:00',
    duration: 60,
    location: '',
    coordinates: null,
    day: 0,
    type: 'activity'
  });
  
  // Get current user from local storage or auth
  const [currentUser, setCurrentUser] = useState(null);
  
  // Initialize current user from local storage or auth
  useEffect(() => {
    const getUserInfo = async () => {
      try {
        // Try to get user from Supabase auth
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Get additional user data from profiles table
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
          if (profileData) {
            setCurrentUser({
              id: user.id,
              name: profileData.full_name || user.email,
              avatar: profileData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.full_name || user.email)}&background=random`
            });
          } else {
            // Use basic user info if profile not found
            setCurrentUser({
              id: user.id,
              name: user.email,
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=random`
            });
          }
        } else {
          // If no authenticated user, check localStorage for fallback
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setCurrentUser(JSON.parse(storedUser));
          } else {
            // Create default guest user
            const guestUser = {
              id: 'guest-' + Math.random().toString(36).substring(2, 9),
              name: 'Guest User',
              avatar: `https://ui-avatars.com/api/?name=Guest&background=random`
            };
            localStorage.setItem('user', JSON.stringify(guestUser));
            setCurrentUser(guestUser);
          }
        }
      } catch (error) {
        console.error('Error getting user info:', error);
        // Create default user on error
        const defaultUser = {
          id: 'default-' + Math.random().toString(36).substring(2, 9),
          name: 'Default User',
          avatar: `https://ui-avatars.com/api/?name=Default&background=random`
        };
        setCurrentUser(defaultUser);
      }
    };
    
    getUserInfo();
  }, []);
  
  // Constants
  const fixedContainerId = 'fixed-mapbox-container';
  
  // Refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const googleMap = useRef(null);
  
  // Set default coordinates if none available
  const defaultCoords = useMemo(() => {
    // Debug the incoming tripDetails data
    console.log('COORDINATE DEBUG - Trip Details:', {
      tripId: tripDetails?.id,
      fullTripDetails: tripDetails,
      rawLatitude: tripDetails?.latitude,
      rawLongitude: tripDetails?.longitude,
      rawNestedLat: tripDetails?.coordinates?.lat,
      rawNestedLng: tripDetails?.coordinates?.lng,
      rawCity: tripDetails?.city,
      rawCountry: tripDetails?.country
    });
    
    // Add type checks
    const latitude = tripDetails?.latitude ? Number(tripDetails.latitude) : null;
    const longitude = tripDetails?.longitude ? Number(tripDetails.longitude) : null;
    
    console.log('COORDINATE DEBUG - Parsed coordinates:', {
      parsedLatitude: latitude,
      parsedLongitude: longitude,
      usingDefaultCoordinates: (!latitude || !longitude) ? true : false
    });
    
    // Create the coordinates object
    const coords = { 
      lng: longitude || tripDetails?.coordinates?.lng || -74.006, 
      lat: latitude || tripDetails?.coordinates?.lat || 40.7128 // New York by default
    };
    
    console.log('COORDINATE DEBUG - Final coordinates being used:', coords);
    
    return coords;
  }, [tripDetails?.longitude, tripDetails?.latitude, tripDetails?.coordinates?.lng, tripDetails?.coordinates?.lat]);

  // Helper functions moved to the top
  // Core helper functions
  const deg2rad = useCallback((deg) => {
    return deg * (Math.PI/180);
  }, []);
  
  // Calculate distance between two coordinates
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
  }, [deg2rad]);
  
  const determineLocationType = useCallback((activity) => {
    if (!activity) return 'activity';
    
    activity = activity.toLowerCase();
    
    if (activity.includes('hotel') || activity.includes('stay') || activity.includes('accommodation')) {
      return 'hotel';
    } else if (activity.includes('restaurant') || activity.includes('lunch') || 
               activity.includes('dinner') || activity.includes('breakfast') || 
               activity.includes('eat') || activity.includes('food') || 
               activity.includes('cafe')) {
      return 'restaurant';
    } else if (activity.includes('transport') || activity.includes('taxi') || 
               activity.includes('train') || activity.includes('bus') || 
               activity.includes('flight') || activity.includes('airport')) {
      return 'transport';
    } else {
      return 'activity';
    }
  }, []);
  
  // Determine transport type based on distance and activity
  const determineTransportType = useCallback((from, to) => {
    // Calculate rough distance
    const distance = calculateDistance(
      from.coordinates.lat, 
      from.coordinates.lng, 
      to.coordinates.lat, 
      to.coordinates.lng
    );
    
    // Choose transport type based on distance
    if (distance < 0.5) {
      return 'walking';
    } else if (distance < 2) {
      return 'cycling';
    } else if (distance < 10) {
      return 'transit';
    } else {
      return 'driving';
    }
  }, [calculateDistance]);

  // Component-scoped getPlaceDetails function  
  const getPlaceDetails = useCallback((placeId) => {
    return new Promise((resolve, reject) => {
      if (!googlePlacesService) {
        reject('Google Places service not available');
        return;
      }
      
      googlePlacesService.getDetails(
        { placeId: placeId, fields: ['name', 'formatted_address', 'rating', 'photos', 'opening_hours', 'website', 'price_level'] },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            resolve(place);
          } else {
            reject(status);
          }
        }
      );
    });
  }, [googlePlacesService]);
  
  // Move fetchTripData before the initialization effect that uses it
  // Define fetchTripData first so it can be referenced later
  const fetchTripData = useCallback(async () => {
    try {
      // In a real implementation, fetch data from your Supabase database
      let tripLocationsData = [];
      let routesData = [];
      
      // If we have a trip ID, fetch actual data from Supabase
      if (tripDetails?.id) {
        // Fetch trip events from Supabase
        const { data: eventsData, error } = await supabase
          .from('trip_events')
          .select('*')
          .eq('trip_id', tripDetails.id)
          .order('time');
          
        if (error) {
          console.error('Error fetching trip events:', error);
        } else if (eventsData && eventsData.length > 0) {
          console.log('Fetched trip events for map:', eventsData);
          
          // Convert trip events to map locations
          tripLocationsData = eventsData.map(event => {
            // For now use random nearby coordinates
            // In a real app, you would fetch/store actual coordinates 
            const randomLng = defaultCoords.lng + (Math.random() * 0.05) - 0.025;
            const randomLat = defaultCoords.lat + (Math.random() * 0.05) - 0.025;
            
            return {
              id: event.id,
              name: event.activity,
              type: determineLocationType(event.activity),
              coordinates: { 
                lng: event.longitude || event.coordinates?.longitude || randomLng, 
                lat: event.latitude || event.coordinates?.latitude || randomLat 
              },
              day: event.day_index || 0,
              time: event.time || '09:00'
            };
          });
          
          // Create routes between events that follow each other on the same day
          const eventsByDay = {};
          eventsData.forEach(event => {
            const day = event.day_index || 0;
            if (!eventsByDay[day]) {
              eventsByDay[day] = [];
            }
            eventsByDay[day].push(event);
          });
          
          // Sort events by time and create routes
          Object.keys(eventsByDay).forEach(day => {
            const dayEvents = eventsByDay[day].sort((a, b) => {
              return a.time.localeCompare(b.time);
            });
            
            // Create routes between consecutive events
            for (let i = 0; i < dayEvents.length - 1; i++) {
              const fromEvent = tripLocationsData.find(loc => loc.id === dayEvents[i].id);
              const toEvent = tripLocationsData.find(loc => loc.id === dayEvents[i + 1].id);
              
              if (fromEvent && toEvent) {
                routesData.push({
                  id: `route-${fromEvent.id}-${toEvent.id}`,
                  from: fromEvent.id,
                  to: toEvent.id,
                  day: parseInt(day),
                  transportType: determineTransportType(fromEvent, toEvent),
                  coordinates: [
                    [fromEvent.coordinates.lng, fromEvent.coordinates.lat],
                    [toEvent.coordinates.lng, toEvent.coordinates.lat]
                  ]
                });
              }
            }
          });
        }
      }
      
      // If no data from Supabase or missing data, use empty arrays instead of sample data
      if (tripLocationsData.length === 0) {
        // Set empty arrays instead of using sample data
        tripLocationsData = [];
        routesData = [];
        
        // If there's a default coordinate, add a single marker at that location
        if (defaultCoords.lat && defaultCoords.lng) {
          console.log('No location data found - using empty map centered at default coordinates');
        }
      }
      
      // Set the data in state
      setTripLocations(tripLocationsData);
      setRoutes(routesData);
      
      // Clear any existing nearby attractions
      setNearbyAttractions([]);
      
    } catch (error) {
      console.error('Error fetching trip data:', error);
    }
  }, [tripDetails, defaultCoords, determineLocationType, determineTransportType]);

  // Now that fetchTripData is defined, we can use it in other functions
  
  // Use callback ref instead of useRef for more reliable detection
  const setMapContainerRef = useCallback(node => {
    if (node !== null) {
      console.log('Map container ref set via callback:', node);
      mapContainer.current = node;
      setContainerReady(true);
      
      // Initialize map immediately when container is available
      if (!map.current && !mapInitialized) {
        console.log('Container ready, initializing map directly');
        initializeMapDirectly(node);
      }
    }
  }, [mapInitialized]);
  
  // Modify initializeMapDirectly to ensure container has actual dimensions
  const initializeMapDirectly = useCallback((containerElement) => {
    try {
      console.log('Attempting direct map initialization');
      
      // Use passed container or try to get it directly
      let container = containerElement;
      if (!container) {
        console.log('Container not provided, trying to get by ID');
        container = document.getElementById('mapbox-container');
      }
      
      if (!container) {
        console.error('Container not found for direct initialization');
        return false;
      }
      
      // Make container visible and ensure it has dimensions
      container.style.width = '100%';
      container.style.minHeight = '500px';
      container.style.height = '100%';
      container.style.position = 'relative';
      container.style.display = 'block'; // Ensure it's visible
      
      // Check if container has actual dimensions
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;
      
      console.log('Creating map with dimensions:', {
        containerWidth,
        containerHeight
      });
      
      // If dimensions are zero, delay initialization and try again in 300ms
      if (containerWidth === 0 || containerHeight === 0) {
        console.log('Container has zero dimensions, delaying initialization');
        
        // Force recalculation of layout and try again in 300ms
        setTimeout(() => {
          // Explicitly set large dimensions to force the container to be sized
          container.style.width = '100%';
          container.style.height = '500px';
          
          // Try getting dimensions again
          const newWidth = container.offsetWidth;
          const newHeight = container.offsetHeight;
          
          console.log('After delay, container dimensions:', {
            width: newWidth,
            height: newHeight
          });
          
          if (newWidth > 0 && newHeight > 0) {
            // Now we can initialize the map
            createMapInstance(container);
          } else {
            console.error('Container still has zero dimensions after delay');
            // Make a last attempt with hardcoded dimensions
            container.style.width = '800px';
            container.style.height = '600px';
            setTimeout(() => createMapInstance(container), 200);
          }
        }, 300);
        
        return true;
      }
      
      // DIRECT INIT: Ensure we're using valid coordinates
      let mapCenterLng = -74.006; // New York default
      let mapCenterLat = 40.7128;
      
      if (tripDetails && typeof tripDetails === 'object') {
        console.log('DIRECT INIT - Coordinate check:', {
          directLat: tripDetails.latitude,
          directLng: tripDetails.longitude,
          nestedLat: tripDetails.coordinates?.lat,
          nestedLng: tripDetails.coordinates?.lng
        });
        
        // Try all possible coordinate sources
        if (tripDetails.latitude && tripDetails.longitude) {
          // Direct coordinates from database
          mapCenterLng = Number(tripDetails.longitude);
          mapCenterLat = Number(tripDetails.latitude);
          console.log('DIRECT INIT: Using direct coordinates');
        } else if (tripDetails.coordinates?.lat && tripDetails.coordinates?.lng) {
          // Nested coordinates
          mapCenterLng = Number(tripDetails.coordinates.lng);
          mapCenterLat = Number(tripDetails.coordinates.lat);
          console.log('DIRECT INIT: Using nested coordinates');
        } else {
          console.log('DIRECT INIT: Using default New York coordinates');
        }
      }
      
      // If dimensions are good, initialize immediately
      try {
        // Initialize Mapbox
        if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'pk.placeholder_token') {
          console.error('No valid Mapbox token for map creation');
          renderFallbackMap(container, defaultCoords);
          setIsLoading(false);
          setMapInitialized(true);
          return false;
        }
        
        // Set access token
        mapboxgl.accessToken = MAPBOX_TOKEN;
        
        // Create map
        map.current = new mapboxgl.Map({
          container: container,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [mapCenterLng, mapCenterLat],
          zoom: 12,
          preserveDrawingBuffer: true
        });
        
        console.log('MAP INITIALIZATION - Using center coordinates:', [mapCenterLng, mapCenterLat]);
        
        // Add event handlers
        map.current.on('load', () => {
          console.log('Map loaded successfully');
          
          // Add navigation controls
          map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
          
          // Force resize immediately
          map.current.resize();
          
          // Set states
          setIsLoading(false);
          setMapInitialized(true);
          
          // Fetch data
          fetchTripData();
        });
        
        // Add error handling
        map.current.on('error', (e) => {
          console.error('Error in map:', e);
          renderFallbackMap(container, defaultCoords);
          setIsLoading(false);
          setMapInitialized(true);
        });
        
        return true;
      } catch (err) {
        console.error('Error creating map instance:', err);
        renderFallbackMap(container, defaultCoords);
        setIsLoading(false);
        setMapInitialized(true);
        return false;
      }
    } catch (error) {
      console.error('Error directly initializing map:', error);
      if (containerElement) {
        renderFallbackMap(containerElement, defaultCoords);
      }
      setIsLoading(false);
      setMapInitialized(true);
      return false;
    }
  }, [defaultCoords, MAPBOX_TOKEN, fetchTripData, tripDetails]);

  // Add a hook to stabilize the layout before map initialization
  useEffect(() => {
    if (mapInitialized && map.current) {
      // Add a visibility monitor to detect if the map disappears
      const visibilityCheck = setInterval(() => {
        if (map.current) {
          const container = map.current.getContainer();
          const isVisible = container && 
            container.offsetWidth > 0 && 
            container.offsetHeight > 0 &&
            getComputedStyle(container).display !== 'none';
            
          if (!isVisible) {
            console.log('Map container became invisible or zero sized, forcing resize');
            try {
              map.current.resize();
            } catch (e) {
              console.error('Error resizing disappeared map:', e);
            }
          }
        } else {
          clearInterval(visibilityCheck);
        }
      }, 500);
      
      return () => clearInterval(visibilityCheck);
    }
  }, [mapInitialized, map.current]);

  // Modify createMapInstance to correctly handle fixed container
  const createMapInstance = useCallback((container) => {
    // Initialize Mapbox
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'pk.placeholder_token') {
      console.error('No valid Mapbox token for map creation');
      renderFallbackMap(container, defaultCoords);
      setIsLoading(false);
      setMapInitialized(true);
      return false;
    }
    
    // Set access token
    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    // Force dimensions directly rather than through styles
    let width, height;
    
    if (useFixedContainer) {
      // For fixed container, measure actual dimensions
      width = container.offsetWidth || 800;
      height = container.offsetHeight || 600;
      
      // If dimensions are too small, set minimum values
      if (width < 400) width = 800;
      if (height < 400) height = 600;
      
      console.log('Fixed container dimensions:', { width, height });
    } else {
      // For normal container, use standard dimensions
      width = container.offsetWidth || 500;
      height = container.offsetHeight || 500;
    }
    
    // Always log the final dimensions
    console.log('Final map dimensions for initialization:', { width, height, container });
    
    try {
      // Create map with explicitly set dimensions
      map.current = new mapboxgl.Map({
        container: container,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [defaultCoords.lng, defaultCoords.lat],
        zoom: 12,
        width: width,
        height: height,
        preserveDrawingBuffer: true  // Important for stable rendering
      });
      
      console.log('MAP INITIALIZATION - Using center coordinates:', [defaultCoords.lng, defaultCoords.lat]);
      
      // Add event handlers
      map.current.on('load', () => {
        console.log('Map loaded successfully');
        
        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Force resize immediately
        map.current.resize();
        
        // Set states
        setIsLoading(false);
        setMapInitialized(true);
        
        // Fetch data
        fetchTripData();
      });
      
      // Add error handling
      map.current.on('error', (e) => {
        console.error('Error in map:', e);
        renderFallbackMap(container, defaultCoords);
        setIsLoading(false);
        setMapInitialized(true);
      });
      
      return true;
    } catch (err) {
      console.error('Error creating map instance:', err);
      renderFallbackMap(container, defaultCoords);
      setIsLoading(false);
      setMapInitialized(true);
      return false;
    }
  }, [MAPBOX_TOKEN, defaultCoords, fetchTripData, useFixedContainer]);

  // Add a toggle for fixed/embedded map
  const toggleMapContainer = useCallback(() => {
    // Don't allow toggling if map is already initialized
    if (mapInitialized && map.current) {
      console.log('Cannot toggle container type when map is already initialized');
      return;
    }
    
    setUseFixedContainer(prev => !prev);
  }, [mapInitialized]);

  // After both functions are defined, use useEffect to update the initializeMapDirectly
  // function to include fetchTripData in its closure
  useEffect(() => {
    // This effect ensures fetchTripData is available to initializeMapDirectly
    // without creating circular dependencies
  }, [fetchTripData, initializeMapDirectly]);

  // Add a failsafe for loading state
  useEffect(() => {
    // Safety timeout to ensure we don't get stuck loading
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        console.log('Forcing map to load after timeout');
        setIsLoading(false);
        setMapInitialized(true);
        
        // If we hit the timeout, try to render the fallback map
        if (mapContainer.current) {
          console.log('Rendering fallback map');
          renderFallbackMap(mapContainer.current, defaultCoords);
        }
      }
    }, 3000); // 3-second timeout for faster fallback
    
    return () => clearTimeout(loadingTimeout);
  }, [isLoading, defaultCoords]);

  // Add a second useEffect for handling the map load timeout independently
  useEffect(() => {
    // Only run this if the map container exists but map isn't initialized
    if (mapContainer.current && !mapInitialized && !map.current) {
      console.log('Setting up map initialization safeguards');
      
      // Attempt to initialize the map after a short delay
      const initTimer = setTimeout(() => {
        if (!mapInitialized) {
          console.log('Attempting map initialization after delay');
          // Force container to be visible and sized properly
          if (mapContainer.current) {
            mapContainer.current.style.width = '100%';
            mapContainer.current.style.height = '500px';
            mapContainer.current.style.position = 'relative';
            
            try {
              // Initialize Mapbox
              if (!map.current && MAPBOX_TOKEN && MAPBOX_TOKEN !== 'pk.placeholder_token') {
                mapboxgl.accessToken = MAPBOX_TOKEN;
                map.current = new mapboxgl.Map({
                  container: mapContainer.current,
                  style: 'mapbox://styles/mapbox/streets-v12',
                  center: [defaultCoords.lng, defaultCoords.lat],
                  zoom: 12
                });
                
                map.current.on('load', () => {
                  console.log('Mapbox loaded from fallback timer');
                  setIsLoading(false);
                  setMapInitialized(true);
                });
                
                map.current.on('error', () => {
                  console.error('Mapbox error from fallback initialization');
                  if (mapContainer.current) {
                    renderFallbackMap(mapContainer.current, defaultCoords);
                  }
                  setIsLoading(false);
                  setMapInitialized(true);
                });
              }
            } catch (error) {
              console.error('Error in fallback map initialization:', error);
              renderFallbackMap(mapContainer.current, defaultCoords);
              setIsLoading(false);
              setMapInitialized(true);
            }
          }
        }
      }, 1500);
      
      // Final fallback - if nothing worked after 5 seconds, use the fallback map
      const fallbackTimer = setTimeout(() => {
        if (!mapInitialized) {
          console.log('Final fallback - forcing map to render after timeout');
          if (mapContainer.current) {
            renderFallbackMap(mapContainer.current, defaultCoords);
          }
          setIsLoading(false);
          setMapInitialized(true);
        }
      }, 5000);
      
      return () => {
        clearTimeout(initTimer);
        clearTimeout(fallbackTimer);
      };
    }
  }, [mapContainer, mapInitialized, defaultCoords]);

  // Initialization effect - modify to use the container element by ID if ref fails
  useEffect(() => {
    if (!map.current && !mapInitialized) {
      try {
        // First try to get container from ref
        let containerElement = mapContainer.current;
        
        // If ref doesn't work, try getting by ID directly
        if (!containerElement) {
          console.log('Container ref not available, trying to get by ID');
          containerElement = document.getElementById('mapbox-container');
          
          if (containerElement) {
            console.log('Found container by ID');
            // Update the ref
            mapContainer.current = containerElement;
            setContainerReady(true);
          }
        }
        
        if (!containerElement) {
          console.error('Container element not found by ref or ID');
          setIsLoading(false);
          setMapInitialized(true); // Prevent retry loops
          return;
        }
        
        console.log('Map initialization starting with container:', containerElement);
        
        // Force container to have explicit dimensions
        containerElement.style.width = '100%';
        containerElement.style.height = '500px';
        containerElement.style.position = 'relative';
        
        // Check WebGL support more thoroughly
        let hasWebGL = false;
        try {
          const canvas = document.createElement('canvas');
          hasWebGL = !!(
            window.WebGLRenderingContext && 
            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
          );
          console.log('WebGL support check:', hasWebGL);
        } catch (e) {
          console.error('WebGL check failed:', e);
        }
        
        if (!hasWebGL) {
          console.error('WebGL not supported - falling back to Leaflet');
          renderFallbackMap(containerElement, defaultCoords);
          setIsLoading(false);
          setMapInitialized(true);
          return;
        }
        
        // Verify Mapbox token
        if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'pk.placeholder_token') {
          console.error('Invalid Mapbox token:', MAPBOX_TOKEN);
          alert('Missing Mapbox API token. Using fallback map.');
          renderFallbackMap(containerElement, defaultCoords);
          setIsLoading(false);
          setMapInitialized(true);
          return;
        }
        
        // Initialize Mapbox with proper access token
        mapboxgl.accessToken = MAPBOX_TOKEN;
        
        console.log('Creating map with container:', containerElement);
        
        // CRITICAL FIX: Ensure we're using valid coordinates
        // Check explicitly if we have valid trip coordinates before using them
        let mapCenterLng = -74.006; // New York default
        let mapCenterLat = 40.7128;
        
        if (tripDetails && typeof tripDetails === 'object') {
          console.log('CREATEMAP - Coordinate check:', {
            directLat: tripDetails.latitude,
            directLng: tripDetails.longitude,
            nestedLat: tripDetails.coordinates?.lat,
            nestedLng: tripDetails.coordinates?.lng,
            defaultCoords
          });
          
          // Try all possible coordinate sources
          if (tripDetails.latitude && tripDetails.longitude) {
            // Direct coordinates from database
            mapCenterLng = Number(tripDetails.longitude);
            mapCenterLat = Number(tripDetails.latitude);
            console.log('CREATEMAP: Using direct coordinates');
          } else if (tripDetails.coordinates?.lat && tripDetails.coordinates?.lng) {
            // Nested coordinates
            mapCenterLng = Number(tripDetails.coordinates.lng);
            mapCenterLat = Number(tripDetails.coordinates.lat);
            console.log('CREATEMAP: Using nested coordinates');
          } else {
            // Default coords
            mapCenterLng = defaultCoords.lng;
            mapCenterLat = defaultCoords.lat;
            console.log('CREATEMAP: Using default coordinates');
          }
        }
        
        // Create map with additional error handling
        map.current = new mapboxgl.Map({
          container: containerElement,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [mapCenterLng, mapCenterLat],
          zoom: 12,
          failIfMajorPerformanceCaveat: false,
          attributionControl: true
        });
        
        // Add a timeout to detect loading issues
        const mapLoadTimeout = setTimeout(() => {
          if (!map.current || !map.current.loaded()) {
            console.error('Map failed to load after timeout');
            if (containerElement) {
              renderFallbackMap(containerElement, defaultCoords);
            }
            setIsLoading(false);
            setMapInitialized(true);
          }
        }, 10000);
        
        // Add proper event handlers
        map.current.on('load', () => {
          console.log('Mapbox loaded successfully');
          clearTimeout(mapLoadTimeout);
          setIsLoading(false);
          setMapInitialized(true);
          
          // Force resize to ensure proper rendering
          map.current.resize();
          
          // Add navigation controls
          map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
          map.current.addControl(new mapboxgl.GeolocateControl({
            positionOptions: {
              enableHighAccuracy: true
            },
            trackUserLocation: true
          }), 'top-right');
          
          // Initialize routes and fetch data
          try {
            map.current.addSource('routes', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: []
              }
            });
            
            // Add layers for routes
            Object.entries(transportColors).forEach(([type, color]) => {
              map.current.addLayer({
                id: `route-${type}`,
                type: 'line',
                source: 'routes',
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                paint: {
                  'line-color': color,
                  'line-width': 5,
                  'line-opacity': 0.8
                },
                filter: ['==', 'transportType', type]
              });
            });
            
            // Add a test marker to verify map is working
            new mapboxgl.Marker()
              .setLngLat([defaultCoords.lng, defaultCoords.lat])
              .addTo(map.current);
            
            // Fetch trip data
            fetchTripData();
          } catch (err) {
            console.error('Error setting up map layers:', err);
          }
        });
        
        map.current.on('error', (e) => {
          console.error('Mapbox error:', e);
          setIsLoading(false);
          
          if (containerElement) {
            renderFallbackMap(containerElement, defaultCoords);
            setMapInitialized(true);
          }
        });
        
      } catch (error) {
        console.error('Error initializing map:', error);
        if (containerElement) {
          renderFallbackMap(containerElement, defaultCoords);
        }
        setIsLoading(false);
        setMapInitialized(true);
      }
      
      return () => {
        if (map.current) {
          try {
            map.current.remove();
          } catch (e) {
            console.error('Error cleaning up map:', e);
          }
          map.current = null;
        }
      };
    }
  }, [mapInitialized, defaultCoords, fetchTripData]);
  
  // Initialize Google Maps only once
  useEffect(() => {
    if (!googleMapsLoaded) {
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places']
      });
      
      loader.load().then(() => {
        console.log('Google Maps API loaded');
        setGoogleMapsLoaded(true);
        
        try {
          // Create an invisible map div for Places service
          const mapDiv = document.createElement('div');
          mapDiv.style.display = 'none';
          document.body.appendChild(mapDiv);
          
          // Initialize map
          googleMap.current = new window.google.maps.Map(mapDiv, {
            center: { lat: defaultCoords.lat, lng: defaultCoords.lng },
            zoom: 15
          });
          
          // Create Places service using the hidden map
          // Note: While we're using PlacesService for now, we're structuring the code to make it 
          // easier to migrate to the new Places API when needed
          const placesService = new window.google.maps.places.PlacesService(googleMap.current);
          setGooglePlacesService(placesService);
        } catch (error) {
          console.error('Error initializing Google Places:', error);
          setIsLoading(false); // Make sure we're not stuck on loading
        }
      }).catch(error => {
        console.error('Error loading Google Maps API:', error);
        setIsLoading(false); // Make sure we're not stuck on loading
        // Will fallback to OpenStreetMap
      });
    }
    
    return () => {
      // Clean up the hidden map div if it exists
      if (googleMap.current) {
        const mapElement = googleMap.current.getDiv();
        if (mapElement && mapElement.parentNode) {
          mapElement.parentNode.removeChild(mapElement);
        }
      }
    };
  }, [googleMapsLoaded, defaultCoords]);
  
  // UI interaction callbacks
  const toggleLayer = useCallback((layerType) => {
    setActiveLayers(prev => ({
      ...prev,
      [layerType]: !prev[layerType]
    }));
  }, []);
  
  const handleDayChange = useCallback((dayIndex) => {
    setSelectedDay(dayIndex);
  }, []);
  
  // Add addAttractionToItinerary as a callback
  const addAttractionToItinerary = useCallback((attraction) => {
    console.log('Adding to itinerary:', attraction);
    
    // Open the modal with initial details
    setEventDetails({
      name: attraction.name,
      startTime: '12:00',
      duration: 60,
      location: attraction.vicinity || '',
      coordinates: {
        latitude: attraction.coordinates.lat,
        longitude: attraction.coordinates.lng
      },
      day: selectedDay,
      type: attraction.type || 'activity'
    });
    
    setIsEventModalOpen(true);
  }, [selectedDay]);
  
  // Define updateMarkerVisibility before using it
  const updateMarkerVisibility = useCallback(() => {
    // Don't reference mapMarkers in the dependency array
    // Instead, get a fresh reference each time
    const currentMarkers = mapMarkers;
    
    currentMarkers.forEach(marker => {
      if (!marker || !marker.getElement) return;
      
      const markerElement = marker.getElement();
      const markerType = marker._customData?.type;
      
      if (markerType) {
        if (markerType === 'hotel' && !activeLayers.hotels) {
          markerElement.style.display = 'none';
        } else if (markerType === 'restaurant' && !activeLayers.restaurants) {
          markerElement.style.display = 'none';
        } else if (markerType === 'activity' && !activeLayers.activities) {
          markerElement.style.display = 'none';
        } else if (markerType === 'transport' && !activeLayers.transport) {
          markerElement.style.display = 'none';
        } else {
          markerElement.style.display = 'block';
        }
      }
    });
  }, [activeLayers]); // Only depend on activeLayers, not mapMarkers
  
  // Marker visibility effects - move this after defining updateMarkerVisibility
  useEffect(() => {
    // Only run this if we actually have markers
    if (map.current && mapMarkers.length > 0) {
      updateMarkerVisibility();
    }
  }, [activeLayers, mapMarkers.length, updateMarkerVisibility, map]);
  
  // Fix removeAllMarkers to not have mapMarkers as a dependency
  const removeAllMarkers = useCallback(() => {
    // Remove all existing markers from the map
    if (map.current) {
      // Use a local reference instead of the state to avoid dependency loops
      const currentMarkers = mapMarkers;
      currentMarkers.forEach(marker => {
        if (marker && marker.remove) {
          marker.remove();
        }
      });
      setMapMarkers([]);
    }
  }, [map]); // Only depend on the map ref, not on mapMarkers
  
  // Create a memoized addMarkerToMap function
  const addMarkerToMap = useCallback((location) => {
    if (!map.current) return null;
    
    const markerType = markerTypes[location.type] || markerTypes.activity;
    
    // Create marker element
    const markerEl = document.createElement('div');
    markerEl.className = 'marker';
    markerEl.style.backgroundColor = markerType.color;
    markerEl.style.width = '30px';
    markerEl.style.height = '30px';
    markerEl.style.borderRadius = '50%';
    markerEl.style.display = 'flex';
    markerEl.style.justifyContent = 'center';
    markerEl.style.alignItems = 'center';
    markerEl.style.color = 'white';
    markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    markerEl.style.cursor = 'move';
    markerEl.innerHTML = `<span>${location.name.charAt(0)}</span>`;
    markerEl.title = location.name;
    
    // Add tooltip on hover
    const popup = new mapboxgl.Popup({
      offset: 25,
      closeButton: false
    }).setText(location.name);
    
    // Create and add marker to map
    const marker = new mapboxgl.Marker({
      element: markerEl,
      draggable: true
    })
      .setLngLat([location.coordinates.lng, location.coordinates.lat])
      .setPopup(popup)
      .addTo(map.current);
    
    // Store location type with marker for filtering
    marker._customData = { 
      id: location.id,
      type: location.type 
    };
    
    // Add drag events for itinerary planning
    marker.on('dragstart', () => {
      setDraggedMarker(location);
    });
    
    marker.on('dragend', async () => {
      // Get new coordinates after drag
      const newCoords = marker.getLngLat();
      
      // In a real app, you would update the location in the database
      console.log('Marker moved:', {
        id: location.id,
        newCoordinates: { lng: newCoords.lng, lat: newCoords.lat }
      });
      
      // Update routes connected to this location
      updateConnectedRoutes(location.id, newCoords);
      
      setDraggedMarker(null);
    });
    
    return marker;
  }, [map]);
  
  // Fix removeNearbyMarkers to avoid dependency loops
  const removeNearbyMarkers = useCallback(() => {
    // Instead of using state directly, work with a local reference
    // to avoid dependency loops
    if (!map.current) return;
    
    const markersToRemove = [];
    // Use a direct reference to current state to avoid stale closures
    const currentMarkers = mapMarkers;
    
    currentMarkers.forEach(marker => {
      if (marker && marker._customData?.isNearby) {
        marker.remove();
        markersToRemove.push(marker);
      }
    });
    
    if (markersToRemove.length > 0) {
      // Use functional state update to ensure we're working with the latest state
      setMapMarkers(prev => 
        prev.filter(marker => !markersToRemove.includes(marker))
      );
    }
  }, [map]); // Only depend on map, not on mapMarkers
  
  // Get directions using Mapbox with caching
  const getDirections = useCallback(async (from, to, mode = 'driving') => {
    const cacheKey = `${from.lng},${from.lat};${to.lng},${to.lat}-${mode}`;
    
    // Check cache first
    const cachedData = apiCache.get('directions', cacheKey);
    if (cachedData) {
      console.log('Using cached directions data');
      return cachedData;
    }
    
    try {
      // Use Mapbox Directions API
      const modeParam = mode === 'driving' ? 'driving' : 
                        mode === 'walking' ? 'walking' : 
                        mode === 'cycling' ? 'cycling' : 'driving';
      
      const url = `https://api.mapbox.com/directions/v5/mapbox/${modeParam}/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
      
      const response = await axios.get(url);
      
      if (response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        const result = {
          coordinates: route.geometry.coordinates,
          distance: route.distance,
          duration: route.duration
        };
        
        // Cache the results
        apiCache.set('directions', cacheKey, result);
        return result;
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
    }
    
    // Fallback to a simple straight line if the API fails
    return {
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat]
      ],
      distance: 0,
      duration: 0
    };
  }, []);
  
  // Fix the drawRoutes function to avoid infinite loops
  const drawRoutes = useCallback(async (routesToDraw) => {
    if (!map.current || !map.current.getSource('routes')) return;
    
    // Create enhanced routes with real direction data where possible
    const enhancedRoutes = await Promise.all(routesToDraw.map(async route => {
      // Find source and destination locations
      const source = tripLocations.find(loc => loc.id === route.from);
      const destination = tripLocations.find(loc => loc.id === route.to);
      
      if (!source || !destination) return route;
      
      try {
        // Get directions with our cached/API function
        const directions = await getDirections(
          source.coordinates, 
          destination.coordinates, 
          route.transportType
        );
        
        // Return enhanced route with actual path data
        return {
          ...route,
          coordinates: directions.coordinates || route.coordinates,
          distance: directions.distance,
          duration: directions.duration
        };
      } catch (error) {
        console.error('Error getting directions, using straight line:', error);
        return route;
      }
    }));
    
    // Create GeoJSON features for the routes
    const features = enhancedRoutes.map(route => ({
      type: 'Feature',
      properties: {
        id: route.id,
        transportType: route.transportType
      },
      geometry: {
        type: 'LineString',
        coordinates: route.coordinates
      }
    }));
    
    // Update the routes source with new data
    map.current.getSource('routes').setData({
      type: 'FeatureCollection',
      features
    });
  }, [tripLocations, getDirections]);
  
  // Update the updateMapForDay function to use the memoized drawRoutes
  const updateMapForDay = useCallback((dayIndex) => {
    if (!map.current) return;
    
    // Filter locations for the selected day
    const dayLocations = tripLocations.filter(location => location.day === dayIndex);
    
    // Filter routes for the selected day
    const dayRoutes = routes.filter(route => route.day === dayIndex);
    
    // Remove existing markers from the map directly
    // without depending on the state
    const currentMarkers = mapMarkers;  // Local reference
    currentMarkers.forEach(marker => {
      if (marker && marker.remove) {
        marker.remove();
      }
    });
    
    // Add markers for each location
    const newMarkers = [];
    dayLocations.forEach(location => {
      const marker = addMarkerToMap(location);
      if (marker) newMarkers.push(marker);
    });
    
    // Update markers state once
    setMapMarkers(newMarkers);
    
    // Draw routes
    drawRoutes(dayRoutes);
    
    // Fly to the first location of the day or default coords if none
    if (dayLocations.length > 0) {
      map.current.flyTo({
        center: [dayLocations[0].coordinates.lng, dayLocations[0].coordinates.lat],
        zoom: 12,
        essential: true
      });
    }
  }, [tripLocations, routes, addMarkerToMap, drawRoutes, map]); // Remove mapMarkers dependency
  
  // Update the effect for selected day changes to use removeAllMarkers
  useEffect(() => {
    if (map.current && !isLoading && mapInitialized) {
      // No need to call removeAllMarkers here
      // Just update the map for the selected day directly
      updateMapForDay(selectedDay);
    }
  }, [selectedDay, isLoading, mapInitialized, updateMapForDay]);
  
  const updateConnectedRoutes = useCallback((locationId, newCoords) => {
    // In a real app, you would update routes in the database
    // For now, just log that we'd update routes connected to this point
    console.log('Updating routes connected to location:', locationId);
  }, []);

  // Convert addNearbyMarkerToMap to useCallback with proper dependencies
  const addNearbyMarkerToMap = useCallback((attraction) => {
    if (!map.current) return null;
    
    const markerType = markerTypes[attraction.type] || markerTypes.activity;
    
    // Create marker element with a different style for suggestions
    const markerEl = document.createElement('div');
    markerEl.className = 'nearby-marker';
    markerEl.style.backgroundColor = 'white';
    markerEl.style.border = `2px solid ${markerType.color}`;
    markerEl.style.width = '25px';
    markerEl.style.height = '25px';
    markerEl.style.borderRadius = '50%';
    markerEl.style.display = 'flex';
    markerEl.style.justifyContent = 'center';
    markerEl.style.alignItems = 'center';
    markerEl.style.color = markerType.color;
    markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    markerEl.style.cursor = 'pointer';
    markerEl.style.fontSize = '12px';
    markerEl.style.fontWeight = 'bold';
    markerEl.innerHTML = `<span>+</span>`;
    markerEl.title = `Add ${attraction.name} to itinerary`;
    
    // Enhanced popup HTML with more details
    let popupHtml = `
      <div class="place-popup" style="min-width: 200px; max-width: 300px;">
        <strong style="display: block; margin-bottom: 5px; font-size: 16px; color: #1a202c;">${attraction.name}</strong>
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <span style="color: #f8b400;">${"★".repeat(Math.round(attraction.rating || 0))}</span>
          <span style="color: #ccc;">${"★".repeat(5 - Math.round(attraction.rating || 0))}</span>
          <span style="margin-left: 5px; color: #4a5568; font-size: 14px;">${attraction.rating || 'Not rated'}</span>
        </div>
    `;
    
    // Add address if available
    if (attraction.vicinity) {
      popupHtml += `<div style="margin-bottom: 5px; font-size: 14px; color: #2d3748;">${attraction.vicinity}</div>`;
    }
    
    // Add price level if available (Google data)
    if (attraction.priceLevel !== undefined) {
      const priceText = "$".repeat(attraction.priceLevel);
      popupHtml += `<div style="margin-bottom: 5px; color: #4a5568;">Price: ${priceText || 'N/A'}</div>`;
    }
    
    // Add a photo if available
    if (attraction.photos && attraction.photos.length > 0) {
      const photoObj = attraction.photos[0];
      const photoUrl = typeof photoObj === 'string' ? photoObj : photoObj.getUrl ? photoObj.getUrl() : null;
      
      console.log('Photo URL for popup:', {
        location: attraction.name,
        photoUrl,
        photoType: typeof photoUrl,
        hasValue: Boolean(photoUrl)
      });
      
      if (photoUrl) {
        popupHtml += `
          <div style="width: 100%; height: 120px; margin-bottom: 5px; position: relative; overflow: hidden; border-radius: 4px; background-color: #f0f0f0;">
            <img 
              src="${photoUrl}" 
              style="width: 100%; height: 100%; object-fit: cover;" 
              onload="this.style.opacity='1'; this.parentNode.querySelector('.loader-overlay').style.display='none';" 
              onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\\'padding: 10px; text-align: center; color: #4a5568;\\'>Image unavailable</div>';" 
              loading="lazy"
            />
            <div class="loader-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: rgba(0,0,0,0.1);">
              <span style="display: inline-block; width: 20px; height: 20px; border: 2px solid #4299e1; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></span>
            </div>
          </div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        `;
      }
    }
    
    // Add button with unique ID
    const buttonId = `add-to-itinerary-${attraction.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
    popupHtml += `
        <button id="${buttonId}" class="add-to-itinerary" style="width: 100%; background-color: #4299e1; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; margin-top: 5px; font-weight: 600;">Add to Day ${selectedDay + 1}</button>
      </div>
    `;
    
    // Create and add marker to map
    const marker = new mapboxgl.Marker({
      element: markerEl,
      draggable: false
    })
      .setLngLat([attraction.coordinates.lng, attraction.coordinates.lat])
      .setPopup(
        new mapboxgl.Popup({
          offset: 25,
          closeButton: true,
          closeOnClick: false,
          maxWidth: '300px'
        }).setHTML(popupHtml)
      )
      .addTo(map.current);
    
    // Store type with marker
    marker._customData = { 
      id: attraction.id,
      type: attraction.type,
      isNearby: true
    };
    
    // Add click handler to add button in popup with unique ID
    marker.getPopup().on('open', () => {
      setTimeout(() => {
        const button = document.getElementById(buttonId);
        if (button) {
          // Remove any existing event listeners
          const newButton = button.cloneNode(true);
          button.parentNode.replaceChild(newButton, button);
          
          // Add fresh event listener
          newButton.addEventListener('click', () => {
            addAttractionToItinerary(attraction);
            marker.togglePopup();
          });
        }
      }, 0);
    });
    
    console.log('Created marker with popup for:', {
      name: attraction.name,
      hasPhotos: attraction.photos && attraction.photos.length > 0,
      photosArray: attraction.photos
    });
    
    return marker;
  }, [selectedDay, map, addAttractionToItinerary]);
  
  // Function to get sample attractions as fallback
  const getSampleAttractions = useCallback((center) => {
    // Return a minimal set of attractions if all APIs fail
    // (Only called when both Google Places and OSM APIs fail)
    console.log('All place APIs failed - returning minimal sample attractions');
    
    // Just return one attraction to avoid empty UI
    return [{
      id: 'sample-fallback',
      name: 'Suggested Location',
      type: 'activity',
      coordinates: { lat: center.lat, lng: center.lng },
      rating: 4.0
    }];
  }, []);
  
  // Fallback to OpenStreetMap's Overpass API
  const fallbackToOSM = useCallback(async (center, radius = 1000, type = 'tourist_attraction') => {
    const cacheKey = `osm-${center.lat},${center.lng}-${radius}-${type}`;
    
    // Check cache first
    const cachedData = apiCache.get('osm', cacheKey);
    if (cachedData) {
      console.log('Using cached OSM data');
      return cachedData;
    }
    
    // Map Google place types to OSM amenity values
    const osmTypeMap = {
      'tourist_attraction': 'tourism=attraction',
      'restaurant': 'amenity=restaurant',
      'lodging': 'tourism=hotel',
      'bar': 'amenity=bar',
      'cafe': 'amenity=cafe',
      'shopping_mall': 'shop=mall'
    };
    
    const osmType = osmTypeMap[type] || 'tourism=attraction';
    const [osmKey, osmValue] = osmType.split('=');
    
    try {
      // Create an Overpass API query
      const radiusInKm = radius / 1000;
      const query = `
        [out:json];
        (
          node[${osmKey}=${osmValue}](around:${radius},${center.lat},${center.lng});
          way[${osmKey}=${osmValue}](around:${radius},${center.lat},${center.lng});
          relation[${osmKey}=${osmValue}](around:${radius},${center.lat},${center.lng});
        );
        out body;
        >;
        out skel qt;
      `;
      
      const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      // Process OSM data
      const places = response.data.elements
        .filter(el => el.type === 'node' && el.tags)
        .map(node => ({
          id: `osm-${node.id}`,
          name: node.tags.name || node.tags[osmValue] || 'Unnamed Place',
          type: determineLocationType(osmKey),
          coordinates: { lat: node.lat, lng: node.lon },
          rating: node.tags.stars ? parseFloat(node.tags.stars) : Math.random() * 2 + 3, // Random rating between 3-5
          osmTags: node.tags
        }));
      
      // Cache the results
      apiCache.set('osm', cacheKey, places);
      return places;
    } catch (error) {
      console.error('Error with OSM API:', error);
      
      // Return sample data if all else fails
      return getSampleAttractions(center);
    }
  }, [determineLocationType, getSampleAttractions]);

  // Get nearby places using the appropriate API based on availability
  const getNearbyPlaces = useCallback(async (center, radius = 1000, type = 'tourist_attraction') => {
    const cacheKey = `${center.lat},${center.lng}-${radius}-${type}`;
    
    // Check cache first
    const cachedData = apiCache.get('places', cacheKey);
    if (cachedData) {
      console.log('Using cached places data');
      return cachedData;
    }
    
    // If Google Places API is available, use it
    if (googlePlacesService) {
      console.log('Using Google Places API');
      try {
        return new Promise((resolve, reject) => {
          // Add a timeout in case the Google API hangs
          const timeoutId = setTimeout(() => {
            console.log('Google Places API timed out, falling back to OSM');
            reject(new Error('Google Places API timeout'));
          }, 5000);
          
          googlePlacesService.nearbySearch({
            location: { lat: center.lat, lng: center.lng },
            radius,
            type
          }, (results, status) => {
            clearTimeout(timeoutId);
            
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
              try {
                // Process and format the results
                const places = results.map(place => {
                  let photoUrls = [];
                  
                  // Safely extract photo URLs
                  if (place.photos && place.photos.length > 0) {
                    photoUrls = place.photos.map(photo => {
                      try {
                        // First try using the getUrl method from the API
                        if (typeof photo.getUrl === 'function') {
                          return photo.getUrl({ maxWidth: 400, maxHeight: 300 });
                        } 
                        // Fall back to photo_reference if available
                        else if (photo.photo_reference) {
                          return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${GOOGLE_MAPS_API_KEY}`;
                        }
                        return null;
                      } catch (err) {
                        console.error('Error getting photo URL:', err);
                        return null;
                      }
                    }).filter(url => url !== null);
                  }
                  
          return {
                    id: place.place_id,
                    name: place.name,
                    type: determineLocationType(place.types[0] || 'activity'),
                    coordinates: { 
                      lat: place.geometry.location.lat(), 
                      lng: place.geometry.location.lng() 
                    },
                    rating: place.rating,
                    photos: photoUrls,
                    vicinity: place.vicinity,
                    priceLevel: place.price_level
                  };
                });
                
                // Cache the results
                apiCache.set('places', cacheKey, places);
                resolve(places);
              } catch (err) {
                console.error('Error processing Google Places results:', err);
                fallbackToOSM(center, radius, type).then(resolve).catch(reject);
              }
            } else {
              // Fallback to OpenStreetMap if Google fails
              console.log('Google Places API failed with status:', status);
              fallbackToOSM(center, radius, type).then(resolve).catch(reject);
            }
          });
        });
      } catch (error) {
        console.error('Error with Google Places API:', error);
        return fallbackToOSM(center, radius, type);
      }
    } else {
      // Fallback to OpenStreetMap's Overpass API
      console.log('Google Places not available, using OSM');
      return fallbackToOSM(center, radius, type);
    }
  }, [googlePlacesService, determineLocationType, fallbackToOSM]);
  
  // Fix handleSuggestNearby to avoid infinite loops
  const handleSuggestNearby = useCallback(async () => {
    try {
      // Toggle the panel state without causing additional renders
      const newPanelState = !showSuggestionsPanel;
      setShowSuggestionsPanel(newPanelState);
      
      if (newPanelState) {
        // Get the current map center
        if (!map.current) {
          console.error('Map not initialized');
          return;
        }
        
        const center = map.current.getCenter();
        const currentCenter = {
          lat: center.lat,
          lng: center.lng
        };
        
        // Show loading indicator for nearby places
        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading-indicator';
        loadingEl.textContent = 'Finding nearby places...';
        loadingEl.style.position = 'absolute';
        loadingEl.style.top = '50%';
        loadingEl.style.left = '50%';
        loadingEl.style.transform = 'translate(-50%, -50%)';
        loadingEl.style.backgroundColor = 'rgba(0,0,0,0.7)';
        loadingEl.style.color = 'white';
        loadingEl.style.padding = '10px 15px';
        loadingEl.style.borderRadius = '4px';
        loadingEl.style.zIndex = '999';
        
        if (mapContainer.current) {
          mapContainer.current.appendChild(loadingEl);
        }
        
        try {
          // Clear existing nearby markers WITHOUT using removeNearbyMarkers
          // to avoid dependency loops
          const markersToRemove = [];
          mapMarkers.forEach(marker => {
            if (marker && marker._customData?.isNearby) {
              marker.remove();
              markersToRemove.push(marker);
            }
          });
          
          if (markersToRemove.length > 0) {
            // Update markers state by filtering out the removed ones
            setMapMarkers(prev => prev.filter(marker => !markersToRemove.includes(marker)));
          }
          
          // Get nearby places using our API service
          const nearbyPlaces = await getNearbyPlaces(currentCenter, 1500, 'tourist_attraction');
          console.log('Nearby places with photos:', nearbyPlaces.map(place => ({
            name: place.name,
            photos: place.photos
          })));
          
          // Update state with the new attractions
          setNearbyAttractions(nearbyPlaces);
          
          // Batch creating markers to avoid multiple state updates
          const newMarkers = [];
          
          // Create all markers first without state updates
          nearbyPlaces.forEach(attraction => {
            const marker = addNearbyMarkerToMap(attraction);
            if (marker) newMarkers.push(marker);
          });
          
          // Then update the state once with all markers
          if (newMarkers.length > 0) {
            setMapMarkers(prev => [...prev, ...newMarkers]);
          }
          
        } catch (error) {
          console.error('Error getting nearby places:', error);
          
          // Fallback to sample data
          const sampleAttractions = getSampleAttractions(currentCenter);
          setNearbyAttractions(sampleAttractions);
          
          // Create markers in batch
          const newMarkers = [];
          sampleAttractions.forEach(attraction => {
            const marker = addNearbyMarkerToMap(attraction);
            if (marker) newMarkers.push(marker);
          });
          
          // Update state once
          if (newMarkers.length > 0) {
            setMapMarkers(prev => [...prev, ...newMarkers]);
          }
          
        } finally {
          // Remove loading indicator
          if (loadingEl && loadingEl.parentNode) {
            loadingEl.parentNode.removeChild(loadingEl);
          }
        }
      } else {
        // DIRECTLY remove nearby markers without calling removeNearbyMarkers
        const markersToRemove = [];
        mapMarkers.forEach(marker => {
          if (marker && marker._customData?.isNearby) {
            marker.remove();
            markersToRemove.push(marker);
          }
        });
        
        if (markersToRemove.length > 0) {
          // Update markers state by filtering out the removed ones
          setMapMarkers(prev => prev.filter(marker => !markersToRemove.includes(marker)));
        }
      }
    } catch (err) {
      console.error('Unexpected error in handleSuggestNearby:', err);
      alert('Something went wrong while finding nearby places. Please try again.');
    }
  }, [
    showSuggestionsPanel, 
    map, 
    mapContainer, 
    getNearbyPlaces, 
    addNearbyMarkerToMap, 
    getSampleAttractions
    // removeNearbyMarkers - REMOVED THIS DEPENDENCY
  ]); // Removed mapMarkers dependency
  
  // Function to create a new custom marker on map click
  const addCustomMarker = useCallback((e) => {
    // Always hide search results when clicking on the map 
    setShowSearchResults(false);
    
    if (!map.current) return;
    
    if (e.originalEvent.shiftKey) {
      // Only add a new marker if Shift key is pressed during click
      const coordinates = e.lngLat;
      
      // Create a temporary marker with a form to name it
      const tempElement = document.createElement('div');
      tempElement.className = 'new-marker-form';
      tempElement.style.backgroundColor = 'white';
      tempElement.style.padding = '10px';
      tempElement.style.borderRadius = '4px';
      tempElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      tempElement.style.minWidth = '200px';
      
      tempElement.innerHTML = `
        <h3 class="text-sm font-bold mb-2">Add New Location</h3>
        <input id="new-marker-name" type="text" placeholder="Location name" class="p-1 border border-gray-300 rounded w-full mb-2">
        <select id="new-marker-type" class="p-1 border border-gray-300 rounded w-full mb-2">
          <option value="activity">Activity</option>
          <option value="restaurant">Restaurant</option>
          <option value="hotel">Hotel</option>
          <option value="transport">Transport</option>
        </select>
        <div class="flex justify-between">
          <button id="cancel-marker" class="px-2 py-1 bg-gray-200 rounded text-xs">Cancel</button>
          <button id="save-marker" class="px-2 py-1 bg-blue-500 text-white rounded text-xs">Add to Itinerary</button>
        </div>
      `;
      
      // Create a popup for our form
      const popup = new mapboxgl.Popup({
        offset: [0, 0],
        closeButton: false,
        closeOnClick: false
      })
        .setLngLat(coordinates)
        .setDOMContent(tempElement)
        .addTo(map.current);
      
      // Add event listeners to the form buttons
      setTimeout(() => {
        document.getElementById('cancel-marker')?.addEventListener('click', () => {
          popup.remove();
        });
        
        document.getElementById('save-marker')?.addEventListener('click', () => {
          const name = document.getElementById('new-marker-name')?.value || 'New Location';
          const type = document.getElementById('new-marker-type')?.value || 'activity';
          
          // Create a new custom attraction
          const newAttraction = {
            id: `custom-${Date.now()}`,
            name,
            type,
            coordinates: {
              lng: coordinates.lng,
              lat: coordinates.lat
            },
            rating: 5
          };
          
          // Add to itinerary
          addAttractionToItinerary(newAttraction);
          
          // Add as a regular marker
          const marker = addMarkerToMap({
            id: newAttraction.id,
            name: newAttraction.name,
            type: newAttraction.type,
            coordinates: newAttraction.coordinates,
            day: selectedDay,
            time: '12:00'
          });
          
          if (marker) {
            setMapMarkers(prev => [...prev, marker]);
          }
          
          // Close the popup
          popup.remove();
        });
      }, 0);
    }
  }, [map, selectedDay, addAttractionToItinerary, addMarkerToMap]);
  
  // Add click handler to map when it's loaded
  useEffect(() => {
    if (map.current && !isLoading) {
      // Add click listener for adding custom markers
      map.current.on('click', addCustomMarker);
      
      // Help message for adding markers
      const helpMsg = document.createElement('div');
      helpMsg.className = 'help-message';
      helpMsg.style.position = 'absolute';
      helpMsg.style.bottom = '20px';
      helpMsg.style.left = '20px';
      helpMsg.style.backgroundColor = 'rgba(0,0,0,0.7)';
      helpMsg.style.color = 'white';
      helpMsg.style.padding = '8px 12px';
      helpMsg.style.borderRadius = '4px';
      helpMsg.style.fontSize = '12px';
      helpMsg.textContent = 'Shift+Click on map to add a new location';
      
      // Add the help message to the map container
      if (mapContainer.current) {
        mapContainer.current.appendChild(helpMsg);
      }
      
      return () => {
        // Clean up event listener
        if (map.current) {
          map.current.off('click', addCustomMarker);
        }
        // Remove help message
        if (helpMsg.parentNode) {
          helpMsg.parentNode.removeChild(helpMsg);
        }
      };
    }
  }, [map.current, isLoading, addCustomMarker]);

  // Check DOM for container element with persistent polling
  useEffect(() => {
    // Keep track of total elapsed time
    let totalElapsedTime = 0;
    const maxWaitTime = 10000; // 10 seconds max wait time
    const pollInterval = 200; // Poll every 200ms
    let observer = null;
    
    // Don't try to initialize if map is already initialized
    if (map.current || mapInitialized) return;
    
    console.log('Starting persistent container polling');
    
    // Set up MutationObserver for dynamic changes
    observer = new MutationObserver((mutations) => {
      const container = document.getElementById('mapbox-container');
      if (container && !map.current && !mapInitialized) {
        console.log('MutationObserver found container:', container);
        mapContainer.current = container;
        setContainerReady(true);
        initializeMapDirectly(container);
        observer.disconnect();
      }
    });
    
    // Start observing the document body
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // Define a polling function to keep checking for the container
    const pollForContainer = () => {
      if (map.current || mapInitialized) {
        console.log('Map already initialized, stopping polling');
        return;
      }
      
      if (totalElapsedTime >= maxWaitTime) {
        console.log('Reached maximum wait time for container, giving up');
        setIsLoading(false);
        return;
      }
      
      // Try finding the container in various ways
      const container = 
        mapContainer.current || 
        document.getElementById('mapbox-container') || 
        document.querySelector('[data-testid="map-container"]');
      
      if (container) {
        console.log('Found container through polling after', totalElapsedTime, 'ms:', container);
        mapContainer.current = container;
        setContainerReady(true);
        initializeMapDirectly(container);
        return; // Stop polling if we found the container
      }
      
      // If the container isn't found, let's add even more logging
      console.log('Container polling attempt at', totalElapsedTime, 'ms - container not found');
      console.log('Container ref status:', !!mapContainer.current);
      
      // Check all elements with IDs
      console.log('All elements with IDs:', 
        Array.from(document.querySelectorAll('[id]'))
          .map(el => ({ id: el.id, tagName: el.tagName }))
      );
      
      // Wait and try again
      totalElapsedTime += pollInterval;
      setTimeout(pollForContainer, pollInterval);
    };
    
    // Start polling
    pollForContainer();
    
    return () => {
      if (observer) observer.disconnect();
    };
  }, [mapInitialized, initializeMapDirectly]);

  // Create a fixed position container outside React's control
  useEffect(() => {
    // Only create if we're using the fixed container approach
    if (!useFixedContainer) return;
    
    console.log('Setting up fixed map container');
    
    // Check if container already exists
    let fixedContainer = document.getElementById(fixedContainerId);
    
    if (!fixedContainer) {
      // Create container if it doesn't exist
      fixedContainer = document.createElement('div');
      fixedContainer.id = fixedContainerId;
      fixedContainer.style.position = 'absolute';
      fixedContainer.style.top = '150px'; // Below the header
      fixedContainer.style.left = '280px'; // Avoid the sidebar
      fixedContainer.style.right = '20px';
      fixedContainer.style.bottom = '50px'; // Space for controls at bottom
      fixedContainer.style.backgroundColor = '#e9eef2';
      fixedContainer.style.zIndex = '10';
      fixedContainer.style.borderRadius = '8px';
      fixedContainer.style.border = '1px solid #ccc';
      fixedContainer.style.overflow = 'hidden';
      
      // Add data attribute for debugging
      fixedContainer.setAttribute('data-testid', 'fixed-map-container');
      
      // Add to body
      document.body.appendChild(fixedContainer);
      
      console.log('Created fixed container:', fixedContainer);
    }
    
    // Update ref
    mapContainer.current = fixedContainer;
    setContainerReady(true);
    
    // Initialize map when container is ready
    setTimeout(() => {
      if (!map.current && !mapInitialized) {
        console.log('Initializing map in fixed container');
        initializeMapDirectly(fixedContainer);
      }
    }, 500);
    
    // Cleanup function
    return () => {
      if (useFixedContainer) {
        // Remove fixed container on unmount
        const container = document.getElementById(fixedContainerId);
        if (container) {
          try {
            // First remove map if it exists
            if (map.current) {
              map.current.remove();
              map.current = null;
            }
            
            // Then remove the container
            document.body.removeChild(container);
            console.log('Removed fixed map container');
          } catch (e) {
            console.error('Error removing fixed container:', e);
          }
        }
      }
    };
  }, [useFixedContainer]);

  // Helper function to format duration (seconds to readable string)
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    let str = '';
    if (hours > 0) str += `${hours}h `;
    if (minutes > 0) str += `${minutes}m`;
    if (str === '') str = '< 1m'; // For very short durations
    return str.trim();
  };

  const clearRoutingVisuals = useCallback(() => {
    // Remove routing point markers
    routingPointMarkers.forEach(marker => marker.remove());
    setRoutingPointMarkers([]);

    // Clear multi-stop route from map
    if (map.current && map.current.getSource('multiStopRoute')) {
      map.current.getSource('multiStopRoute').setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  }, [map, routingPointMarkers]);

  const toggleRoutingMode = useCallback(() => {
    setIsRoutingMode(prev => {
      const newMode = !prev;
      if (!newMode) { // Exiting routing mode
        // Optionally clear points or keep them for calculation
        // For now, let's keep them if some are selected, user can explicitly clear
      }
      return newMode;
    });
  }, []);

  const clearRoutingData = useCallback(() => {
    setRoutingPoints([]);
    setMultiStopRouteDetails(null);
    clearRoutingVisuals();
  }, [clearRoutingVisuals]);

  // Add a function to get directions from Google API
  const getGoogleDirections = useCallback(async (points, mode) => {
    if (points.length < 2) return null;
    
    try {
      // For Google API, we need to handle waypoints differently
      const origin = points[0];
      const destination = points[points.length - 1];
      const waypoints = points.slice(1, points.length - 1).map(point => 
        `${point.lat},${point.lng}`
      ).join('|');
      
      // Convert our mode names to Google's mode names
      let googleMode = 'driving';
      let transitMode = ''; // Properly declare the transit mode variable
      
      if (mode === 'walking') googleMode = 'walking';
      if (mode === 'cycling') googleMode = 'bicycling';
      if (mode === 'transit') googleMode = 'transit';
      if (mode === 'metro') {
        googleMode = 'transit';
        // Add transit mode parameter for metro/train only
        transitMode = 'subway|train';
      }
      
      // Build URL
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=${googleMode}&key=${GOOGLE_MAPS_API_KEY}`;
      
      // Add waypoints if any
      if (waypoints) {
        url += `&waypoints=${waypoints}`;
      }
      
      // Add transit mode if applicable
      if (mode === 'metro') {
        url += `&transit_mode=${transitMode}`;
      }
      
      console.log(`Requesting Google Directions with mode: ${googleMode}`);
      
      // Typically, you'd need a server endpoint to make this request
      // due to CORS restrictions. For now, we'll log what would be requested
      console.log(`Google Directions API would be called with URL: ${url}`);
      
      // In a real implementation, you'd call a server endpoint like:
      const response = await axios.get(`/api/google-directions?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=${googleMode}${waypoints ? `&waypoints=${waypoints}` : ''}${mode === 'metro' ? `&transit_mode=${transitMode}` : ''}`);
      
      if (response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        
        // Convert Google Directions format to our format
        const path = route.overview_polyline ? 
          google.maps.geometry.encoding.decodePath(route.overview_polyline.points).map(point => [point.lng(), point.lat()]) : 
          [];
          
          return {
          path: path,
          distance: route.legs.reduce((acc, leg) => acc + leg.distance.value, 0),
          duration: route.legs.reduce((acc, leg) => acc + leg.duration.value, 0)
        };
      }
    } catch (error) {
      console.error('Error getting Google directions:', error);
    }
    
    return null;
  }, [GOOGLE_MAPS_API_KEY]); // Remove transitMode from dependencies as it's defined inside the function

  const calculateAndDrawMultiStopRoute = useCallback(async () => {
    if (!map.current || routingPoints.length < 2) return;
    
    try {
      // Show loading indicator
      const loadingEl = document.createElement('div');
      loadingEl.className = 'loading-indicator';
      loadingEl.textContent = 'Calculating route...';
      loadingEl.style.position = 'absolute';
      loadingEl.style.top = '50%';
      loadingEl.style.left = '50%';
      loadingEl.style.transform = 'translate(-50%, -50%)';
      loadingEl.style.backgroundColor = 'rgba(0,0,0,0.7)';
      loadingEl.style.color = 'white';
      loadingEl.style.padding = '10px 15px';
      loadingEl.style.borderRadius = '4px';
      loadingEl.style.zIndex = '999';
      
      if (mapContainer.current) {
        mapContainer.current.appendChild(loadingEl);
      }
      
      let route = null;
      
      // Use Google Directions API for metro mode
      if (transportMode === 'metro') {
        console.log('Using Google Directions API for metro/train routing');
        route = await getGoogleDirections(routingPoints, transportMode);
        
        // If Google API fails, fall back to Mapbox
        if (!route) {
          console.log('Google Directions failed, falling back to Mapbox');
          // Fall back to Mapbox but still use the metro style
        }
      }
      
      // If we don't have a route yet (either not metro mode or Google API failed), use Mapbox
      if (!route) {
        // Prepare coordinates string for the API
        const coordinatesString = routingPoints
          .map(point => `${point.lng},${point.lat}`)
          .join(';');
        
        // Get the proper transportation profile for Mapbox API
        // Mapbox supports: driving, walking, cycling
        // For transit and metro, we fall back to driving but style differently
        let mapboxProfile = transportMode;
        if (transportMode === 'transit' || transportMode === 'metro') {
          mapboxProfile = 'driving';
          console.log(`Note: ${transportMode} mode falls back to driving directions as Mapbox does not support public transit routing directly`);
        }
        
        // Call Mapbox Directions API with the selected transportation mode
        const url = `https://api.mapbox.com/directions/v5/mapbox/${mapboxProfile}/${coordinatesString}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;
        
        const response = await axios.get(url);
        
        if (response.data.routes && response.data.routes.length > 0) {
          const mapboxRoute = response.data.routes[0];
          
          route = {
            path: mapboxRoute.geometry.coordinates,
            distance: mapboxRoute.distance,
            duration: mapboxRoute.duration
          };
        }
      }
      
      // Remove loading indicator
      if (loadingEl && loadingEl.parentNode) {
        loadingEl.parentNode.removeChild(loadingEl);
      }
      
      if (route) {
        // Store route details
        setMultiStopRouteDetails({
          path: route.path,
          distance: route.distance, // in meters
          duration: route.duration, // in seconds
          mode: transportMode // Store the transport mode used
        });
        
        // Get route color based on transport mode
        const routeColor = transportColors[transportMode] || '#3887be';
        
        // Prepare to draw route on map
        // First, check if source already exists
        if (!map.current.getSource('multiStopRoute')) {
          // Add source and layer if they don't exist
          map.current.addSource('multiStopRoute', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: route.path
              }
            }
          });
          
          map.current.addLayer({
            id: 'multiStopRoute',
            type: 'line',
            source: 'multiStopRoute',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': routeColor,
              'line-width': 5,
              'line-opacity': 0.75
            }
          });
        } else {
          // Update existing source
          map.current.getSource('multiStopRoute').setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: route.path
            }
          });
          
          // Update the route color based on transport mode
          map.current.setPaintProperty('multiStopRoute', 'line-color', routeColor);
        }
        
        // Fit map to the route
        const bounds = new mapboxgl.LngLatBounds();
        route.path.forEach(coord => {
          bounds.extend(coord);
        });
        
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15
        });
        
        // Exit routing mode but keep the points and route
        setIsRoutingMode(false);
        
      } else {
        // Handle no routes found
        alert('No route found between the selected points. Please try different locations.');
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      alert('Error calculating route. Please try again.');
      
      // Remove loading indicator if it exists
      const loadingEl = document.querySelector('.loading-indicator');
      if (loadingEl && loadingEl.parentNode) {
        loadingEl.parentNode.removeChild(loadingEl);
      }
    }
  }, [map, mapContainer, routingPoints, MAPBOX_TOKEN, transportMode, getGoogleDirections]);

  const handleMapClickForRouting = useCallback((e) => {
    if (!map.current || !isRoutingMode) return;

    // Hide search results when adding routing points
    setShowSearchResults(false);
    
    const coords = e.lngLat;
    setRoutingPoints(prev => [...prev, { lng: coords.lng, lat: coords.lat }]);

    // Add a simple visual marker for the routing point
    const markerEl = document.createElement('div');
    markerEl.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    markerEl.style.border = '2px solid rgba(255, 255, 255, 0.8)';
    markerEl.style.width = '12px';
    markerEl.style.height = '12px';
    markerEl.style.borderRadius = '50%';
    markerEl.style.cursor = 'pointer';
    markerEl.title = `Routing Point ${routingPoints.length + 1}`;

    const pointMarker = new mapboxgl.Marker(markerEl)
      .setLngLat(coords)
      .addTo(map.current);
    
    setRoutingPointMarkers(prev => [...prev, pointMarker]);
  }, [map, isRoutingMode, routingPoints.length]);

  // Add click handler to map when it's loaded
  useEffect(() => {
    if (map.current && !isLoading && mapInitialized) { // ensure mapInitialized
      const handleClick = (e) => {
        if (isRoutingMode) {
          handleMapClickForRouting(e);
        } else if (e.originalEvent.shiftKey) {
          addCustomMarker(e);
        }
      };

      map.current.on('click', handleClick);
      
      // Help message for adding markers (adjust if routing mode is active)
      const helpMsgElement = mapContainer.current?.querySelector('.help-message');
      if (helpMsgElement) {
        helpMsgElement.textContent = isRoutingMode 
          ? `Click to add route point (${routingPoints.length} selected). ${routingPoints.length >=2 ? 'Ready to calculate.' : ''}` 
          : 'Shift+Click on map to add a new location to itinerary.';
      }

      return () => {
        if (map.current && map.current.off) { // Check if map.current.off exists
          map.current.off('click', handleClick);
        }
      };
    }
  }, [map.current, isLoading, mapInitialized, addCustomMarker, isRoutingMode, handleMapClickForRouting, routingPoints.length]);

  // Update help message when routingPoints.length changes while in routing mode
  useEffect(() => {
    if (isRoutingMode && mapContainer.current) {
      const helpMsgElement = mapContainer.current.querySelector('.help-message');
      if (helpMsgElement) {
        helpMsgElement.textContent = `Click to add route point (${routingPoints.length} selected). ${routingPoints.length >=2 ? 'Ready to calculate.' : ''}`;
      }
    }
  }, [isRoutingMode, routingPoints.length, mapContainer.current]);

  // Check DOM for container element with persistent polling
  useEffect(() => {
    // Keep track of total elapsed time
    let totalElapsedTime = 0;
    const maxWaitTime = 10000; // 10 seconds max wait time
    const pollInterval = 200; // Poll every 200ms
    let observer = null;
    
    // Don't try to initialize if map is already initialized
    if (map.current || mapInitialized) return;
    
    console.log('Starting persistent container polling');
    
    // Set up MutationObserver for dynamic changes
    observer = new MutationObserver((mutations) => {
      const container = document.getElementById('mapbox-container');
      if (container && !map.current && !mapInitialized) {
        console.log('MutationObserver found container:', container);
        mapContainer.current = container;
        setContainerReady(true);
        initializeMapDirectly(container);
        observer.disconnect();
      }
    });
    
    // Start observing the document body
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // Define a polling function to keep checking for the container
    const pollForContainer = () => {
      if (map.current || mapInitialized) {
        console.log('Map already initialized, stopping polling');
        return;
      }
      
      if (totalElapsedTime >= maxWaitTime) {
        console.log('Reached maximum wait time for container, giving up');
        setIsLoading(false);
        return;
      }
      
      // Try finding the container in various ways
      const container = 
        mapContainer.current || 
        document.getElementById('mapbox-container') || 
        document.querySelector('[data-testid="map-container"]');
      
      if (container) {
        console.log('Found container through polling after', totalElapsedTime, 'ms:', container);
        mapContainer.current = container;
        setContainerReady(true);
        initializeMapDirectly(container);
        return; // Stop polling if we found the container
      }
      
      // If the container isn't found, let's add even more logging
      console.log('Container polling attempt at', totalElapsedTime, 'ms - container not found');
      console.log('Container ref status:', !!mapContainer.current);
      
      // Check all elements with IDs
      console.log('All elements with IDs:', 
        Array.from(document.querySelectorAll('[id]'))
          .map(el => ({ id: el.id, tagName: el.tagName }))
      );
      
      // Wait and try again
      totalElapsedTime += pollInterval;
      setTimeout(pollForContainer, pollInterval);
    };
    
    // Start polling
    pollForContainer();
    
    return () => {
      if (observer) observer.disconnect();
    };
  }, [mapInitialized, initializeMapDirectly]);

  // Add function to search for places by name
  const searchPlacesByName = useCallback(async (query) => {
    if (!query.trim()) return [];
    
    setIsSearching(true);
    
    try {
      // Try using Google Places API first if available
      if (googlePlacesService && googleMapsLoaded) {
        return new Promise((resolve, reject) => {
          // Create location object using trip coordinates
          const location = {
            lat: Number(tripDetails?.latitude) || 
                 Number(tripDetails?.coordinates?.lat) || 
                 defaultCoords.lat,
            lng: Number(tripDetails?.longitude) || 
                 Number(tripDetails?.coordinates?.lng) || 
                 defaultCoords.lng
          };
          
          console.log('Searching near coordinates:', location);
          
          const request = {
            query: query,
            fields: ['name', 'geometry', 'formatted_address', 'place_id', 'types', 'photos', 'rating'],
            // Add location and radius to prioritize results near the trip location
            location: location,
            radius: 50000 // 50km radius
          };
          
          googlePlacesService.textSearch(request, (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              // Process and format the results
              const places = results.map(place => {
                let photoUrls = [];
                
                // Safely extract photo URLs
                if (place.photos && place.photos.length > 0) {
                  photoUrls = place.photos.map(photo => {
                    try {
                      // First try using the getUrl method from the API
                      if (typeof photo.getUrl === 'function') {
                        return photo.getUrl({ maxWidth: 400, maxHeight: 300 });
                      } 
                      // Fall back to photo_reference if available
                      else if (photo.photo_reference) {
                        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${GOOGLE_MAPS_API_KEY}`;
                      }
                      return null;
                    } catch (err) {
                      console.error('Error getting photo URL:', err);
                      return null;
                    }
                  }).filter(url => url !== null);
                }
                
                return {
                  id: place.place_id,
                  name: place.name,
                  type: determineLocationType(place.types ? place.types[0] : 'activity'),
                  coordinates: { 
                    lat: place.geometry.location.lat(), 
                    lng: place.geometry.location.lng() 
                  },
                  rating: place.rating,
                  photos: photoUrls,
                  vicinity: place.formatted_address || place.vicinity,
                  priceLevel: place.price_level
                };
              });
              
              setIsSearching(false);
              resolve(places);
            } else {
              console.log('Google Places search failed with status:', status);
              reject(new Error(`Google Places search failed: ${status}`));
            }
          });
        });
      } else {
        // Fallback to OSM Nominatim API with trip coordinates
        const tripLat = Number(tripDetails?.latitude) || 
                       Number(tripDetails?.coordinates?.lat) || 
                       defaultCoords.lat;
        const tripLng = Number(tripDetails?.longitude) || 
                       Number(tripDetails?.coordinates?.lng) || 
                       defaultCoords.lng;
                       
        // Add viewbox parameter to bias results to the trip area
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=en&addressdetails=1&limit=10&viewbox=${tripLng-0.5},${tripLat-0.5},${tripLng+0.5},${tripLat+0.5}&bounded=1`
        );
        
        if (response.data && response.data.length > 0) {
          const places = response.data.map(place => ({
            id: `osm-${place.place_id}`,
            name: place.display_name.split(',')[0],
            type: determineLocationType(place.category || place.type || 'activity'),
            coordinates: { 
              lat: parseFloat(place.lat), 
              lng: parseFloat(place.lon) 
            },
            rating: 0, // OSM doesn't provide ratings
            vicinity: place.display_name,
          }));
          
          setIsSearching(false);
          return places;
        }
      }
    } catch (error) {
      console.error('Error searching for places:', error);
    }
    
    setIsSearching(false);
    return [];
  }, [googlePlacesService, googleMapsLoaded, determineLocationType, GOOGLE_MAPS_API_KEY, tripDetails, defaultCoords]);

  // Handle search submission
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    try {
      const results = await searchPlacesByName(searchQuery);
      setSearchResults(results);
      setShowSearchResults(true);
      
      // If we have results and a map, let's add markers for them
      if (results.length > 0 && map.current) {
        // Clear any existing search result markers
        const markersToRemove = [];
        mapMarkers.forEach(marker => {
          if (marker && marker._customData?.isSearchResult) {
            marker.remove();
            markersToRemove.push(marker);
          }
        });
        
        if (markersToRemove.length > 0) {
          setMapMarkers(prev => prev.filter(marker => !markersToRemove.includes(marker)));
        }
        
        // Batch creating markers to avoid multiple state updates
        const newMarkers = [];
        
        // Add markers for each search result
        results.forEach(place => {
          // Create marker element with a different style for search results
          const markerEl = document.createElement('div');
          markerEl.className = 'search-result-marker';
          markerEl.style.backgroundColor = 'white';
          markerEl.style.border = '2px solid #3b82f6';
          markerEl.style.width = '25px';
          markerEl.style.height = '25px';
          markerEl.style.borderRadius = '50%';
          markerEl.style.display = 'flex';
          markerEl.style.justifyContent = 'center';
          markerEl.style.alignItems = 'center';
          markerEl.style.color = '#3b82f6';
          markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
          markerEl.style.cursor = 'pointer';
          markerEl.style.fontSize = '12px';
          markerEl.style.fontWeight = 'bold';
          markerEl.innerHTML = `<span>?</span>`;
          markerEl.title = place.name;
          
          // Add popup content for the marker
    let popupHtml = `
            <div class="place-popup" style="min-width: 200px; max-width: 300px;">
              <strong style="display: block; margin-bottom: 5px; font-size: 16px; color: #1a202c;">${place.name}</strong>
              ${place.rating ? `
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
                  <span style="color: #f8b400;">${"★".repeat(Math.round(place.rating || 0))}</span>
                  <span style="color: #ccc;">${"★".repeat(5 - Math.round(place.rating || 0))}</span>
                  <span style="margin-left: 5px; color: #4a5568; font-size: 14px;">${place.rating}</span>
        </div>
              ` : ''}
    `;
    
    // Add address if available
          if (place.vicinity) {
            popupHtml += `<div style="margin-bottom: 5px; font-size: 14px; color: #2d3748;">${place.vicinity}</div>`;
          }
          
          // Add a photo if available
          if (place.photos && place.photos.length > 0) {
            const photoUrl = place.photos[0];
            if (photoUrl) {
              popupHtml += `
                <div style="width: 100%; height: 120px; margin-bottom: 5px; position: relative; overflow: hidden; border-radius: 4px; background-color: #f0f0f0;">
                  <img 
                    src="${photoUrl}" 
                    style="width: 100%; height: 100%; object-fit: cover;" 
                    onload="this.style.opacity='1'; this.parentNode.querySelector('.loader-overlay').style.display='none';" 
                    onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\\'padding: 10px; text-align: center; color: #4a5568;\\'>Image unavailable</div>';" 
                    loading="lazy"
                  />
                  <div class="loader-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: rgba(0,0,0,0.1);">
                    <span style="display: inline-block; width: 20px; height: 20px; border: 2px solid #4299e1; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></span>
                  </div>
                </div>
              `;
            }
          }
          
          // Add button to add to calendar with unique ID
          const calendarButtonId = `add-to-calendar-${place.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
          popupHtml += `
              <button id="${calendarButtonId}" class="add-to-calendar-btn" data-place-id="${place.id}" style="width: 100%; background-color: #4299e1; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; margin-top: 5px; font-weight: 600;">Add to Day ${selectedDay + 1}</button>
            </div>
          `;
          
          // Create and add marker to map
          const marker = new mapboxgl.Marker({
            element: markerEl,
            draggable: false
          })
            .setLngLat([place.coordinates.lng, place.coordinates.lat])
            .setPopup(
              new mapboxgl.Popup({
                offset: 25,
                closeButton: true,
                closeOnClick: false,
                maxWidth: '300px'
              }).setHTML(popupHtml)
            )
            .addTo(map.current);
          
          // Store type with marker
          marker._customData = { 
            id: place.id,
            type: place.type,
            isSearchResult: true
          };
          
          // Add click handler to add button in popup using the unique ID
          marker.getPopup().on('open', () => {
            setTimeout(() => {
              const addButton = document.getElementById(calendarButtonId);
              if (addButton) {
                // Remove any existing event listeners
                const newButton = addButton.cloneNode(true);
                addButton.parentNode.replaceChild(newButton, addButton);
                
                // Add fresh event listener
                newButton.addEventListener('click', () => {
                  setSelectedSearchResult(place);
                  marker.togglePopup();
                });
              }
            }, 0);
          });
          
          newMarkers.push(marker);
        });
        
        // Then update the state once with all markers
        if (newMarkers.length > 0) {
          setMapMarkers(prev => [...prev, ...newMarkers]);
        }
        
        // Fly to first result to show it on map
        if (results.length > 0) {
          map.current.flyTo({
            center: [results[0].coordinates.lng, results[0].coordinates.lat],
            zoom: 14,
            essential: true
          });
        }
      }
    } catch (error) {
      console.error('Error performing search:', error);
      setSearchResults([]);
    }
  }, [searchQuery, searchPlacesByName, map, mapMarkers, selectedDay]);
  
  // Handle adding a search result to the calendar
  const handleAddSearchResultToCalendar = useCallback((place) => {
    if (!place) return;
    
    // Open the modal with initial details from the place
    setEventDetails({
      name: place.name,
      startTime: searchTime,
      duration: searchDuration,
      location: place.vicinity || '',
      coordinates: {
        latitude: place.coordinates.lat,
        longitude: place.coordinates.lng
      },
      day: selectedDay,
      type: place.type || 'activity'
    });
    
    // Hide search results when opening modal
    setShowSearchResults(false);
    
    // Open the modal
    setIsEventModalOpen(true);
  }, [selectedDay, searchTime, searchDuration]);
  
  // Add a function to handle the event form submission
  const handleAddEventSubmit = useCallback(() => {
    try {
      // Generate a unique ID for the event
      const newEventId = `event-${Math.random().toString(36).substring(2, 9)}`;
      
      // Calculate end time based on duration
      const [hours, minutes] = eventDetails.startTime.split(':').map(Number);
      const durationHours = Math.floor(eventDetails.duration / 60);
      const durationMinutes = eventDetails.duration % 60;
      
      let endHours = hours + durationHours;
      let endMinutes = minutes + durationMinutes;
      
      if (endMinutes >= 60) {
        endHours += 1;
        endMinutes -= 60;
      }
      
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
      
      // Format event for the calendar component
      const calendarEvent = {
        id: newEventId,
        activity: eventDetails.name,
        time: eventDetails.startTime,
        endTime: endTime,
        location: eventDetails.location,
        coordinates: {
          latitude: eventDetails.coordinates?.latitude,
          longitude: eventDetails.coordinates?.longitude
        },
        day_index: eventDetails.day,
        type: eventDetails.type,
        createdBy: {
          id: currentUser?.id,
          name: currentUser?.name,
          avatar: currentUser?.avatar
        },
        createdAt: new Date().toISOString()
      };
      
      // Always save to Supabase, regardless of callback
      // Format the event data for database upload
      const newEvent = {
        id: newEventId,
        trip_id: tripDetails.id,
        day_index: eventDetails.day,
        activity: eventDetails.name,
        time: eventDetails.startTime,
        end_time: endTime,
        // Keep separate lat/lng fields for compatibility
        latitude: eventDetails.coordinates?.latitude,
        longitude: eventDetails.coordinates?.longitude,
        created_by_user_id: currentUser?.id,
        created_by_name: currentUser?.name || 'User',
        created_by_avatar: currentUser?.avatar || '',
        created_at: new Date().toISOString()
      };
      
      // Save directly to Supabase database
      supabase
        .from('trip_events')
        .insert(newEvent)
        .then(({ data, error }) => {
          if (error) {
            console.error('Error adding event to database:', error);
            alert('Failed to add event to calendar. Please try again.');
          } else {
            console.log('Successfully added event to Supabase:', newEvent);
            
            // AFTER successful database save, also call the callback if available
            if (onAddEvent && typeof onAddEvent === 'function') {
              onAddEvent(calendarEvent);
              console.log('Also notified calendar component via callback:', calendarEvent);
            }
            
            alert(`Successfully added "${eventDetails.name}" to Day ${eventDetails.day + 1}!`);
            
            // Close the modal
            setIsEventModalOpen(false);
            
            // Reset form
            setEventDetails({
              name: '',
              startTime: '12:00',
              duration: 60,
              location: '',
              coordinates: null,
              day: selectedDay,
              type: 'activity'
            });
          }
        });
        
    } catch (error) {
      console.error('Error adding event to calendar:', error);
      alert('Failed to add event to database. Please try again.');
    }
  }, [eventDetails, tripDetails.id, currentUser, onAddEvent, selectedDay]);

  // Effect to add the selected search result to calendar
  useEffect(() => {
    if (selectedSearchResult) {
      handleAddSearchResultToCalendar(selectedSearchResult);
    }
  }, [selectedSearchResult, handleAddSearchResultToCalendar]);

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-auto">
      <style>
        {`
          ${mapStyles}
          
          /* Additional styles for the map placeholder when using fixed container */
          .map-placeholder {
            flex: 1;
            min-height: 500px;
            max-height: 75vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #f3f4f6;
            border-radius: 0.5rem;
            border: 1px dashed #d1d5db;
          }
          
          /* Styles for embedded map container */
          .map-container-wrapper {
            flex: 1;
            min-height: 500px;
            max-height: 75vh;
            position: relative;
            min-width: 500px;
            background-color: #e9eef2;
            border-radius: 0.5rem;
            overflow: hidden;
            border: 1px solid #d1d5db;
          }
          
          .map-container {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            min-height: 500px;
            min-width: 500px;
            background-color: #e9eef2;
          }
          
          /* Fix for scrolling issues - make everything one scrollable page */
          html, body, #__next, main {
            height: 100%;
            overflow-y: auto !important;
          }
          
          /* Single scrollable container for entire view */
          .maps-view-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow-y: auto;
            position: relative;
            flex: 1;
          }
          
          /* Disable nested scrolling containers */
          .controls-wrapper {
            overflow-y: visible;
            padding-right: 5px;
            -webkit-overflow-scrolling: touch;
          }
          
          /* Improved text styling for better visibility */
          .font-semibold {
            font-weight: 600;
            color: #1a202c;
          }
          
          label {
            color: #2d3748;
          }
          
          .text-gray-800 {
            color: #1a202c;
          }
          
          .text-gray-600 {
            color: #4a5568;
          }
          
          .text-gray-500 {
            color: #718096;
          }
          
          .text-blue-100 {
            color: #ebf8ff;
          }
          
          /* Improved search input styles */
          .search-input {
            color: #000000;
            font-weight: 500;
            font-size: 1rem;
          }
          
          .search-input::placeholder {
            color: #6b7280;
            opacity: 0.8;
          }
          
          .help-message {
            color: #f7fafc !important;
            font-weight: 500 !important;
            text-shadow: 0px 1px 2px rgba(0,0,0,0.3) !important;
          }
          
          /* Improved search results styling */
          .search-container {
            position: relative;
            z-index: 1000;
          }
          
          .search-results {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            z-index: 1000;
            background-color: white;
            border-radius: 0 0 8px 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-height: 400px;
            overflow-y: auto;
            margin-top: 2px;
            border: 1px solid #e2e8f0;
          }
          
          .search-result-item {
            padding: 10px 15px;
            border-bottom: 1px solid #e2e8f0;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          
          .search-result-item:hover {
            background-color: #f7fafc;
          }
          
          .search-result-item:last-child {
            border-bottom: none;
          }
          
          .search-form {
            position: relative;
            z-index: 1001;
          }
          
          /* Search result modal */
          .search-result-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          
          .search-result-modal-content {
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
          }
          
          /* Add button styling */
          .add-to-calendar-button {
            background-color: #4299e1;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          
          .add-to-calendar-button:hover {
            background-color: #3182ce;
          }
        `}
      </style>
      
      <div className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto py-4 px-6">
          <h1 className="text-2xl font-bold">Trip Maps</h1>
          <p className="text-blue-100 mt-1">{tripDetails?.city || 'Your Trip Destination'}</p>
        </div>
      </div>
      
      {/* Add search form with container - hide when event modal is open */}
      {!isEventModalOpen && (
        <div className="bg-white border-b border-gray-200 py-3 px-4 shadow-sm search-container">
          <form onSubmit={handleSearch} className="search-form flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for hotels, restaurants, attractions..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 search-input"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
          
          {/* Search results */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="search-results">
              <div className="p-2 bg-blue-50 border-b border-blue-200 flex justify-between items-center">
                <span className="text-sm font-medium text-blue-700">
                  {searchResults.length} results found
                </span>
                <button 
                  onClick={() => setShowSearchResults(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {searchResults.map(result => (
                  <div 
                    key={result.id} 
                    className="search-result-item hover:bg-gray-50 p-3"
                    onClick={() => {
                      // Navigate to this point on the map
                      if (map.current) {
                        map.current.flyTo({
                          center: [result.coordinates.lng, result.coordinates.lat],
                          zoom: 16,
                          essential: true
                        });
                        
                        // Find marker for this result and open its popup
                        const marker = mapMarkers.find(m => m._customData?.id === result.id);
                        if (marker && marker.togglePopup) {
                          setTimeout(() => marker.togglePopup(), 500);
                        }
                      }
                      
                      // Close search results
                      setShowSearchResults(false);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">{result.name}</h3>
                        {result.vicinity && (
                          <p className="text-sm text-gray-600 mt-1">{result.vicinity}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          result.type === 'hotel' ? 'bg-blue-100 text-blue-800' :
                          result.type === 'restaurant' ? 'bg-orange-100 text-orange-800' :
                          result.type === 'activity' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {result.type}
                        </span>
                        
                        {result.rating > 0 && (
                          <div className="flex items-center mt-1">
                            <span className="text-yellow-500 mr-1">★</span>
                            <span className="text-sm text-gray-600">{result.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Add to calendar button */}
                    <div className="mt-3 flex justify-end">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering the parent onClick
                          handleAddSearchResultToCalendar(result);
                        }}
                        className="add-to-calendar-button"
                      >
                        Add to Calendar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="flex-1 p-4 flex flex-col maps-view-container">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-800" style={{fontWeight: 500}}>Loading map...</p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            {/* Map Controls */}
            <div className="w-full md:w-64">
              <div className="space-y-4">
                {/* Day selector */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-2">Select Day</h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: tripDetails?.numberOfDays || 3 }).map((_, index) => (
                      <button
                        key={index}
                        className={`py-1 px-3 rounded-full text-sm ${
                          selectedDay === index 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                        onClick={() => handleDayChange(index)}
                      >
                        Day {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Layer toggles */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-2">Map Layers</h3>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={activeLayers.hotels} 
                        onChange={() => toggleLayer('hotels')}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Hotels</span>
                      <span className="ml-auto w-3 h-3 rounded-full" style={{ backgroundColor: markerTypes.hotel.color }}></span>
                    </label>
                    
                    <label className="flex items-center space-x-2 cursor-pointer text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={activeLayers.restaurants} 
                        onChange={() => toggleLayer('restaurants')}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Restaurants</span>
                      <span className="ml-auto w-3 h-3 rounded-full" style={{ backgroundColor: markerTypes.restaurant.color }}></span>
                    </label>
                    
                    <label className="flex items-center space-x-2 cursor-pointer text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={activeLayers.activities} 
                        onChange={() => toggleLayer('activities')}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Activities</span>
                      <span className="ml-auto w-3 h-3 rounded-full" style={{ backgroundColor: markerTypes.activity.color }}></span>
                    </label>
                    
                    <label className="flex items-center space-x-2 cursor-pointer text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={activeLayers.transport} 
                        onChange={() => toggleLayer('transport')}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Transport</span>
                      <span className="ml-auto w-3 h-3 rounded-full" style={{ backgroundColor: markerTypes.transport.color }}></span>
                    </label>
                  </div>
                </div>
                
                {/* Suggestion button */}
                <button
                  onClick={handleSuggestNearby}
                  className={`w-full py-2 px-4 rounded ${
                    showSuggestionsPanel 
                      ? 'bg-blue-700 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  style={{fontWeight: 600}}
                >
                  {showSuggestionsPanel ? 'Hide Suggestions' : 'Suggest Nearby'}
                </button>
                
                {/* Multi-stop Routing Controls */}
                <div className="bg-white rounded-lg p-4 shadow-sm space-y-3">
                  <h3 className="font-semibold text-gray-800 mb-1">Multi-Stop Route</h3>
                  <button
                    onClick={toggleRoutingMode}
                    className={`w-full py-2 px-4 rounded text-white font-medium ${
                      isRoutingMode ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {isRoutingMode ? `Stop Selecting Points (${routingPoints.length} selected)` : 'Select Route Points'}
                  </button>
                  
                  {/* Transportation mode selector */}
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transportation Mode:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(transportColors).map(([mode, color]) => (
                        <button
                          key={mode}
                          onClick={() => setTransportMode(mode)}
                          className={`py-1 px-2 rounded text-xs font-medium flex items-center justify-center ${
                            transportMode === mode 
                              ? 'bg-gray-700 text-white' 
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          <span 
                            className="inline-block w-2 h-2 rounded-full mr-1"
                            style={{ backgroundColor: color }}
                          ></span>
                          <span className="capitalize">{mode}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {routingPoints.length >= 2 && (
                    <button
                      onClick={calculateAndDrawMultiStopRoute}
                      className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      Calculate Route
                    </button>
                  )}
                  {routingPoints.length > 0 && (
                    <button
                      onClick={clearRoutingData}
                      className="w-full py-2 px-4 rounded bg-gray-500 hover:bg-gray-600 text-white font-medium"
                    >
                      Clear Selected Points
                    </button>
                  )}
                  {multiStopRouteDetails && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-sm">
                      <p className="font-medium text-gray-700">Route Calculated:</p>
                      <p className="text-gray-600">Mode: <span className="capitalize">{multiStopRouteDetails.mode || transportMode}</span></p>
                      <p className="text-gray-600">Total Distance: {(multiStopRouteDetails.distance / 1000).toFixed(2)} km</p>
                      <p className="text-gray-600">Total Duration: {formatDuration(multiStopRouteDetails.duration)}</p>
                    </div>
                  )}
                </div>
                
                {/* Transportation options */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-2">Transportation</h3>
                  <div className="space-y-2">
                    {Object.entries(transportColors).map(([type, color]) => (
                      <div key={type} className="flex items-center text-gray-700">
                        <span className="capitalize">{type}</span>
                        <span className="ml-auto w-8 h-2 rounded" style={{ backgroundColor: color }}></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Map area - show placeholder if using fixed container */}
            {useFixedContainer ? (
              <div className="map-placeholder">
                <div className="text-center text-gray-500">
                  <p className="text-xl font-semibold">Map shown in fixed position</p>
                  <p className="text-sm">Using external container for stability</p>
                  <button
                    onClick={toggleMapContainer}
                    className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Switch to embedded map
                  </button>
                </div>
              </div>
            ) : (
              <div className="map-container-wrapper">
                {!mapInitialized && !isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80 z-10">
                    <div className="bg-white p-4 rounded-lg shadow-lg text-center">
                      <p className="text-red-500 mb-2">Map failed to initialize</p>
                      <p className="text-sm text-gray-600 mb-3">
                        This may be due to missing API keys or network issues.
                        {MAPBOX_TOKEN === 'pk.placeholder_token' && 
                          " The Mapbox API key is missing or invalid."}
                      </p>
                      <button 
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        onClick={() => initializeMapDirectly(document.getElementById('mapbox-container'))}
                      >
                        Initialize Map
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Map container for embedded approach */}
                <div 
                  id="mapbox-container"
                  ref={!useFixedContainer ? setMapContainerRef : null}
                  className="map-container"
                  data-testid="map-container"
                />
                
                {draggedMarker && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white py-1 px-3 rounded-full shadow-md text-sm z-30">
                    Moving: {draggedMarker.name}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Event Details Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Add to Calendar</h3>
              <button 
                onClick={() => setIsEventModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="event-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  id="event-name"
                  type="text"
                  value={eventDetails.name}
                  onChange={(e) => setEventDetails({...eventDetails, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-day" className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                  <select
                    id="event-day"
                    value={eventDetails.day}
                    onChange={(e) => setEventDetails({...eventDetails, day: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    {Array.from({ length: tripDetails?.numberOfDays || 7 }).map((_, index) => (
                      <option key={index} value={index}>Day {index + 1}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="event-type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    id="event-type"
                    value={eventDetails.type}
                    onChange={(e) => setEventDetails({...eventDetails, type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="activity">Activity</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="hotel">Hotel</option>
                    <option value="transport">Transport</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-time" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <select
                    id="event-time"
                    value={eventDetails.startTime}
                    onChange={(e) => setEventDetails({...eventDetails, startTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    {Array.from({ length: 24 }).map((_, hour) => (
                      <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                        {hour.toString().padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="event-duration" className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                  <select
                    id="event-duration"
                    value={eventDetails.duration}
                    onChange={(e) => setEventDetails({...eventDetails, duration: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="30">30 min</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                    <option value="180">3 hours</option>
                    <option value="240">4 hours</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label htmlFor="event-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  id="event-location"
                  type="text"
                  value={eventDetails.location}
                  onChange={(e) => setEventDetails({...eventDetails, location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
              
              <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md mr-2 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddEventSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add to Calendar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Search results */}
      {showSearchResults && searchResults.length > 0 && (
        <div className="search-results">
          <div className="p-2 bg-blue-50 border-b border-blue-200 flex justify-between items-center">
            <span className="text-sm font-medium text-blue-700">
              {searchResults.length} results found
            </span>
            <button 
              onClick={() => setShowSearchResults(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {searchResults.map(result => (
              <div key={result.id} className="search-result-item hover:bg-gray-50 p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">{result.name}</h3>
                    {result.vicinity && (
                      <p className="text-sm text-gray-600 mt-1">{result.vicinity}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      result.type === 'hotel' ? 'bg-blue-100 text-blue-800' :
                      result.type === 'restaurant' ? 'bg-orange-100 text-orange-800' :
                      result.type === 'activity' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {result.type}
                    </span>
                    
                    {result.rating > 0 && (
                      <div className="flex items-center mt-1">
                        <span className="text-yellow-500 mr-1">★</span>
                        <span className="text-sm text-gray-600">{result.rating}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Add to calendar button */}
                <div className="mt-3">
                  <button 
                    onClick={() => handleAddSearchResultToCalendar(result)}
                    className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                  >
                    Add to Calendar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 