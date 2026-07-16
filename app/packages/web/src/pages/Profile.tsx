import React, { useState } from 'react';
import { useSessionStore } from '../store/session';
import { apiFetch } from '../lib/apiFetch';
import { Shield, Save, Upload } from 'lucide-react';

export function Profile() {
  const { user, setUser } = useSessionStore();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // General Profile State
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await apiFetch('http://localhost:3000/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const data = await res.json();
      setUser({ ...user!, name: data.name, email: data.email });
      setMessage('Profile updated successfully');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    setMessage('');
    setError('');

    try {
      const res = await apiFetch('http://localhost:3000/users/profile-picture', {
        method: 'POST',
        headers: {}, // Let browser set boundary for FormData
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload picture');
      const data = await res.json();
      setUser({ ...user!, avatarUrl: data.avatarUrl });
      setMessage('Profile picture updated');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
      </div>

      {message && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="space-y-8">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-gray-100 dark:border-gray-700" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary/20 text-primary flex items-center justify-center text-3xl font-bold border-4 border-gray-100 dark:border-gray-700">
                      {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Upload className="w-6 h-6" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                  </label>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Profile Picture</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Upload a new avatar. Max size 5MB.</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <button type="submit" className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </form>
            </div>
        </div>
      </div>
    </div>
  );
}
