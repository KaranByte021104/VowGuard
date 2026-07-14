import { useState } from 'react';
import { Shield, Smartphone, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

export function SecuritySettings() {

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetupMfa = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('http://localhost:3000/auth/mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to setup MFA');
      const data = await res.json();
      setQrCode(data.qrCode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('http://localhost:3000/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token })
      });
      if (!res.ok) throw new Error('Invalid MFA token');
      setSuccess('MFA has been successfully enabled on your account!');
      setQrCode(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Security Settings</h2>
          <p className="text-gray-500 dark:text-gray-400">Manage your account security and two-factor authentication.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Multi-Factor Authentication (MFA)</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
              Protect your account by requiring an additional layer of security. We support TOTP authenticator apps like Google Authenticator or Authy.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4" />
                {success}
              </div>
            )}

            {!qrCode && !success && (
              <button
                onClick={handleSetupMfa}
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Setup MFA'}
              </button>
            )}

            {qrCode && !success && (
              <div className="mt-6 border dark:border-gray-700 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">1. Scan this QR code</h4>
                <div className="bg-white p-4 inline-block rounded-lg mb-6">
                  <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
                </div>
                
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">2. Enter verification code</h4>
                <form onSubmit={handleVerifyMfa} className="flex gap-3">
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={loading || token.length !== 6}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Verify & Enable
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
