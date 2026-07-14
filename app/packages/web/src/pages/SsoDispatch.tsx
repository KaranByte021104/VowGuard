import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { apiFetch } from '../lib/apiFetch';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';

export function SsoDispatch() {
  const [searchParams] = useSearchParams();
  const { user } = useSessionStore();
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;

    if (!user) {
      // Need to login first
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    const orgId = searchParams.get('orgId');
    const SAMLRequest = searchParams.get('SAMLRequest');
    const RelayState = searchParams.get('RelayState');

    if (!orgId || !SAMLRequest) {
       toast.error('Invalid SSO request');
       navigate('/');
       return;
    }

    processed.current = true;

    apiFetch(`http://localhost:3000/sso/login-sp/${orgId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ SAMLRequest, RelayState }),
      credentials: 'include'
    })
    .then(async res => {
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'SSO failed');
      }
      return res.json();
    })
    .then(data => {
       if (data.samlResponse) {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = data.acsUrl;

          const samlInput = document.createElement('input');
          samlInput.type = 'hidden';
          samlInput.name = 'SAMLResponse';
          samlInput.value = data.samlResponse;
          form.appendChild(samlInput);

          if (data.relayState) {
            const relayInput = document.createElement('input');
            relayInput.type = 'hidden';
            relayInput.name = 'RelayState';
            relayInput.value = data.relayState;
            form.appendChild(relayInput);
          }

          document.body.appendChild(form);
          form.submit();
       }
    })
    .catch(err => {
        toast.error(err.message);
        navigate('/');
    });
  }, [user, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
         <Shield className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
         <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Authenticating...</h2>
         <p className="text-gray-500 mt-2">Please wait while we log you into the application securely.</p>
      </div>
    </div>
  );
}
