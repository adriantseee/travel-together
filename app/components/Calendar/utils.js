'use client';

// Generate a consistent color based on user ID, email or name
export const getUserColor = (str) => {
  const colors = [
    'bg-blue-500 text-white',
    'bg-green-500 text-white',
    'bg-purple-500 text-white',
    'bg-yellow-500 text-gray-900',
    'bg-pink-500 text-white',
    'bg-indigo-500 text-white',
    'bg-red-500 text-white',
    'bg-teal-500 text-white',
    'bg-orange-500 text-white',
    'bg-cyan-500 text-white',
  ];
  
  // Simple hash function
  let hash = 0;
  const string = (str || '').toString();
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  hash = Math.abs(hash);
  return colors[hash % colors.length];
}; 