import React, { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const mockStatuses = [
  { id: 1, user: "Alice", time: "2 hours ago", viewed: false },
  { id: 2, user: "Bob", time: "1 hour ago", viewed: false },
  { id: 3, user: "Charlie", time: "30 minutes ago", viewed: false },
];

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [statuses, setStatuses] = useState(mockStatuses);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!phoneNumber.match(/^\+[1-9]\d{10,14}$/)) {
      toast.error('Please enter a valid phone number with country code');
      return;
    }
    toast.success('Successfully connected!');
    setIsLoggedIn(true);
  };

  const markAsRead = (id) => {
    setStatuses(statuses.map(status => 
      status.id === id ? { ...status, viewed: true } : status
    ));
    toast.success('Status marked as read');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 bg-white p-6 rounded-xl shadow-lg">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              WhatsApp Status Reader
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number (with country code)
              </label>
              <input
                id="phone"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="+1234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Connect
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Status Updates
            </h3>
            <div className="space-y-4">
              {statuses.map((status) => (
                <div
                  key={status.id}
                  className="flex items-center justify-between bg-gray-50 p-4 rounded-lg"
                >
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{status.user}</h4>
                    <p className="text-sm text-gray-500">{status.time}</p>
                  </div>
                  {status.viewed ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                  ) : (
                    <button
                      onClick={() => markAsRead(status.id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;