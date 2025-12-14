import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  database?: {
    status: string;
    latency?: number;
  };
  redis?: {
    status: string;
    latency?: number;
  };
  version?: string;
  environment?: string;
  [key: string]: any;
}

export default function HealthPage() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setStatusCode(null);

    try {
      const res = await apiClient.get<HealthResponse>('/api/health');
      setResponse(res.data);
      setStatusCode(res.status);
      setLastChecked(new Date());
    } catch (err: any) {
      setError(err.message || 'Health check failed');
      setStatusCode(err.response?.status || null);
      
      // Try to extract response data if available
      if (err.response?.data) {
        setResponse(err.response.data);
      }
      
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-check on mount
    checkHealth();
  }, []);

  const getStatusColor = () => {
    if (!statusCode) return 'text-gray-500';
    if (statusCode >= 200 && statusCode < 300) return 'text-green-600';
    if (statusCode >= 400 && statusCode < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = () => {
    if (!statusCode) return 'bg-gray-500';
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-500';
    if (statusCode >= 400 && statusCode < 500) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <AppShell>
      <PageHeader
        title="Backend Health Check"
        subtitle="Test connectivity and status of the backend API"
        actions={
          <Button
            onClick={checkHealth}
            disabled={loading}
            size="sm"
          >
            {loading ? 'Checking...' : 'Refresh'}
          </Button>
        }
      />

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Connection Info */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Connection Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Backend URL:</span>
              <span className="font-mono">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Endpoint:</span>
              <span className="font-mono">/api/health</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auth Method:</span>
              <span>Cookie-based (withCredentials: true)</span>
            </div>
            {lastChecked && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Checked:</span>
                <span>{lastChecked.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Status Card */}
        {(statusCode !== null || error) && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-3 h-3 rounded-full ${getStatusBadge()}`} />
              <h2 className="text-lg font-semibold">
                {statusCode ? `HTTP ${statusCode}` : 'Connection Error'}
              </h2>
            </div>

            {error && !response && (
              <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            )}

            {response && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Response Data</p>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto text-xs font-mono max-h-96">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {response.status && (
                    <div className="bg-slate-50 rounded p-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className={`text-sm font-semibold ${getStatusColor()}`}>
                        {response.status}
                      </p>
                    </div>
                  )}
                  {response.uptime !== undefined && (
                    <div className="bg-slate-50 rounded p-3">
                      <p className="text-xs text-muted-foreground">Uptime</p>
                      <p className="text-sm font-semibold">
                        {Math.floor(response.uptime / 60)}m
                      </p>
                    </div>
                  )}
                  {response.database?.status && (
                    <div className="bg-slate-50 rounded p-3">
                      <p className="text-xs text-muted-foreground">Database</p>
                      <p className={`text-sm font-semibold ${
                        response.database.status === 'ok' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {response.database.status}
                        {response.database.latency && ` (${response.database.latency}ms)`}
                      </p>
                    </div>
                  )}
                  {response.redis?.status && (
                    <div className="bg-slate-50 rounded p-3">
                      <p className="text-xs text-muted-foreground">Redis</p>
                      <p className={`text-sm font-semibold ${
                        response.redis.status === 'ok' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {response.redis.status}
                        {response.redis.latency && ` (${response.redis.latency}ms)`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Instructions */}
        {!statusCode && !loading && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">What This Page Does</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Tests connectivity to the backend API</li>
              <li>✓ Verifies cookie-based authentication is working</li>
              <li>✓ Shows backend health status, uptime, and dependencies</li>
              <li>✓ Displays database and Redis connection status</li>
              <li>✓ Helps diagnose production deployment issues</li>
            </ul>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
