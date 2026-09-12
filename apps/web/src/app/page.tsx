'use client'; // This directive tells Next.js to render this component on the client side

import { useEffect, useState } from 'react';

export default function Home() {
  // State to hold the backend status, loading state, and any errors
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Native fetch call to our Express backend
    fetch('http://localhost:4000/health')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then((data) => {
        setStatus(data.status); // Should be "ok"
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []); // Empty dependency array means this runs once when the component mounts

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50 text-gray-900">
      <div className="p-8 bg-white rounded-lg shadow-md max-w-sm w-full text-center border border-gray-100">
        <h1 className="text-2xl font-bold mb-4">IntervAI Setup</h1>
        
        {loading && <p className="text-gray-500 animate-pulse">Connecting to backend...</p>}
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md">
            <p className="font-medium">Connection Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}
        
        {status && (
          <div className="bg-green-50 text-green-700 p-4 rounded-md border border-green-200">
            <p className="font-semibold text-lg">Backend is connected!</p>
            <p className="text-sm mt-1">Status: {status}</p>
          </div>
        )}
      </div>
    </main>
  );
}
