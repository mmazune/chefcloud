import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function SecurityPage() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const getAuthToken = (): string | null => {
    return localStorage.getItem('authToken');
  };

  const handleRegisterPasskey = async () => {
    setLoading(true);
    setStatus('Starting passkey registration...');

    try {
      const token = getAuthToken();
      if (!token) {
        setStatus('❌ Please log in first');
        setLoading(false);
        return;
      }

      // 1. Get registration options
      const optionsRes = await fetch(`${API_BASE_URL}/webauthn/registration/options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!optionsRes.ok) {
        throw new Error(`Failed to get options: ${optionsRes.statusText}`);
      }

      const options: PublicKeyCredentialCreationOptionsJSON = await optionsRes.json();

      setStatus('👆 Please interact with your authenticator...');

      // 2. Start registration (browser prompts for biometric/PIN)
      const attResp = await startRegistration({ optionsJSON: options });

      setStatus('Verifying...');

      // 3. Verify registration
      const verifyRes = await fetch(`${API_BASE_URL}/webauthn/registration/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ response: attResp }),
      });

      if (!verifyRes.ok) {
        throw new Error(`Verification failed: ${verifyRes.statusText}`);
      }

      setStatus('✅ Passkey registered successfully!');
    } catch (error) {
      console.error('Registration error:', error);
      setStatus(`❌ Registration failed: ${(error as Error).message || (error as Error).name}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithPasskey = async () => {
    setLoading(true);
    setStatus('Starting passkey login...');

    try {
      // For demo, we'll use a hardcoded email. In production, prompt user or use autofill.
      const email = prompt('Enter your email:');
      if (!email) {
        setStatus('Cancelled');
        setLoading(false);
        return;
      }

      // 1. Get authentication options
      const optionsRes = await fetch(`${API_BASE_URL}/webauthn/authentication/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!optionsRes.ok) {
        throw new Error(`Failed to get options: ${optionsRes.statusText}`);
      }

      const options: PublicKeyCredentialRequestOptionsJSON = await optionsRes.json();

      setStatus('👆 Please interact with your authenticator...');

      // 2. Start authentication
      const assertionResp = await startAuthentication({ optionsJSON: options });

      setStatus('Verifying...');

      // 3. Verify authentication
      const verifyRes = await fetch(`${API_BASE_URL}/webauthn/authentication/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertionResp }),
      });

      if (!verifyRes.ok) {
        throw new Error(`Verification failed: ${verifyRes.statusText}`);
      }

      const data = await verifyRes.json();

      // Store JWT token
      localStorage.setItem('authToken', data.token);

      setStatus(`✅ Logged in as ${data.user.email}`);
    } catch (error) {
      console.error('Authentication error:', error);
      setStatus(`❌ Login failed: ${(error as Error).message || (error as Error).name}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Security Settings</h1>
      <p>Manage your passkeys for secure, passwordless authentication.</p>

      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <button
          onClick={handleRegisterPasskey}
          disabled={loading}
          style={{
            padding: '1rem',
            fontSize: '1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Working...' : '🔑 Register Passkey'}
        </button>

        <button
          onClick={handleLoginWithPasskey}
          disabled={loading}
          style={{
            padding: '1rem',
            fontSize: '1rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Working...' : '🔓 Login with Passkey'}
        </button>
      </div>

      {status && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: status.startsWith('❌') ? '#f8d7da' : '#d4edda',
            color: status.startsWith('❌') ? '#721c24' : '#155724',
            borderRadius: '4px',
          }}
        >
          {status}
        </div>
      )}

      <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#666' }}>
        <h3>About Passkeys</h3>
        <ul>
          <li>Passkeys use biometric authentication (Face ID, Touch ID, Windows Hello, etc.)</li>
          <li>More secure than passwords - resistant to phishing</li>
          <li>Only available for L3+ users (Chef, Manager, Stock, Admin)</li>
          <li>You must be logged in with a password first to register a passkey</li>
        </ul>
      </div>
    </div>
  );
}
