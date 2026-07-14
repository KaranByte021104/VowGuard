import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { Server, ArrowRight } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

export function ConnectedApps() {
  const [apps, setApps] = useState<any[]>([]);

  useEffect(() => {
    fetchMyApps();
  }, []);

  const fetchMyApps = async () => {
    try {
      const res = await apiFetch('http://localhost:3000/sso/my-apps', { credentials: 'include' });
      const data = await res.json();
      setApps(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAppLogin = async (appId: string) => {
    try {
      const res = await apiFetch(`http://localhost:3000/sso/login/${appId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Login failed');
      const data = await res.json();
      
      // We got the signed assertion back. We need to POST it to the ACS URL.
      // We do this by dynamically creating an HTML form and submitting it.
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.acsUrl;
      
      const samlResponseInput = document.createElement('input');
      samlResponseInput.type = 'hidden';
      samlResponseInput.name = 'SAMLResponse';
      // samlify createLoginResponse already returns the base64-encoded XML string for HTTP-POST binding.
      samlResponseInput.value = data.samlResponse;
      form.appendChild(samlResponseInput);

      if (data.relayState) {
        const relayStateInput = document.createElement('input');
        relayStateInput.type = 'hidden';
        relayStateInput.name = 'RelayState';
        relayStateInput.value = data.relayState;
        form.appendChild(relayStateInput);
      }

      document.body.appendChild(form);
      form.submit();
      
    } catch (e) {
      console.error(e);
      toast.error('Failed to initiate login to the application');
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connected Apps</h1>
        <p className="text-gray-500 dark:text-gray-400">Applications you can access using your SecureVault Single Sign-On.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map(app => (
          <button key={app.id} onClick={() => handleAppLogin(app.id)} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-left hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                <Server className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{app.name}</h3>
                {app.description && <p className="text-sm text-gray-500 line-clamp-1">{app.description}</p>}
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transform group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        ))}
        {apps.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            <Server className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No applications assigned</h3>
            <p>You haven't been granted SSO access to any connected applications.</p>
          </div>
        )}
      </div>
    </div>
  );
}
