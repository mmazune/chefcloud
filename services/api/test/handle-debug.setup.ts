/**
 * E2E Handle Debug Tool - OPT-IN ONLY
 * 
 * Enable via: E2E_HANDLE_DEBUG=1 pnpm test:e2e ...
 * 
 * Dumps active handles and requests at end of test run to help identify leaks
 * Uses setupFilesAfterEnv to hook into Jest lifecycle
 */

if (process.env.E2E_HANDLE_DEBUG === '1') {
  // Hook into Jest's afterAll at the global level
  afterAll(async () => {
    // Small delay to let pending operations complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    console.log('\n━━━ E2E HANDLE DEBUG ━━━');
    
    try {
      // Set timeout for handle enumeration itself
      const timeout = setTimeout(() => {
        console.warn('⚠️  Handle enumeration timed out after 5s - dumping partial results');
      }, 5000);
      
      // Get active handles and requests
      const handles = (process as any)._getActiveHandles?.() || [];
      const requests = (process as any)._getActiveRequests?.() || [];
      
      clearTimeout(timeout);
      
      console.log(`\n📊 Active Handles: ${handles.length}`);
      console.log(`📊 Active Requests: ${requests.length}`);
      
      // Count handles by constructor name
      const handleTypes = new Map<string, number>();
      for (const handle of handles) {
        const type = handle?.constructor?.name || 'Unknown';
        handleTypes.set(type, (handleTypes.get(type) || 0) + 1);
      }
      
      // Print top 10 handle types
      console.log('\n🔍 Top 10 Handle Types:');
      const sorted = Array.from(handleTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      for (const [type, count] of sorted) {
        console.log(`  ${count}x ${type}`);
      }
      
      // Sample first 3 handles for detailed inspection
      console.log('\n🔬 Sample Handles (first 3):');
      for (let i = 0; i < Math.min(3, handles.length); i++) {
        const handle = handles[i];
        const details: any = {
          hasRef: typeof handle?.hasRef === 'function' ? handle.hasRef() : 'N/A',
          domain: handle?.domain?.constructor?.name || 'none',
        };
        
        // Try to extract connection info from socket
        if (handle?.remoteAddress) details.remoteAddress = handle.remoteAddress;
        if (handle?.remotePort) details.remotePort = handle.remotePort;
        if (handle?.localAddress) details.localAddress = handle.localAddress;
        if (handle?.localPort) details.localPort = handle.localPort;
        if (handle?._host) details._host = handle._host;
        if (handle?._port) details._port = handle._port;
        
        // Dump all properties to see what we're dealing with
        console.log(`  [${i}] ${handle?.constructor?.name}:`, details);
        console.log(`  [${i}] All properties:`, Object.keys(handle || {}).slice(0, 20));
      }
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error) {
      console.error('❌ Handle dump failed:', error);
    }
  });
  
  console.log('✓ E2E_HANDLE_DEBUG enabled - will dump handles at end of run');
}
