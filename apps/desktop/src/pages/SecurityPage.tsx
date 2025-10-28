import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';
import { startMsrListener, stopMsrListener } from '../lib/msr';
import { parseMsrSwipe } from '../lib/msr-parse';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export function SecurityPage() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [enrollUserId, setEnrollUserId] = useState<string>('');
  const [enrolling, setEnrolling] = useState(false);

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
    } catch (error: any) {
      console.error('Registration error:', error);
      setStatus(`❌ Registration failed: ${error.message || error.name}`);
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

  const handleCaptureNextSwipe = () => {
    if (!enrollUserId.trim()) {
      setStatus('⚠ Enter User ID first');
      return;
    }

    setEnrolling(true);
    setStatus('🎫 Swipe badge now...');

    startMsrListener(async (raw) => {
      stopMsrListener();

      const parsed = parseMsrSwipe(raw);

      if (parsed.type === 'rejected') {
        setStatus(`🚫 ${parsed.reason}`);
        setEnrolling(false);
        return;
      }

      const badgeCode = parsed.code;
      setStatus(`Enrolling badge ${badgeCode}...`);

      try {
        const token = getAuthToken();
        if (!token) {
          setStatus('❌ Please log in first (L4+ required)');
          setEnrolling(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/auth/enroll-badge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: enrollUserId.trim(), badgeId: badgeCode }),
        });

        if (!res.ok) {
          const err = await res.json();
          setStatus(`❌ Enrollment failed: ${err.message || res.statusText}`);
          setEnrolling(false);
          return;
        }

        setStatus(`✅ Badge ${badgeCode} enrolled for user ${enrollUserId}`);
        setEnrollUserId('');
      } catch (error) {
        setStatus(`❌ Enrollment error: ${(error as Error).message}`);
      } finally {
        setEnrolling(false);
      }
    });
  };

  const handleCancelEnrollment = () => {
    stopMsrListener();
    setEnrolling(false);
    setStatus('Enrollment cancelled');
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

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #ddd' }} />

      <h2>Badge Enrollment (L4+ Only)</h2>
      <p>Assign a badge to a user. Only managers and admins can perform this operation.</p>

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label>
          User ID:
          <input
            type="text"
            value={enrollUserId}
            onChange={(e) => setEnrollUserId(e.target.value)}
            disabled={enrolling}
            placeholder="e.g., user-123"
            style={{
              marginLeft: '0.5rem',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleCaptureNextSwipe}
            disabled={enrolling}
            style={{
              padding: '1rem',
              fontSize: '1rem',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: enrolling ? 'not-allowed' : 'pointer',
            }}
          >
            {enrolling ? '⏳ Listening...' : '🎫 Capture Next Swipe'}
          </button>

          {enrolling && (
            <button
              onClick={handleCancelEnrollment}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ❌ Cancel
            </button>
          )}
        </div>
      </div>

      {status && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor:
              status.startsWith('❌') || status.startsWith('🚫') ? '#f8d7da' : '#d4edda',
            color: status.startsWith('❌') || status.startsWith('🚫') ? '#721c24' : '#155724',
            borderRadius: '4px',
          }}
        >
          {status}
        </div>
      )}

      <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#666' }}>
        <h3>About MSR Badges</h3>
        <ul>
          <li>Badges must use the format: CLOUDBADGE:&lt;CODE&gt;</li>
          <li>Payment card data (Track 1/2 formats) is automatically rejected</li>
          <li>Badge enrollment requires L4+ role (Manager, Accountant, Owner, Admin)</li>
          <li>Each badge can only be assigned to one user</li>
          <li>Badge login is instant and does not require password entry</li>
        </ul>
      </div>

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #ddd' }} />

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
