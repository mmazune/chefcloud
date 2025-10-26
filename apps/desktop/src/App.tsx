import { useState } from 'react';
import { colors } from '@chefcloud/ui';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="container">
      <h1>Hello ChefCloud</h1>
      <p style={{ color: colors.chefBlue }}>
        Desktop POS Terminal - Offline-first architecture
      </p>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
      <p className="version">v0.1.0</p>
    </div>
  );
}

export default App;
