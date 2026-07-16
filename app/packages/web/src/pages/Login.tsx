import toast from 'react-hot-toast';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { deriveKey, decryptPrivateKey, importPublicKey } from '@app/shared/src/crypto';
import { useSessionStore } from '../store/session';
import { apiFetch } from '../lib/apiFetch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    loginPassword: '',
    masterPassword: '',
    mfaToken: '',
    resetToken: '',
    newPassword: '',
  });
  const [encryptedPrivateKey, setEncryptedPrivateKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [tempToken, setTempToken] = useState('');

  const [userPayload, setUserPayload] = useState<any>(null);
  const { setKeys, setUser } = useSessionStore();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email,
          loginPassword: formData.loginPassword,
        }),
      });

      if (!response.ok) {
        let errStr = 'Invalid credentials';
        try {
          const errData = await response.json();
          errStr = errData.message || errStr;
        } catch(e) {}
        throw new Error(errStr);
      }

      const data = await response.json();
      
      if (data.mfaRequired) {
        setTempToken(data.tempToken);
        setStep(1.5);
      } else {
        setEncryptedPrivateKey(data.user.encryptedPrivateKey);
        setUserPayload(data.user);
        setStep(2); // Move to master password unlock
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('http://localhost:3000/auth/login/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tempToken,
          token: formData.mfaToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Invalid MFA token');
      }

      const data = await response.json();
      setEncryptedPrivateKey(data.user.encryptedPrivateKey);
      setUserPayload(data.user);
      setStep(2); // Move to master password unlock
    } catch (err: any) {
      setError(err.message || 'MFA validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Base64 to ArrayBuffer helper
      const base64ToArrayBuffer = (base64: string) => {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      };

      const parts = encryptedPrivateKey.split(':');
      if (parts.length !== 2) throw new Error('Invalid encrypted key format');
      
      const iv = new Uint8Array(base64ToArrayBuffer(parts[0]));
      const data = base64ToArrayBuffer(parts[1]);

      const derivedKey = await deriveKey(formData.masterPassword, formData.email);
      
      // Decrypt locally - if wrong password, this fails. No server round-trip.
      const privateKey = await decryptPrivateKey(data, iv, derivedKey);
      
      console.log('Successfully unlocked private key:', privateKey);
      // In a real app, store this in session memory (Zustand)
      if (userPayload?.publicKey) {
        const spkiBuffer = base64ToArrayBuffer(userPayload.publicKey);
        const publicKey = await importPublicKey(spkiBuffer);
        setKeys(privateKey, publicKey);
        setUser(userPayload);
      }
      
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError('Incorrect Master Password');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await apiFetch('http://localhost:3000/auth/reset-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      if (!res.ok) throw new Error('Failed to request reset');
      toast.error('If the email exists, a reset link has been sent to your inbox.');
      setStep(4); // Move to token entry
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('http://localhost:3000/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          token: formData.resetToken,
          newPassword: formData.newPassword
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to reset password');
      }
      
      toast.success('Password reset successfully. You can now log in.');
      setStep(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Shield className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-6 text-3xl font-extrabold text-foreground">
          {step === 1 ? 'Sign in to VowGuard' : step === 1.5 ? 'Two-Factor Authentication' : step === 2 ? 'Unlock VowGuard' : step === 3 ? 'Reset Password' : 'New Password'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow-sm border border-border sm:rounded-xl sm:px-10">
          <form className="space-y-6" onSubmit={step === 1 ? handleLoginSubmit : step === 1.5 ? handleMfaSubmit : handleUnlockSubmit}>
            {error && <div className="text-destructive text-sm bg-destructive/10 p-3 rounded">{error}</div>}
            
            {step === 1 ? (
              <>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input name="email" type="email" value={formData.email} required onChange={handleChange} />
                </div>
                <div className="space-y-1 relative">
                  <div className="flex items-center justify-between">
                    <Label>Login Password</Label>
                    <button type="button" onClick={() => setStep(3)} className="text-sm font-medium text-primary hover:underline">
                      Forgot Password?
                    </button>
                  </div>
                  <Input name="loginPassword" value={formData.loginPassword} type={showLoginPassword ? "text" : "password"} required className="pr-10" onChange={handleChange} />
                  <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute bottom-2 right-3 flex items-center text-muted-foreground hover:text-foreground">
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => navigate('/signup')} className="font-medium text-primary hover:underline">
                    Sign up
                  </button>
                </div>
              </>
            ) : step === 1.5 ? (
              <>
                <div className="space-y-1">
                  <Label>Authenticator Code</Label>
                  <Input name="mfaToken" type="text" placeholder="000000" maxLength={6} value={formData.mfaToken} required className="text-center text-lg tracking-widest font-mono" onChange={handleChange} />
                </div>
                <Button type="submit" disabled={loading || formData.mfaToken.length !== 6} className="w-full">
                  {loading ? 'Verifying...' : 'Verify'}
                </Button>
                <div className="mt-4 text-center">
                  <button type="button" onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground">
                    Back to Login
                  </button>
                </div>
              </>
            ) : step === 2 ? (
              <>
                <div className="space-y-1 relative">
                  <Label>Master Password</Label>
                  <Input name="masterPassword" value={formData.masterPassword} type={showMasterPassword ? "text" : "password"} required className="pr-10" onChange={handleChange} />
                  <button type="button" onClick={() => setShowMasterPassword(!showMasterPassword)} className="absolute bottom-2 right-3 flex items-center text-muted-foreground hover:text-foreground">
                    {showMasterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Unlocking...' : 'Unlock VowGuard'}
                </Button>
              </>
            ) : step === 3 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">Enter your email address and we'll send you a link to reset your password.</p>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input name="email" type="email" value={formData.email} required onChange={handleChange} />
                </div>
                <Button type="button" onClick={handleForgotPassword} disabled={loading} className="w-full">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <div className="mt-4 text-center">
                  <button type="button" onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground">
                    Back to Login
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">Check your email for the reset token and enter your new login password.</p>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input name="email" type="email" value={formData.email} required className="bg-muted" readOnly />
                </div>
                <div className="space-y-1">
                  <Label>Reset Token</Label>
                  <Input name="resetToken" type="text" value={formData.resetToken} required className="font-mono text-sm" onChange={handleChange} placeholder="Paste your 64-character token here" />
                </div>
                <div className="space-y-1 relative">
                  <Label>New Login Password</Label>
                  <Input name="newPassword" value={formData.newPassword} type={showLoginPassword ? "text" : "password"} required className="pr-10" onChange={handleChange} />
                  <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute bottom-2 right-3 flex items-center text-muted-foreground hover:text-foreground">
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" onClick={handleResetPassword} disabled={loading} className="w-full">
                  {loading ? 'Resetting...' : 'Confirm New Password'}
                </Button>
                <div className="mt-4 text-center">
                  <button type="button" onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground">
                    Back to Login
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
