'use client';

import { useState, useRef, useEffect } from 'react';

export default function AssistantView({ tripDetails }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: 'Hi there! I\'m your travel assistant. How can I help with your trip planning today?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Handle sending a new message
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;
    
    // Add user message
    const userMessage = {
      id: messages.length + 1,
      sender: 'user',
      text: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    
    // Simulate assistant typing
    setIsTyping(true);
    
    // Simulate response (replace with actual AI/API call)
    setTimeout(() => {
      const assistantMessage = {
        id: messages.length + 2,
        sender: 'assistant',
        text: getAssistantResponse(inputMessage, tripDetails),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };
  
  // Simple response logic - would be replaced with actual AI
  const getAssistantResponse = (message, tripDetails) => {
    const normalizedMsg = message.toLowerCase();
    
    if (normalizedMsg.includes('hotel') || normalizedMsg.includes('stay') || normalizedMsg.includes('accommodation')) {
      return 'I can help you find great accommodations in ' + (tripDetails?.city || 'your destination') + '. Would you prefer a hotel, Airbnb, or something else?';
    }
    
    if (normalizedMsg.includes('restaurant') || normalizedMsg.includes('food') || normalizedMsg.includes('eat')) {
      return 'There are many great dining options in ' + (tripDetails?.city || 'your destination') + '. What kind of cuisine are you interested in?';
    }
    
    if (normalizedMsg.includes('activity') || normalizedMsg.includes('do') || normalizedMsg.includes('see') || normalizedMsg.includes('visit')) {
      return 'I can suggest activities based on your interests. Are you looking for museums, outdoor activities, or something else?';
    }
    
    if (normalizedMsg.includes('weather')) {
      return 'I can check the weather forecast for your trip dates. When will you be visiting ' + (tripDetails?.city || 'your destination') + '?';
    }
    
    if (normalizedMsg.includes('transport') || normalizedMsg.includes('getting around')) {
      return 'There are several ways to get around ' + (tripDetails?.city || 'your destination') + '. Would you like information about public transportation, taxis, or car rentals?';
    }
    
    // Default response
    return "I'm here to help with your trip planning. You can ask me about accommodations, restaurants, activities, weather, or transportation.";
  };
  
  // Format timestamp
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="h-full w-full flex flex-col bg-gray-50">
      <div className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto py-4 px-6">
          <h1 className="text-2xl font-bold">Travel Assistant</h1>
          <p className="text-blue-100 mt-1">Get help planning your trip to {tripDetails?.city || 'your destination'}</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Messages container */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-xs md:max-w-md rounded-lg p-3 ${
                    message.sender === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white shadow-sm border border-gray-200'
                  }`}
                >
                  <p className={message.sender === 'user' ? 'text-white' : 'text-gray-800'}>
                    {message.text}
                  </p>
                  <p className={`text-xs mt-1 text-right ${
                    message.sender === 'user' ? 'text-blue-200' : 'text-gray-500'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {/* Input area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Type your message..."
              />
              <button
                type="submit"
                className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 