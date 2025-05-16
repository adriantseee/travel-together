'use client';

import { useState, useRef, useEffect } from 'react';
import { getUserColor } from './utils';

export default function DraggableEvent({ 
  event, 
  height, 
  onTimeUpdate,
  isEditable = true,
  columnWidth = 100,
  columnIndex = 0
}) {
  const calculatePosition = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const hourPosition = hours * 4;
    const minutePosition = (minutes / 60) * 4;
    return hourPosition + minutePosition;
  };
  const [isDragging, setIsDragging] = useState(false);
  const [displayTime, setDisplayTime] = useState(event.time);
  const [position, setPosition] = useState(calculatePosition(event.time));
  const eventRef = useRef(null);
  const dragPositionRef = useRef(position); // Store position during drag to prevent re-renders
  
  // Generate a unique ID for this event element if not provided
  const uniqueId = `event-${event.id}`;
  
  // Determine if this is an event that belongs to another user
  const isOtherUserEdit = event.otherUserEdit || false;
  
  // Force isEditable to false if it's another user's edit
  const actuallyEditable = isEditable && !isOtherUserEdit;
  
  // Add forceUpdate key to event to ensure we re-calculate the position when time changes
  const eventKey = event.forceRender || event.lastUpdated || event.id;
  
  // Force position update whenever time changes, bypassing React render cycle
  useEffect(() => {
    const syncPositionWithTime = () => {
      if (isDragging) return; // Skip updates while dragging
      
      const newPosition = calculatePosition(event.time);
      
      // Always set the state for initial rendering
      setDisplayTime(event.time);
      setPosition(newPosition);
      dragPositionRef.current = newPosition;
      
      // Apply directly to DOM for immediate visual feedback
      if (eventRef.current) {
        // Use requestAnimationFrame for smoother visual updates
        requestAnimationFrame(() => {
          eventRef.current.style.transition = 'top 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
          eventRef.current.style.top = `${newPosition}rem`;
        });
      }
      
      console.log(`Event ${event.id} position synchronized to ${newPosition}rem based on time ${event.time}`);
    };
    
    // Call synchronization function immediately
    syncPositionWithTime();
    
    // Set up a MutationObserver to detect if the time attribute changes on the DOM element
    if (eventRef.current) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'data-time') {
            const newTime = eventRef.current.getAttribute('data-time');
            if (newTime && newTime !== displayTime) {
              console.log(`Observed time attribute change to ${newTime} for event ${event.id}`);
              setDisplayTime(newTime);
              syncPositionWithTime();
            }
          }
        });
      });
      
      observer.observe(eventRef.current, { attributes: true });
      return () => observer.disconnect();
    }
  }, [event.time, event.id, isDragging, eventKey]);

  // Snap to 10-minute intervals (smoother)
  const snapToTenMinutes = (minutes) => {
    return Math.round(minutes / 10) * 10;
  };

  // Get more accurate time from position
  const getTimeFromPosition = (topRem) => {
    const totalHours = topRem / 4;
    const hours = Math.floor(totalHours);
    let minutes = snapToTenMinutes(Math.round((totalHours % 1) * 60));
    
    if (minutes === 60) {
      minutes = 0;
      hours += 1;
    }

    const finalHours = Math.max(0, Math.min(23, hours));
    return `${String(finalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const handleMouseDown = (e) => {
    // Block dragging if it's not editable or specifically another user's edit
    if (!actuallyEditable || !onTimeUpdate) return;
    
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    const calendar = e.target.closest('.calendar-container');
    const calendarRect = calendar.getBoundingClientRect();
    const startY = e.clientY;
    const startTop = position; // Start from current position
    dragPositionRef.current = startTop; // Store in ref for smoother updates
    
    // Enter drag mode - disable transitions during drag
    setIsDragging(true);
    if (eventRef.current) {
      eventRef.current.style.transition = 'none';
    }
    
    function handleDrag(moveEvent) {
      if (!eventRef.current) return;
      
      const deltaY = moveEvent.clientY - startY;
      const newTopRem = startTop + (deltaY / 16);
      
      // Apply 10-minute snapping
      const snappedTopRem = Math.round(newTopRem / (4/6)) * (4/6);
      const boundedTopRem = Math.max(0, Math.min(92, snappedTopRem));
      
      // Store in the ref instead of triggering state updates
      dragPositionRef.current = boundedTopRem;
      
      // Update DOM directly for smooth dragging
      eventRef.current.style.transition = 'none';
      eventRef.current.style.top = `${boundedTopRem}rem`;
      
      // Update time display without causing re-renders
      const newTime = getTimeFromPosition(boundedTopRem);
      setDisplayTime(newTime);
    }
    
    function handleDragEnd(upEvent) {
      if (!eventRef.current) return;
      
      // Use the position from the ref instead of recalculating
      const boundedTopRem = dragPositionRef.current;
      const newTime = getTimeFromPosition(boundedTopRem);
      
      // Update the data-time attribute to trigger the observer
      eventRef.current.setAttribute('data-time', newTime);
      
      // Calculate new end time to preserve original duration
      let newEndTime = event.endTime;
      
      if (event.endTime) {
        // Calculate original duration in minutes
        const [startHours, startMinutes] = event.time.split(':').map(Number);
        const [endHours, endMinutes] = event.endTime.split(':').map(Number);
        
        let durationMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
        
        // Handle cases where end time is on the next day
        if (durationMinutes <= 0) {
          durationMinutes += 24 * 60;
        }
        
        // Calculate new end time with the same duration
        const [newHours, newMinutes] = newTime.split(':').map(Number);
        const newEndTotalMinutes = (newHours * 60 + newMinutes + durationMinutes) % (24 * 60);
        
        const newEndHours = Math.floor(newEndTotalMinutes / 60);
        const newEndMins = newEndTotalMinutes % 60;
        
        // Format the new end time
        newEndTime = `${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;
      } else {
        // If there's no end time, create one 1 hour after the start time
        const [newHours, newMinutes] = newTime.split(':').map(Number);
        const newEndTotalMinutes = (newHours * 60 + newMinutes + 60) % (24 * 60);
        
        const newEndHours = Math.floor(newEndTotalMinutes / 60);
        const newEndMins = newEndTotalMinutes % 60;
        
        // Format the new end time
        newEndTime = `${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;
      }
      
      // Set the final position state
      setPosition(boundedTopRem);
      
      // Call onTimeUpdate to save changes
      onTimeUpdate(event.id, newTime, newEndTime);
      
      // Restore transition for smooth landing
      if (eventRef.current) {
        eventRef.current.style.transition = 'top 0.3s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease-in-out, transform 0.2s ease-out';
      }
      
      // Add a small delay before clearing the drag state to allow time for any animations
      setTimeout(() => {
        setIsDragging(false);
      }, 50);
      
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
    }
    
    handleDrag(e);
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };
  
  // Calculate duration in a readable format
  const getDurationLabel = () => {
    if (!event.endTime) return '';
    
    const [startHours, startMinutes] = event.time.split(':').map(Number);
    const [endHours, endMinutes] = event.endTime.split(':').map(Number);
    
    let durationMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    
    // Handle cases where end time is on the next day
    if (durationMinutes <= 0) {
      durationMinutes += 24 * 60;
    }
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours === 0) {
      return `${minutes}min`;
    } else if (minutes === 0) {
      return hours === 1 ? '1hr' : `${hours}hrs`;
    } else {
      return `${hours}hr ${minutes}min`;
    }
  };
  
  // Get the user's avatar or colored initial
  const getCreatorInitial = () => {
    if (!event.createdBy) return null;
    
    const name = event.createdBy.name || 'User';
    return name.charAt(0).toUpperCase();
  };
  
  const creatorInitial = getCreatorInitial();
  const userColor = event.createdBy ? getUserColor(event.createdBy.id || event.createdBy.name) : 'bg-gray-300 text-gray-800';
  const durationLabel = getDurationLabel();
  
  // Calculate left position for columns in edit mode
  const leftPosition = columnWidth < 100 ? `calc(${columnIndex * columnWidth}% + 4rem)` : '4rem';
  const rightPosition = columnWidth < 100 ? `calc(100% - ${(columnIndex + 1) * columnWidth}% - 1rem)` : '1rem';
  
  // Determine if this is an event that's being edited in personal mode
  const isPersonalEdit = event.isPersonalEdit && !isOtherUserEdit;
  
  const style = {
    height: `${height}rem`,
    position: 'absolute',
    top: `${position}rem`, // Use state for position
    left: leftPosition,
    right: rightPosition,
    cursor: !actuallyEditable ? 'default' : isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    touchAction: 'none',
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.9 : 1,
    transition: isDragging ? 'none' : 'top 0.3s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease-in-out, transform 0.2s ease-out', // Smoother transitions
    transform: isDragging ? 'scale(1.02)' : 'scale(1)',
    maxWidth: columnWidth < 100 ? `${columnWidth}%` : 'none',
    willChange: 'transform, top' // Optimize rendering
  };

  return (
    <div
      ref={eventRef}
      id={uniqueId}
      data-time={event.time}
      data-editable={actuallyEditable}
      data-other-user={isOtherUserEdit}
      style={style}
      onMouseDown={handleMouseDown}
      className={`absolute rounded-md p-2 flex flex-col ${
        isDragging ? 'shadow-lg z-50' : 'shadow-sm z-40'
      } ${
        actuallyEditable ? 'cursor-move' : 'cursor-default'
      } ${
        event.isPersonalEdit ? 'bg-orange-50 border border-orange-300' : 'bg-white border border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <h4 className="font-medium text-gray-900 line-clamp-2 break-words">{event.activity}</h4>
        <div className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${getUserColor(event.createdBy?.id)}`}>
            {getCreatorInitial()}
          </div>
        </div>
      </div>
      
      <div className="mt-auto text-xs text-gray-700 pt-1">
        <span className="font-medium">{displayTime}</span>
        {event.endTime && (
          <>
            <span className="mx-0.5">-</span>
            <span className="font-medium">{event.endTime}</span>
          </>
        )}
        <span className="ml-1 text-gray-600">({getDurationLabel()})</span>
        
        {event.isPersonalEdit && (
          <span className="ml-1 text-xs px-1 py-0.5 bg-orange-200 text-orange-800 rounded">
            Private
          </span>
        )}
        
        {/* Display location information if it exists */}
        {event.location && (
          <div className="mt-1 flex items-center text-gray-600">
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate" title={event.location}>
              {event.location.length > 30 ? event.location.substring(0, 30) + '...' : event.location}
            </span>
          </div>
        )}
      </div>
      
      {/* Dragging indicator */}
      {isDragging && (
        <div className="absolute -bottom-2 left-0 right-0 flex justify-center">
          <div className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
            Moving to {displayTime}
          </div>
        </div>
      )}
      
      {/* View-only indicator for other users' edits */}
      {isOtherUserEdit && (
        <div className="absolute -top-2 right-2">
          <div className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
            View Only
          </div>
        </div>
      )}
      
      {/* Original event indicator */}
      {event.originalEventId && !isOtherUserEdit && (
        <div className="absolute -top-2 left-2">
          <div className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
            Personal Copy
          </div>
        </div>
      )}
    </div>
  );
} 