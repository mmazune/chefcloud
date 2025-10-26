# ChefCloud Infrastructure

## Docker Compose

Start local development services:

```bash
cd infra/docker
docker-compose up -d
```

Services:
- PostgreSQL 16 on port 5432
- Redis 7 on port 6379

Stop services:

```bash
docker-compose down
```

Stop and remove volumes:

```bash
docker-compose down -v
```
