export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>ChefCloud Web</h1>
      <p>Enterprise-grade POS for restaurants and bars in Uganda</p>
      <div style={{ marginTop: '2rem' }}>
        <h2>API Routes:</h2>
        <ul>
          <li>
            <a href="/api/health" target="_blank" rel="noopener noreferrer">
              /api/health
            </a>
          </li>
          <li>
            <a href="/api/version" target="_blank" rel="noopener noreferrer">
              /api/version
            </a>
          </li>
        </ul>
      </div>
    </main>
  );
}
