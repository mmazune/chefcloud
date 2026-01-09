# Redis Configuration Guide

## Overview

ChefCloud uses Redis for:
- **BullMQ Job Queues** - Background job processing (alerts, EFRIS, reports, etc.)
- **Cache Service** - Application-level caching with in-memory fallback
- **Rate Limiting** - API rate limiting and throttling
- **Session Storage** - WebAuthn and authentication state (optional)

## Environment Variables

### Recommended: REDIS_URL (All Environments)

Use `REDIS_URL` for consistent configuration across all environments:

```bash
# Development (Codespaces/Docker)
REDIS_URL=redis://redis:6379

# Development (Local without Docker)
REDIS_URL=redis://localhost:6379

# Production (Upstash example)
REDIS_URL=rediss://default:your-password@region.upstash.io:6380

# Production (Railway/Render example)
REDIS_URL=redis://default:password@hostname:6379
```

### Alternative: UPSTASH_REDIS_URL

If you're using Upstash, you can also set `UPSTASH_REDIS_URL` directly:

```bash
UPSTASH_REDIS_URL=rediss://default:your-password@region.upstash.io:6380
```

### Legacy: REDIS_HOST and REDIS_PORT (Deprecated)

**⚠️ Deprecated** - These are only used if `REDIS_URL` is not set:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Configuration Priority

The system checks for Redis configuration in this order:

1. `REDIS_URL` - Full connection URL (recommended)
2. `UPSTASH_REDIS_URL` - Upstash-specific URL
3. `REDIS_HOST` + `REDIS_PORT` - Legacy host/port config
4. **Development fallback** - `redis://redis:6379` (Codespaces) or `redis://localhost:6379` (local)
5. **Production** - Throws error if none of the above are set

## Production Requirements

### ✅ Required

- Must set `REDIS_URL` or `UPSTASH_REDIS_URL`
- Redis must be accessible and healthy
- Use secure connection (`rediss://`) when available

### ❌ Production Will Fail If

- No Redis URL is configured
- Falls back to localhost (not allowed in production)
- `NODE_ENV=production` but Redis is not available

## Development Setup

### Codespaces (Automatic)

The devcontainer automatically:
1. Starts Redis via docker-compose (`infra/docker/docker-compose.yml`)
2. Sets `REDIS_URL=redis://redis:6379` in container environment
3. Configures port forwarding for Redis (6379)

No manual configuration needed!

### Local Development (Docker)

1. Start services:
   ```bash
   cd infra/docker
   docker-compose up -d
   ```

2. Set environment variable:
   ```bash
   export REDIS_URL=redis://localhost:6379
   # Or add to .env file
   ```

### Local Development (Without Docker)

1. Install Redis:
   ```bash
   # macOS
   brew install redis
   brew services start redis

   # Ubuntu/Debian
   sudo apt-get install redis-server
   sudo systemctl start redis

   # Windows (via WSL)
   sudo apt-get install redis-server
   redis-server
   ```

2. Set environment variable:
   ```bash
   export REDIS_URL=redis://localhost:6379
   ```

## Code Organization

### Centralized Configuration

All Redis connections go through centralized config modules:

**API Service** (`services/api/src/config/redis.config.ts`):
- `getRedisUrl()` - Get Redis URL from environment
- `getRedisConnectionOptions()` - BullMQ connection options
- `createRedisClient()` - Create standalone Redis client

**Worker Service** (`services/worker/src/redis.config.ts`):
- `getRedisUrl()` - Get Redis URL from environment
- `createRedisConnection()` - Create BullMQ worker connection

**Redis Service** (`services/api/src/common/redis.service.ts`):
- Injectable NestJS service with in-memory fallback
- Used by cache service, rate limiters, etc.

### Usage Examples

#### BullMQ Queue (API)

```typescript
import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from '../config/redis.config';

const queue = new Queue('my-queue', {
  connection: getRedisConnectionOptions(),
});
```

#### BullMQ Worker (Worker Service)

```typescript
import { Worker } from 'bullmq';
import { createRedisConnection } from './redis.config';

const worker = new Worker('my-queue', async (job) => {
  // Process job
}, {
  connection: createRedisConnection(),
});
```

#### Standalone Redis Client

```typescript
import { createRedisClient } from '../config/redis.config';

const redis = createRedisClient();
await redis.set('key', 'value');
const value = await redis.get('key');
```

#### Injected Redis Service

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

@Injectable()
export class MyService {
  constructor(private redis: RedisService) {}

  async doSomething() {
    await this.redis.set('key', 'value', 60); // TTL in seconds
    const value = await this.redis.get('key');
  }
}
```

## Troubleshooting

### Error: "REDIS_URL must be set in production environment"

**Cause**: `NODE_ENV=production` but no Redis URL is configured.

**Fix**: Set `REDIS_URL` environment variable:
```bash
REDIS_URL=redis://your-redis-host:6379
```

### Error: "ECONNREFUSED ::1:6379" or "ECONNREFUSED 127.0.0.1:6379"

**Cause**: Application is trying to connect to localhost Redis which isn't running or accessible.

**Fix**:
1. **Development**: Start Redis via docker-compose: `cd infra/docker && docker-compose up -d`
2. **Production**: Set `REDIS_URL` to your production Redis instance
3. **Codespaces**: Rebuild container to apply devcontainer changes

### Redis Connection Failing, Using In-Memory Fallback

**Cause**: Redis is unreachable but application continues with in-memory storage.

**Impact**:
- ✅ Application continues to work
- ⚠️ BullMQ queues won't work (background jobs fail)
- ⚠️ Cache is not shared across instances
- ⚠️ Rate limiting is per-instance only

**Fix**:
1. Check Redis is running: `docker ps | grep redis`
2. Verify Redis URL: `echo $REDIS_URL`
3. Test connection: `redis-cli -u $REDIS_URL ping`

### Codespaces: Redis Not Starting

**Symptoms**:
- `docker-compose up -d` fails
- Redis connection errors in logs

**Fix**:
1. Rebuild devcontainer: `Cmd/Ctrl + Shift + P` → "Dev Containers: Rebuild Container"
2. Manually start Redis:
   ```bash
   cd infra/docker
   docker-compose down
   docker-compose up -d redis
   ```
3. Check logs:
   ```bash
   docker-compose logs redis
   ```

## Production Deployment

### Render.com

1. Go to Dashboard → Web Service → Environment
2. Add environment variable:
   ```
   REDIS_URL=<your-redis-url>
   ```
3. Use Render's Redis add-on or external Redis (Upstash recommended)

### Railway

1. Add Redis plugin to your project
2. Railway auto-injects `REDIS_URL`
3. Or manually set in environment variables

### Vercel (for Next.js)

1. Add to Project Settings → Environment Variables:
   ```
   REDIS_URL=<your-redis-url>
   ```
2. Recommended: Use Upstash Redis (has Vercel integration)

### Kubernetes/Docker

Add to deployment environment:

```yaml
env:
  - name: REDIS_URL
    value: "redis://redis-service:6379"
    # Or use secrets:
    valueFrom:
      secretKeyRef:
        name: redis-secret
        key: url
```

## Recommended Redis Providers

### Development
- **Local Docker** (included) - Free, fully functional
- **Redis CLI** - Installed locally via package manager

### Production
- **Upstash** - Serverless Redis, generous free tier, great for small projects
  - Auto-scales, pay-per-request
  - Built-in TLS
  - Global replication available
  
- **Railway** - Simple setup, integrated with Railway deployments
  - Easy to provision
  - Includes monitoring

- **Render Redis** - Managed Redis on Render
  - Same infrastructure as your app
  - Simple provisioning

- **Redis Cloud** - Official managed Redis
  - Enterprise features available
  - High availability options

## Monitoring

### Health Check

The API includes Redis health status in `/health` endpoint:

```bash
curl http://localhost:3001/health
```

Response includes:
```json
{
  "status": "healthy",
  "checks": {
    "redis": "connected"  // or "disconnected"
  }
}
```

### Logs

Watch for Redis connection logs:

```bash
# API logs
pnpm --filter @chefcloud/api dev | grep -i redis

# Worker logs
pnpm --filter @chefcloud/worker dev | grep -i redis
```

Expected startup logs:
```
[RedisService] Redis connected to redis://redis:6379
[redis-config] No REDIS_URL set, using development fallback: redis://localhost:6379
```

## Security Best Practices

1. **Always use TLS in production** (`rediss://` protocol)
2. **Use strong passwords** for Redis AUTH
3. **Restrict network access** - Redis should not be publicly accessible
4. **Use environment variables** - Never commit Redis URLs to git
5. **Rotate credentials** regularly in production
6. **Enable Redis ACLs** for fine-grained access control (Redis 6+)

## Migration from Legacy Config

If you have code using `REDIS_HOST` and `REDIS_PORT`:

### Before (Deprecated)
```typescript
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});
```

### After (Recommended)
```typescript
import { createRedisClient } from '../config/redis.config';

const redis = createRedisClient();
```

Or for BullMQ:

### Before (Deprecated)
```typescript
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});
```

### After (Recommended)
```typescript
import { getRedisConnectionOptions } from '../config/redis.config';

const queue = new Queue('my-queue', {
  connection: getRedisConnectionOptions(),
});
```

## Support

For issues or questions:
1. Check this guide first
2. Review application logs for Redis connection errors
3. Verify environment variables are set correctly
4. Test Redis connectivity: `redis-cli -u $REDIS_URL ping`
5. Check docker-compose status: `docker-compose ps`
