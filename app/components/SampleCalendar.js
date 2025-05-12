'use client';
import { useState, useEffect, useRef } from 'react';
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

const ChevronLeftIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className="w-6 h-6"
  >
    <path d="M15.75 19.5L8.25 12l7.5-7.5" strokeWidth={1.5} />
  </svg>
);

const ChevronRightIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className="w-6 h-6"
  >
    <path d="M8.25 4.5l7.5 7.5-7.5 7.5" strokeWidth={1.5} />
  </svg>
);

const HOUR_HEIGHT = 4;

const parseTimeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + minutes;
};

const calculateEventHeight = (startTime, endTime) => {
  try {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startDecimal = startHour + startMinute/60;
    const endDecimal = endHour + endMinute/60;
    
    return (endDecimal - startDecimal) * 4;
  } catch (error) {
    console.error('Error calculating height:', error);
    return 4;
  }
};

const DraggableEvent = ({ event, height, onTimeUpdate }) => {
  const [displayTime, setDisplayTime] = useState(event.time);
  const [isDragging, setIsDragging] = useState(false);
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
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Mouse down on event:', event.activity);
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
      
      console.log('Final time:', newTime);
      onTimeUpdate(event.id, newTime);
      
      setIsDragging(false);
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
    }
    
    handleDrag(e);
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };
  
  const style = {
    height: `${height}rem`,
    position: 'absolute',
    top: `${calculatePosition(event.time)}rem`,
    left: '4rem',
    right: '1rem',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={eventRef}
      style={style}
      onMouseDown={handleMouseDown}
      className={`px-3 py-1.5 mx-12 bg-blue-50 border border-blue-200 rounded
        ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="text-sm font-medium text-gray-800">{event.activity}</div>
      <div className="text-xs text-gray-500">{displayTime}</div>
    </div>
  );
};

const TypingIndicator = () => {
  return (
    <div className="flex items-center space-x-2 bg-gray-100 rounded-2xl py-3 px-4 w-fit max-w-[75px] animate-fade-in">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
    </div>
  );
};

const ChatInterface = ({ onInitialMessage, tripDetails }) => {
  const [messages, setMessages] = useState([{
    isUser: false,
    text: `Hi! I'll help you plan your ${tripDetails.numberOfDays}-day trip to ${tripDetails.city}. What kind of activities are you interested in?`
  }]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    const userMessage = { isUser: true, text: message };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsAiTyping(true);

    try {
      console.log("Sending message with details:", {
        message,
        city: tripDetails.city,
        numberOfDays: tripDetails.numberOfDays
      });

      const response = await fetch('api/itinerary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userInput: message,
          city: tripDetails.city,
          numberOfDays: tripDetails.numberOfDays
        }),
      });
      
      const data = await response.json();
      
      const aiMessage = {
        isUser: false,
        text: "I've generated an itinerary based on your preferences. You can see it in the calendar view on the right."
      };
      setMessages(prev => [...prev, aiMessage]);

      await onInitialMessage(data);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        isUser: false,
        text: "Sorry, I encountered an error while generating your itinerary. Please try again."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAiTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                message.isUser 
                  ? 'bg-blue-500 text-white rounded-br-none' 
                  : 'bg-gray-100 text-gray-900 rounded-bl-none'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        
        {isAiTyping && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(inputText);
              }
            }}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => handleSendMessage(inputText)}
            disabled={!inputText.trim() || isAiTyping}
            className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [days, setDays] = useState([]);
  const [eventHeights, setEventHeights] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [newEventData, setNewEventData] = useState({
    activity: '',
    time: '09:00',
    duration: 60
  });
  const [tripSetupComplete, setTripSetupComplete] = useState(false);
  const [tripDetails, setTripDetails] = useState({
    city: '',
    numberOfDays: 3,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (days.length > 0) {
      const heights = {};
      days.forEach(day => {
        day.forEach((event, index) => {
          const nextEvent = day[index + 1];
          heights[event.id] = nextEvent 
            ? calculateEventHeight(event.time, nextEvent.time)
            : HOUR_HEIGHT;
        });
      });
      setEventHeights(heights);
    }
  }, [days.length]);

  const handleInitialMessage = async (itineraryData) => {
    setIsLoading(true);
    try {
      console.log("1. Starting to process itinerary data");
      console.log("2. Raw itinerary data:", itineraryData);
      
      const cleanedData = itineraryData
        .map(item => item.trim())
        .filter(item => item.length > 0);

      console.log("3. Cleaned data:", cleanedData);
      
      const parsedDays = [];
      let currentDay = [];
      let currentDayNumber = 1;
      
      cleanedData.forEach((item, index) => {
        console.log(`4. Processing item ${index}:`, item);
        
        if (item.toLowerCase().includes('day')) {
          console.log("5. Found day marker:", item);
          if (currentDay.length > 0) {
            console.log(`6. Pushing day ${currentDayNumber} with ${currentDay.length} events:`, [...currentDay]);
            parsedDays.push([...currentDay]);
          }
          currentDay = [];
          currentDayNumber++;
        }
        else if (item.match(/^(\d{1,2}:\d{2})\s*-\s*(.+)/)) {
          const timeMatch = item.match(/^(\d{1,2}:\d{2})\s*-\s*(.+)/);
          console.log("7. Found time-activity match:", timeMatch);
          
          const [_, time, activity] = timeMatch;
          let formattedTime = time.length === 4 ? '0' + time : time;
          
          const newEvent = {
            id: `event-${currentDayNumber}-${index}`,
            time: formattedTime,
            activity: activity.trim()
          };
          
          console.log("8. Adding event to current day:", newEvent);
          currentDay.push(newEvent);
          console.log("9. Current day array is now:", currentDay);
        }
        else {
          console.log("What? Unprocessed item:", item);
        }
      });

      if (currentDay.length > 0) {
        console.log(`10. Pushing final day ${currentDayNumber} with ${currentDay.length} events:`, [...currentDay]);
        parsedDays.push([...currentDay]);
      }
      
      console.log("11. Final parsed days:", parsedDays);
      
      if (parsedDays.length > 0) {
        const sortedDays = parsedDays.map(day => 
          day.sort((a, b) => {
            const timeA = a.time.split(':').map(Number);
            const timeB = b.time.split(':').map(Number);
            return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
          })
        );
        
        console.log("12. Sorted days:", sortedDays);
        setDays(sortedDays);
        
        const heights = {};
        sortedDays.forEach(day => {
          day.forEach((event, index) => {
            if (index < day.length - 1) {
              const currentTime = event.time;
              const nextTime = day[index + 1].time;
              heights[event.id] = calculateEventHeight(currentTime, nextTime);
            } else {
              heights[event.id] = 4;
            }
          });
        });
        
        console.log("13. Event heights:", heights);
        setEventHeights(heights);
      }

    } catch (error) {
      console.error('Error parsing itinerary:', error);
      console.error('Error details:', error.stack);
    } finally {
      setIsLoading(false);
    }
  };

  const currentDayActivities = days[currentDayIndex] || [];

  const generateTimeMarkers = () => {
    return Array.from({ length: 24 }).map((_, i) => {
      const hour = i;
      return (
        <div key={i} className="absolute w-full" style={{ top: `${i * 4}rem` }}>
          <div className="flex items-center">
            <span className="w-10 text-sm text-gray-500">
              {`${String(hour).padStart(2, '0')}:00`}
            </span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
        </div>
      );
    });
  };

  const handleTimeUpdate = (eventId, newTime) => {
    console.log('handleTimeUpdate called with:', eventId, newTime);
    
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
        const updatedDay = currentDay.map(event =>
          event.id === eventId ? { ...event, time: newTime } : event
        );
        newDays[currentDayIndex] = updatedDay.sort((a, b) => 
          timeToDecimal(a.time) - timeToDecimal(b.time)
        );
        return newDays;
      }

      let updatedEvents = currentDay.map(event => {
        if (event.id === eventId) {
          return { ...event, time: overlappingEvent.time };
        }
        if (event.id === overlappingEvent.id) {
          return { ...event, time: movingEvent.time };
        }
        return event;
      });

      updatedEvents.sort((a, b) => timeToDecimal(a.time) - timeToDecimal(b.time));

      for (let i = 0; i < updatedEvents.length - 1; i++) {
        const currentEvent = updatedEvents[i];
        const nextEvent = updatedEvents[i + 1];
        
        const currentEndTime = timeToDecimal(currentEvent.time) + getEventDuration(currentEvent.id);
        const nextStartTime = timeToDecimal(nextEvent.time);
        const timeDifference = nextStartTime - currentEndTime;

        if (timeDifference > 0 && timeDifference < 2) {
          nextEvent.time = decimalToTime(currentEndTime);
        }
      }

      for (let i = 1; i < updatedEvents.length; i++) {
        const prevEvent = updatedEvents[i - 1];
        const currentEvent = updatedEvents[i];
        
        const prevEndTime = timeToDecimal(prevEvent.time) + getEventDuration(prevEvent.id);
        const currentStartTime = timeToDecimal(currentEvent.time);
        
        if (prevEndTime > currentStartTime) {
          currentEvent.time = decimalToTime(prevEndTime);
        }
      }

      newDays[currentDayIndex] = updatedEvents;
      return newDays;
    });
  };

  const isTimeSlotAvailable = (startTime, durationMinutes) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDecimal = hours + minutes/60;
    const endDecimal = startDecimal + (durationMinutes/60);

    return !currentDayActivities.some(event => {
      const [eventHours, eventMinutes] = event.time.split(':').map(Number);
      const eventStart = eventHours + eventMinutes/60;
      const eventEnd = eventStart + (eventHeights[event.id] / 4);

      return (
        (startDecimal >= eventStart && startDecimal < eventEnd) ||
        (endDecimal > eventStart && endDecimal <= eventEnd) ||
        (startDecimal <= eventStart && endDecimal >= eventEnd)
      );
    });
  };

  const handleAddEvent = () => {
    const { activity, time, duration } = newEventData;
    
    if (!activity || !time || !duration) {
      alert('Please fill in all fields');
      return;
    }

    if (!isTimeSlotAvailable(time, duration)) {
      alert('This time slot conflicts with existing events');
      return;
    }

    const newEvent = {
      id: `event-${Date.now()}`,
      time,
      activity
    };

    setDays(prevDays => {
      const newDays = [...prevDays];
      const updatedDay = [...(newDays[currentDayIndex] || []), newEvent];
      
      updatedDay.sort((a, b) => {
        const [aHours, aMinutes] = a.time.split(':').map(Number);
        const [bHours, bMinutes] = b.time.split(':').map(Number);
        return (aHours + aMinutes/60) - (bHours + bMinutes/60);
      });
      
      newDays[currentDayIndex] = updatedDay;
      return newDays;
    });

    setEventHeights(prev => ({
      ...prev,
      [newEvent.id]: duration * (4/60)
    }));

    setIsAddEventModalOpen(false);
    setNewEventData({ activity: '', time: '09:00', duration: 60 });
  };

  const TripSetup = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
      city: '',
      numberOfDays: 3,
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (step === 1) {
        setStep(2);
      } else {
        onComplete(formData);
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
          <div className="space-y-6">
            <div className="flex justify-between mb-8">
              <div className={`h-1 w-1/2 rounded-full ${
                step === 1 ? 'bg-blue-500' : 'bg-blue-200'
              }`} />
              <div className={`h-1 w-1/2 rounded-full ${
                step === 2 ? 'bg-blue-500' : 'bg-blue-200'
              }`} />
            </div>

            <h1 className="text-2xl font-semibold text-center text-black">
              {step === 1 ? "Where are you traveling?" : "How long is your trip?"}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Enter city name"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    required
                  />
                  <button
                    type="submit"
                    disabled={!formData.city.trim()}
                    className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-4">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        numberOfDays: Math.max(1, prev.numberOfDays - 1) 
                      }))}
                      className="p-2 rounded-lg hover:bg-gray-100"
                    >
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="text-4xl font-semibold text-gray-900 min-w-[3ch] text-center">
                      {formData.numberOfDays}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        numberOfDays: Math.min(14, prev.numberOfDays + 1) 
                      }))}
                      className="p-2 rounded-lg hover:bg-gray-100"
                    >
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-center text-gray-600">
                    {formData.numberOfDays === 1 ? 'day' : 'days'}
                  </p>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Start Planning
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {!tripSetupComplete ? (
        <TripSetup 
          onComplete={(details) => {
            setTripDetails(details);
            setTripSetupComplete(true);
          }} 
        />
      ) : (
        <main className="h-screen flex">
          <div className="w-1/3 border-r border-gray-200">
            <ChatInterface 
              onInitialMessage={handleInitialMessage}
              tripDetails={tripDetails}
            />
          </div>

          <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-semibold text-gray-900">Itinerary Planner</h1>
              {days.length > 0 && (
                <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg shadow-sm">
                  <button 
                    onClick={() => setCurrentDayIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentDayIndex === 0}
                    className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="text-lg font-medium text-gray-900 min-w-[5rem] text-center">
                    Day {currentDayIndex + 1}
                  </span>
                  <button 
                    onClick={() => setCurrentDayIndex(prev => Math.min(days.length - 1, prev + 1))}
                    disabled={currentDayIndex === days.length - 1}
                    className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin w-8 h-8 border-3 border-gray-300 border-t-blue-500 rounded-full"></div>
                  <p className="text-gray-600 font-medium">Generating your itinerary...</p>
                </div>
              </div>
            ) : !days || days.length === 0 ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                  <div className="mb-4 text-gray-400">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600">Generated itinerary will show here</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="relative calendar-container" style={{ height: '96rem' }}>
                  <div className="absolute inset-0">
                    <div className="relative h-full">
                      {generateTimeMarkers()}
                    </div>
                  </div>
                  <div className="absolute inset-0 z-0" style={{ top: '0.6rem' }}>
                    <div className="relative h-full">
                      {console.log("Current day index:", currentDayIndex)}
                      {console.log("Current day events:", days[currentDayIndex])}
                      {days[currentDayIndex]?.map((event) => {
                        console.log("Rendering event:", event);
                        return (
                          <DraggableEvent
                            key={event.id}
                            event={event}
                            height={eventHeights[event.id]}
                            onTimeUpdate={handleTimeUpdate}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {days.length > 0 && (
              <button
                onClick={() => setIsAddEventModalOpen(true)}
                className="fixed bottom-8 right-8 w-14 h-14 bg-blue-500 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
              >
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </button>
            )}
            {isAddEventModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-6 w-96">
                  <h2 className="text-xl font-semibold mb-4">Add New Event</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Event Name
                      </label>
                      <input
                        type="text"
                        value={newEventData.activity}
                        onChange={(e) => setNewEventData(prev => ({ ...prev, activity: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration (minutes)
                      </label>
                      <select
                        value={newEventData.duration}
                        onChange={(e) => setNewEventData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
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
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      >
                        Add Event
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

{
  /*
  Pseudocode for format:
  # Day X
    ->Side bar with time like google calendar
    ->Each activity with height corresponding to duration(no space between each activity)
  */
}