import { useState } from 'react';
import { colors } from '@chefcloud/ui';
import { IdleScreensaver } from './components/IdleScreensaver';
import { testPrint } from './lib/printer-client';

function App() {
  const [count, setCount] = useState(0);

  // Get timeout from env or default to 120000ms (120s)
  const idleTimeout = 120000; // Configurable via env in production

  return (
    <>
      <IdleScreensaver timeout={idleTimeout} />
      <div className="container">
        <h1>Hello ChefCloud</h1>
        <p style={{ color: colors.chefBlue }}>
          Desktop POS Terminal - Offline-first architecture
        </p>
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
          <button onClick={testPrint} style={{ marginLeft: '10px' }}>
            Test Print
          </button>
        </div>
        <p className="version">v0.1.0</p>
      </div>
    </>
  );
}

export default App;
