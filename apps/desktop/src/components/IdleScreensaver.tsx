import { useEffect, useState } from 'react';
import './IdleScreensaver.css';

interface IdleScreensaverProps {
  timeout?: number; // in milliseconds
}

export function IdleScreensaver({ timeout = 120000 }: IdleScreensaverProps) {
  const [isIdle, setIsIdle] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    const resetIdleTimer = () => {
      setLastActivity(Date.now());
      setIsIdle(false);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach((event) => {
      document.addEventListener(event, resetIdleTimer, true);
    });

    const interval = setInterval(() => {
      if (Date.now() - lastActivity > timeout) {
        setIsIdle(true);
      }
    }, 1000);

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, resetIdleTimer, true);
      });
      clearInterval(interval);
    };
  }, [lastActivity, timeout]);

  if (!isIdle) return null;

  return (
    <div className="screensaver-overlay" onClick={() => setIsIdle(false)}>
      <div className="screensaver-content">
        <div className="logo-container">
          <div className="restaurant-logo">
            <div className="placeholder-logo">🍽️</div>
            <h1>Demo Restaurant</h1>
          </div>
          <div className="chefcloud-logo">
            <div className="placeholder-logo">☁️</div>
            <h2>Powered by ChefCloud</h2>
          </div>
        </div>
        <p className="tap-message">Tap anywhere to continue</p>
      </div>
    </div>
  );
}
