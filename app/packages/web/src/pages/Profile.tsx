import React, { useState } from 'react';
import { useSessionStore } from '../store/session';
import { apiFetch } from '../lib/apiFetch';
import { Shield, Save, Upload, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Modal } from '../components/Modal';
import { deriveKey } from '@app/shared/src/crypto';

export function Profile() {
  const { user, setUser, privateKey } = useSessionStore();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Organization State
  const [organizationName, setOrganizationName] = useState(user?.organizationName || '');
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email !== user?.email) {
      setIsConfirmModalOpen(true);
      return;
    }
    submitProfileUpdate();
  };

  const submitProfileUpdate = async (encryptedPrivateKey?: string) => {
    setMessage('');
    setError('');
    setIsSubmitting(true);
    try {
      const payload: any = { name, email };
      if (encryptedPrivateKey) {
        payload.encryptedPrivateKey = encryptedPrivateKey;
      }
      const res = await apiFetch('http://localhost:3000/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const data = await res.json();
      setUser({ ...user!, name: data.name, email: data.email });
      setMessage('Profile updated successfully');
      setIsConfirmModalOpen(false);
      setMasterPassword('');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMasterPassword = async () => {
    if (!masterPassword) return;
    setError('');
    setIsSubmitting(true);
    try {
      if (!privateKey) throw new Error("Private key not found in session.");
      
      const newDerivedKey = await deriveKey(masterPassword, email);
      
      const pkcs8 = await window.crypto.subtle.exportKey('pkcs8', privateKey);
      const privateKeyBytes = new Uint8Array(pkcs8);

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedPkcs8 = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        newDerivedKey,
        privateKeyBytes
      );
      
      const ivBlob = btoa(String.fromCharCode(...iv));
      const dataBlob = btoa(String.fromCharCode(...new Uint8Array(encryptedPkcs8)));
      const newEncryptedPrivateKey = `${ivBlob}:${dataBlob}`;

      await submitProfileUpdate(newEncryptedPrivateKey);
    } catch (err: any) {
      console.error(err);
      setError("Failed to re-encrypt vault. Make sure the master password is correct.");
      setIsSubmitting(false);
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

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsSubmittingOrg(true);
    try {
      const res = await apiFetch('http://localhost:3000/users/organization/name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: organizationName }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Failed to update organization');
      }
      const data = await res.json();
      setUser({ ...user!, organizationName: data.name });
      setMessage('Organization updated successfully');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmittingOrg(false);
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
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

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-6">
          <div className="space-y-8">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-muted" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary/20 text-primary flex items-center justify-center text-3xl font-bold border-4 border-muted">
                      {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Upload className="w-6 h-6" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                  </label>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">Profile Picture</h3>
                  <p className="text-sm text-muted-foreground">Upload a new avatar. Max size 5MB.</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  <Save className="w-4 h-4 mr-2" /> {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </div>
        </div>
      </div>

      {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Organization Settings</h3>
            <form onSubmit={handleUpdateOrganization} className="space-y-4 max-w-md">
              <div className="space-y-1">
                <Label>Organization Name</Label>
                <Input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={isSubmittingOrg}>
                <Save className="w-4 h-4 mr-2" /> {isSubmittingOrg ? 'Saving...' : 'Save Organization'}
              </Button>
            </form>
          </div>
        </div>
      )}

      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Confirm Master Password">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Changing your email address requires re-encrypting your vault. Please enter your Master Password to proceed.
          </p>
          <div className="space-y-1">
            <Label>Master Password</Label>
            <div className="relative">
              <Input
                type={showMasterPassword ? "text" : "password"}
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Enter master password"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowMasterPassword(!showMasterPassword)} className="absolute inset-y-0 right-3 flex items-center justify-center text-muted-foreground hover:text-foreground">
                {showMasterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmMasterPassword} disabled={!masterPassword || isSubmitting}>
              {isSubmitting ? 'Encrypting...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
