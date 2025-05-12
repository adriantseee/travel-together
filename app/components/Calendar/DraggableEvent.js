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
  const [isDragging, setIsDragging] = useState(false);
  const [displayTime, setDisplayTime] = useState(event.time);
  const eventRef = useRef(null);
  
  useEffect(() => {
    setDisplayTime(event.time);
  }, [event.time]);

  const calculatePosition = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const hourPosition = hours * 4;
    const minutePosition = (minutes / 60) * 4;
    return hourPosition + minutePosition;
  };

  const snapToTenMinutes = (minutes) => {
    return Math.round(minutes / 10) * 10;
  };

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
    if (!isEditable || !onTimeUpdate) return; // Only allow dragging if editable
    
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    const calendar = e.target.closest('.calendar-container');
    const calendarRect = calendar.getBoundingClientRect();
    const startY = e.clientY;
    const startTop = calculatePosition(event.time);
    
    setIsDragging(true);
    
    function handleDrag(moveEvent) {
      const deltaY = moveEvent.clientY - startY;
      const newTopRem = startTop + (deltaY / 16);
      const snappedTopRem = Math.round(newTopRem / (4/6)) * (4/6);
      
      const boundedTopRem = Math.max(0, Math.min(92, snappedTopRem));
      
      if (eventRef.current) {
        const newTime = getTimeFromPosition(boundedTopRem);
        eventRef.current.style.top = `${boundedTopRem}rem`;
        setDisplayTime(newTime);
      }
    }
    
    function handleDragEnd(upEvent) {
      const deltaY = upEvent.clientY - startY;
      const newTopRem = startTop + (deltaY / 16);
      const snappedTopRem = Math.round(newTopRem / (4/6)) * (4/6);
      
      const boundedTopRem = Math.max(0, Math.min(92, snappedTopRem));
      const newTime = getTimeFromPosition(boundedTopRem);
      
      onTimeUpdate(event.id, newTime);
      
      setIsDragging(false);
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
  
  const style = {
    height: `${height}rem`,
    position: 'absolute',
    top: `${calculatePosition(event.time)}rem`,
    left: leftPosition,
    right: rightPosition,
    cursor: !isEditable ? 'default' : isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    touchAction: 'none',
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.9 : 1,
    transition: isDragging ? 'none' : 'box-shadow 0.2s ease-in-out',
    maxWidth: columnWidth < 100 ? `${columnWidth}%` : 'none'
  };

  return (
    <div
      ref={eventRef}
      style={style}
      onMouseDown={handleMouseDown}
      className={`px-3 py-2 rounded-md bg-white border 
        ${isDragging ? 'shadow-xl' : 'shadow-sm'} hover:shadow-md transition-shadow`}
    >
      <div className="flex justify-between items-start">
        <div className={`text-sm font-medium text-gray-800`}>{event.activity}</div>
        <div className="flex items-center">
          {!isEditable && (
            <span className="bg-gray-100 text-xs rounded-full px-1.5 py-0.5 mr-1 text-gray-600">View only</span>
          )}
          {event.createdBy && (
            <div 
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${userColor}`}
              title={event.createdBy.name || 'User'}
            >
              {creatorInitial}
            </div>
          )}
        </div>
      </div>
        
      <div className="flex items-center justify-between text-xs font-medium mt-1">
        <div className={`flex items-center text-gray-600`}>
          <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{displayTime}</span>
          {event.endTime && (
            <>
              <span className="mx-1">—</span>
              <span>{event.endTime}</span>
            </>
          )}
        </div>
        
        {durationLabel && (
          <div className={`flex items-center ml-2 text-xs text-gray-600 font-medium`}>
            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {durationLabel}
          </div>
        )}
      </div>
    </div>
  );
} 