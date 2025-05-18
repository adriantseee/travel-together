'use client';

import { useState, useEffect, useRef } from 'react';

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const AnimatedCircle = ({ isGenerating = false, isClicked = false }) => {
  const svgRef = useRef(null);
  
  useEffect(() => {
    // Control animation based on isGenerating or isClicked state
    const svg = svgRef.current;
    if (svg) {
      if (isGenerating) {
        svg.classList.add('generating');
        svg.classList.remove('clicked');
      } else if (isClicked) {
        svg.classList.add('clicked');
        svg.classList.remove('generating');
      } else {
        svg.classList.remove('generating');
        svg.classList.remove('clicked');
      }
    }
  }, [isGenerating, isClicked]);

  return (
    <svg 
      ref={svgRef}
      width="100%" 
      height="100%" 
      viewBox="0 0 100 100" 
      className={`animated-circle ${'generating'}`}
    >
      {/* Squiggly circle lines - 5 different paths */}
      <path 
        className="squiggle-line line-1" 
        d="M50,15 C65,15 80,20 88,35 C95,50 90,70 75,80 C60,90 40,90 25,80 C10,70 5,50 12,35 C20,20 35,15 50,15" 
        fill="none" 
        stroke="white" 
        strokeWidth="3"
      />
      <path 
        className="squiggle-line line-2" 
        d="M50,20 C63,20 76,24 84,37 C91,50 87,67 74,76 C61,85 43,85 30,76 C17,67 13,50 20,37 C28,24 37,20 50,20" 
        fill="none" 
        stroke="white" 
        strokeWidth="2"
      />
      <path 
        className="squiggle-line line-3" 
        d="M50,25 C61,25 72,28 79,39 C86,50 83,64 72,72 C61,80 45,80 34,72 C23,64 20,50 27,39 C34,28 39,25 50,25" 
        fill="none" 
        stroke="white" 
        strokeWidth="2.5"
      />
      <path 
        className="squiggle-line line-4" 
        d="M50,30 C59,30 68,33 74,41 C81,50 78,61 70,68 C62,75 48,75 40,68 C32,61 29,50 36,41 C42,33 41,30 50,30" 
        fill="none" 
        stroke="white" 
        strokeWidth="2"
      />
      <path 
        className="squiggle-line line-5" 
        d="M50,35 C57,35 63,37 69,43 C75,50 73,58 67,64 C61,70 50,70 44,64 C38,58 36,50 42,43 C48,37 43,35 50,35" 
        fill="none" 
        stroke="white" 
        strokeWidth="1.5"
      />
      <style jsx>{`
        .animated-circle {
          transform-origin: center center;
        }
        
        .squiggle-line {
          transform-origin: center center;
          transition: all 0.5s ease;
        }
        
        /* Idle animation - IDENTICAL to generating animation */
        .idle .line-1 {
          animation: oscillate1 1.5s infinite alternate, rotate1 8s infinite linear;
          stroke-width: 3.5;
        }
        .idle .line-2 {
          animation: oscillate2 1.2s infinite alternate, rotate2 10s infinite linear;
          stroke-width: 2.5;
        }
        .idle .line-3 {
          animation: oscillate1 1.8s infinite alternate, rotate1 12s infinite linear;
          stroke-width: 3;
        }
        .idle .line-4 {
          animation: oscillate2 1.3s infinite alternate, rotate2 9s infinite linear;
          stroke-width: 2.5;
        }
        .idle .line-5 {
          animation: oscillate1 1.6s infinite alternate, rotate1 11s infinite linear;
          stroke-width: 2;
        }
        
        /* Clicked state - more squiggly */
        .clicked .line-1 {
          animation: squiggle1 0.8s infinite alternate, rotate1 5s infinite linear;
          stroke-width: 3.2;
          filter: drop-shadow(0 0 1px rgba(255,255,255,0.6));
        }
        .clicked .line-2 {
          animation: squiggle2 0.7s infinite alternate, rotate2 6s infinite linear;
          stroke-width: 2.3;
          filter: drop-shadow(0 0 1px rgba(255,255,255,0.6));
        }
        .clicked .line-3 {
          animation: squiggle1 0.9s infinite alternate, rotate1 7s infinite linear;
          stroke-width: 2.8;
          filter: drop-shadow(0 0 1px rgba(255,255,255,0.6));
        }
        .clicked .line-4 {
          animation: squiggle2 0.6s infinite alternate, rotate2 4s infinite linear;
          stroke-width: 2.2;
          filter: drop-shadow(0 0 1px rgba(255,255,255,0.6));
        }
        .clicked .line-5 {
          animation: squiggle1 0.5s infinite alternate, rotate1 8s infinite linear;
          stroke-width: 1.8;
          filter: drop-shadow(0 0 1px rgba(255,255,255,0.6));
        }
        
        /* Generating state animation - KEPT EXACTLY THE SAME as idle */
        .generating .line-1 {
          animation: oscillate1 1.5s infinite alternate, rotate1 8s infinite linear;
          stroke-width: 3.5;
        }
        .generating .line-2 {
          animation: oscillate2 1.2s infinite alternate, rotate2 10s infinite linear;
          stroke-width: 2.5;
        }
        .generating .line-3 {
          animation: oscillate1 1.8s infinite alternate, rotate1 12s infinite linear;
          stroke-width: 3;
        }
        .generating .line-4 {
          animation: oscillate2 1.3s infinite alternate, rotate2 9s infinite linear;
          stroke-width: 2.5;
        }
        .generating .line-5 {
          animation: oscillate1 1.6s infinite alternate, rotate1 11s infinite linear;
          stroke-width: 2;
        }
        
        @keyframes rotate1 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes rotate2 {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        
        @keyframes oscillate1 {
          0% { transform: scale(0.9); }
          100% { transform: scale(1.1); }
        }
        
        @keyframes oscillate2 {
          0% { transform: scale(1.1); }
          100% { transform: scale(0.9); }
        }
        
        @keyframes squiggle1 {
          0% { 
            d: path("M50,15 C65,15 80,20 88,35 C95,50 90,70 75,80 C60,90 40,90 25,80 C10,70 5,50 12,35 C20,20 35,15 50,15");
            transform: scale(0.95);
          }
          50% {
            d: path("M50,15 C68,18 78,22 90,38 C97,48 92,72 73,82 C58,88 38,88 27,78 C12,68 8,48 15,32 C23,18 32,12 50,15");
          }
          100% { 
            d: path("M50,15 C62,12 83,18 92,32 C99,52 88,68 77,78 C62,92 42,92 23,82 C8,72 3,52 10,38 C18,22 38,18 50,15");
            transform: scale(1.05);
          }
        }
        
        @keyframes squiggle2 {
          0% { 
            d: path("M50,20 C63,20 76,24 84,37 C91,50 87,67 74,76 C61,85 43,85 30,76 C17,67 13,50 20,37 C28,24 37,20 50,20");
            transform: scale(1.05);
          }
          50% {
            d: path("M50,20 C66,23 73,28 86,40 C93,48 89,69 72,78 C59,83 41,83 28,74 C15,65 15,48 22,35 C30,22 34,17 50,20");
          }
          100% { 
            d: path("M50,20 C60,17 79,22 88,35 C95,52 85,65 72,74 C59,83 45,83 28,74 C15,65 11,52 18,35 C26,22 40,23 50,20");
            transform: scale(0.95);
          }
        }
      `}</style>
    </svg>
  );
};

const FloatingChatButton = ({ onAddEvent, tripDetails, navigateToMapLocation }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClicked, setIsClicked] = useState(true); // Always use the special squiggle animation
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const messagesEndRef = useRef(null);

  // Initialize welcome message with trip context if available
  useEffect(() => {
    let welcomeMessage = "Hi there! I'm your travel assistant. Ask me about places to visit or things to do";
    
    if (tripDetails?.city) {
      welcomeMessage += ` in ${tripDetails.city}`;
      if (tripDetails?.country) {
        welcomeMessage += `, ${tripDetails.country}`;
      }
    }
    
    welcomeMessage += ", and I'll suggest some great options!";
    
    setMessages([
      { id: 1, text: welcomeMessage, isUser: false }
    ]);
  }, [tripDetails]);

  // Scroll to bottom of messages whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleViewOnMap = (place) => {
    if (navigateToMapLocation) {
      navigateToMapLocation(place);
      // Optionally close chat
      setIsOpen(false);
    } else {
      console.warn("No navigateToMapLocation handler provided");
      alert(`Showing "${place.name}" on the map!`);
    }
  };

  const handleSendMessage = async () => {
    if (message.trim() === '') return;
    
    // Add user message to UI
    const userMessageId = Date.now();
    const userMessage = { id: userMessageId, text: message, isUser: true };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    
    // Add to chat history for API
    const newChatHistory = [
      ...chatHistory,
      { role: "user", content: message }
    ];
    setChatHistory(newChatHistory);
    
    // Clear input and set generating state
    setMessage('');
    setIsGenerating(true);
    
    try {
      // Create a temporary message for streaming response
      const assistantMessageId = Date.now() + 1;
      setMessages(prevMessages => [
        ...prevMessages, 
        { id: assistantMessageId, text: "", isUser: false, isLoading: true }
      ]);

      // Call the get-locations API with trip details
      const response = await fetch("/api/get-locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
          tripDetails: tripDetails || {},
          tripId: tripDetails?.id
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process and display the response
      let formattedResponse = "";
      
      // Check if we received place data or just queries
      if (data.queries && typeof data.queries === 'object' && !Array.isArray(data.queries)) {
        // We received a placeList object with query -> places mapping
        const placeList = data.queries;
        formattedResponse = "Here are some places you might be interested in:\n\n";
        
        Object.entries(placeList).forEach(([query, places]) => {
          formattedResponse += `For "${query}":\n${places}\n\n`;
        });
        
        if (Object.keys(placeList).length === 0) {
          formattedResponse = "I couldn't find any specific locations based on your request. Could you try asking in a different way?";
        }
      } else if (data.queries && Array.isArray(data.queries)) {
        // We just got query strings back
        formattedResponse = `Here are some interesting things to check out:\n\n${data.queries.join("\n")}`;
        
        if (data.queries.length === 0) {
          formattedResponse = "I couldn't find any results based on your request. Could you try asking in a different way?";
        }
      } else {
        formattedResponse = "I'm sorry, but I couldn't find any information based on your request. Please try asking in a different way.";
      }
      
      // Update chat history with assistant response
      setChatHistory(prev => [
        ...prev,
        { role: "assistant", content: formattedResponse }
      ]);
      
      // Update the message with full content
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        const lastMessage = newMessages.find(msg => msg.id === assistantMessageId);
        if (lastMessage) {
          lastMessage.text = formattedResponse;
          lastMessage.isLoading = false;
        }
        return newMessages;
      });
      
      setIsGenerating(false);
      
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prevMessages => {
        const filtered = prevMessages.filter(msg => !msg.isLoading);
        return [
          ...filtered,
          { 
            id: Date.now() + 2, 
            text: `Sorry, I encountered an error: ${error.message}. Please try again later.`, 
            isUser: false 
          }
        ];
      });
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen ? (
        <div className="bg-white rounded-lg shadow-xl w-96 h-[450px] flex flex-col">
          <div className="bg-blue-600 text-white p-3 rounded-t-lg flex justify-between items-center">
            <h3 className="font-medium">Travel Assistant</h3>
            <button 
              onClick={toggleChat}
              className="text-white hover:text-gray-200 focus:outline-none p-1"
              aria-label="Close chat"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
            {messages.map(msg => {
              if (msg.isLoading) {
                return (
                  <div key={msg.id} className="mb-3">
                    <div className="inline-block px-3 py-2 rounded-lg bg-gray-200 text-gray-800">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
                      </div>
                    </div>
                  </div>
                );
              }
              
              return (
                <div 
                  key={msg.id} 
                  className={`mb-3 ${msg.isUser ? 'text-right' : ''}`}
                >
                  <div 
                    className={`inline-block px-3 py-2 rounded-lg max-w-[80%]
                      ${msg.isUser 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-800'}`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 border-t">
            <div className="flex">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about places to visit or things to do..."
                className="flex-1 border rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows="2"
                disabled={isGenerating}
              />
              <button 
                onClick={handleSendMessage}
                disabled={isGenerating || message.trim() === ''}
                className={`bg-blue-600 text-white px-4 py-2 rounded-r-lg 
                  ${isGenerating || message.trim() === '' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'} 
                  focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={toggleChat}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all flex items-center justify-center transform hover:scale-110"
          style={{ width: '5rem', height: '5rem' }}
          aria-label="Open chat"
        >
          <div style={{ width: '4rem', height: '4rem' }}>
            <AnimatedCircle isGenerating={isGenerating} isClicked={isClicked} />
          </div>
        </button>
      )}
    </div>
  );
};

export default FloatingChatButton; 