'use client';

import { useState, useEffect } from 'react';
import { getUserColor } from './utils';

export default function ShareModal({ isOpen, onClose, trip, onShareToCommunity, onShareWithUsers }) {
  const [isPublic, setIsPublic] = useState(trip?.isPublic || false);
  const [email, setEmail] = useState('');
  const [emailList, setEmailList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (trip) {
      setIsPublic(trip.isPublic || false);
    }
  }, [trip]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Submitting share form with:', { isPublic, emailList });
    
    // Update community status if changed
    if (isPublic !== trip.isPublic) {
      console.log('Updating community status to:', isPublic);
      onShareToCommunity(isPublic);
    }
    
    // Share with added emails
    if (emailList.length > 0) {
      setIsSubmitting(true);
      console.log('Sharing with emails:', emailList);
      try {
        await onShareWithUsers(emailList);
        setEmailList([]);
        setEmail('');
      } catch (error) {
        console.error('Error sharing with users:', error);
        setError('Failed to share with some users. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
    
    onClose();
  };

  const addEmail = () => {
    if (!email) return;
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Check if email already in list
    if (emailList.includes(email)) {
      setError('This email is already in the list');
      return;
    }
    
    setEmailList(prev => [...prev, email]);
    setEmail('');
    setError('');
  };

  const removeEmail = (emailToRemove) => {
    setEmailList(prev => prev.filter(e => e !== emailToRemove));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[500px] max-w-full shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Share Trip</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Community post toggle */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Make Public in Community</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Others can see and copy your itinerary, but not edit it
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={isPublic}
                  onChange={() => setIsPublic(!isPublic)}
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            {/* Share with email */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Share with Contributors</h3>
              <p className="text-xs text-gray-500 mb-3">
                They'll be able to view and edit this trip
              </p>
              
              <div className="flex gap-2 mb-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={addEmail}
                  className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  Add
                </button>
              </div>
              
              {error && (
                <p className="text-xs text-red-500 mb-2">{error}</p>
              )}
              
              {/* Email list */}
              {emailList.length > 0 && (
                <div className="mt-3 border border-gray-200 rounded-md p-2 max-h-[150px] overflow-y-auto">
                  <ul className="space-y-1">
                    {emailList.map((email, index) => (
                      <li 
                        key={index} 
                        className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50"
                      >
                        <div className="flex items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${getUserColor(email)}`}>
                            {email.charAt(0).toUpperCase()}
                          </div>
                          <span className="ml-2 text-sm">{email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEmail(email)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 mt-6 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sharing...
                  </>
                ) : "Share"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}