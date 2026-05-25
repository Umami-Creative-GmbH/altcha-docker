# Docker Usage

## Docker Compose

Run the split API and demo services together:

```bash
docker compose up --build
```

Override the Compose-managed API secret with `ALTCHA_SECRET`; Compose maps it to the API container's required `SECRET` runtime variable:

```bash
ALTCHA_SECRET=change-me-to-a-long-random-string docker compose up --build
```

- API: http://localhost:3000
- Demo: http://localhost:8080

Compose builds two Dockerfile targets:

- `server`: `api` target, runs `bun start` and exposes port 3000.
- `demo`: `demo` target, runs `bun run start:demo` and exposes port 8080.

The demo container uses `API_BASE_URL=http://server:3000` so it can serve `/`, proxy widget requests from `GET /challenge` to API `/challenge`, and handle demo form submissions at `POST /test` by calling API `/verify` over the Compose network. The demo does not expose a public `/verify` route.

## Build Images Individually

Build the API image:

```bash
docker build --target api -t altcha-docker-api .
```

Build the demo image:

```bash
docker build --target demo -t altcha-docker-demo .
```

For a different deployment architecture, add `--platform`, for example:

```bash
docker build --platform=linux/amd64 --target api -t altcha-docker-api .
```

## Run Images Individually

Run the API image with runtime environment variables:

```bash
docker run --rm -p 3000:3000 \
  -e SECRET=change-me-to-a-long-random-string \
  -e CORS_ORIGIN=* \
  -e MAXNUMBER=5000 \
  altcha-docker-api
```

Run the demo image and point it at a reachable API URL:

```bash
docker run --rm -p 8080:8080 \
  -e API_BASE_URL=http://host.docker.internal:3000 \
  altcha-docker-demo
```

## Runtime Environment

API settings:

- `SECRET`: Required container/runtime HMAC key for ALTCHA challenge signing. Docker Compose sets it from `ALTCHA_SECRET`, falling back to `$ecret.key` for local testing only.
- `PORT`: API port, default 3000.
- `EXPIREMINUTES`: Challenge expiry in minutes, default 10.
- `MAXRECORDS`: In-memory replay cache size, default 1000.
- `CORS_ORIGIN`: Allowed CORS origin(s), default `*`.
- `ALGORITHM`: ALTCHA v2 algorithm, default `PBKDF2/SHA-256`.
- `MAXNUMBER`: ALTCHA v2 proof-of-work cost, default 5000.

Demo settings:

- `API_BASE_URL`: API target for the demo proxy, default `http://server:3000`.
- `DEMO_PORT`: Demo port, default 8080.

## Deployment Notes

Push the built images to your registry:

```bash
docker tag altcha-docker-api myregistry.com/altcha-docker-api:latest
docker push myregistry.com/altcha-docker-api:latest
docker tag altcha-docker-demo myregistry.com/altcha-docker-demo:latest
docker push myregistry.com/altcha-docker-demo:latest
```

Do not bake `.env` files or secrets into Docker images. The Dockerfile does not copy `.env`; provide runtime configuration through Docker Compose `ALTCHA_SECRET`, `docker run -e SECRET=...`, your orchestrator, or a secret manager.

If you scale the API beyond one instance, replace the in-memory replay cache with a shared store so token reuse checks are consistent across replicas.

## References

- [Docker's Node.js guide](https://docs.docker.com/language/nodejs/)
