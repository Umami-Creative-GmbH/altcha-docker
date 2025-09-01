<img src="./logo-black.altcha.svg" alt="ALTCHA" width="240" />

# ALTCHA Docker

A lightweight Dockerized ALTCHA challenge/verify service built with Bun + Express. It exposes simple endpoints to generate ALTCHA challenges and verify solutions, and includes an optional demo UI.

- Runtime: Bun
- Ports: 3000 (API), 8080 (optional demo)
- Upstream libs: altcha, altcha-lib

## Quick start

Use Docker Compose (recommended):

```powershell
# Optionally create a .env file (see below) or set variables in your shell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
# Start the stack
docker compose up --build
```

```bash
# Unix/macOS (bash/zsh)
# Optionally create a .env file (see below) or set variables in your shell
[ -f .env ] || cp .env.example .env
# Start the stack
docker compose up --build
```

- API base: http://localhost:3000
- Demo (if enabled): http://localhost:8080

To override the secret temporarily in PowerShell:

```powershell
$env:SECRET = "your-very-long-random-key"; docker compose up --build
```

Unix/macOS:

```bash
SECRET="your-very-long-random-key" docker compose up --build
```

## Configuration

The service reads the following environment variables:

- SECRET (required): HMAC key used to sign/verify challenges. Default is $ecret.key (don’t use this in production).
- PORT: API port, default 3000.
- EXPIREMINUTES: Challenge expiry in minutes, default 10.
- MAXRECORDS: Size of in‑memory single‑use token cache, default 1000.
- DEMO: When "true", starts a simple demo UI on port 8080.

You can provide variables via:

- .env file in the project root (Docker Compose reads it automatically)
- compose.yaml environment section
- Directly in your shell (e.g., $env:NAME in PowerShell)

Example .env:

```env
SECRET=change-me-to-a-long-random-string
PORT=3000
EXPIREMINUTES=10
MAXRECORDS=1000
DEMO=false
```

## Endpoints

- GET /

  - Returns 204 No Content. Liveness probe endpoint.

- GET /challenge

  - Returns a signed ALTCHA challenge JSON produced by altcha-lib.
  - 200 OK with challenge payload.

- GET /verify?altcha=<payload>
  - Verifies the provided ALTCHA solution.
  - 202 Accepted on success.
  - 417 Expectation Failed on failure or when a token is reused (single-use enforced with an in-memory cache).

Notes:

- CORS is open (origin: \*).
- Record reuse protection is best-effort and stored in-memory; scale-out or restarts will reset the cache. For production, pair with a shared store or upstream protections as needed.

## Demo UI (optional)

Enable the built-in demo page by setting DEMO=true. It serves a minimal HTML form at http://localhost:8080 that embeds the ALTCHA widget pointing to the API at port 3000.

## Client integration example

Add the widget to your form and point challengeurl at this service:

```html
<script async defer src="https://cdn.jsdelivr.net/gh/altcha-org/altcha@main/dist/altcha.min.js" type="module"></script>
<form action="/your-submit" method="POST">
  <input name="email" placeholder="Email" />
  <altcha-widget challengeurl="http://localhost:3000/challenge"></altcha-widget>
  <button>Submit</button>
  <!-- On submit, include the `altcha` field value in your request body -->
  <!-- Example server should call GET /verify?altcha=... and accept 202 as success -->
  <!-- 417 means invalid or reused token -->
</form>
```

From PowerShell, you can test verification manually:

```powershell
# Assuming $payload contains the exact `altcha` value from the client
curl "http://localhost:3000/verify?altcha=$([uri]::EscapeDataString($payload))" -Method GET -UseBasicParsing
```

On Unix/macOS, you can test verification manually:

```bash
# Assuming $payload contains the exact `altcha` value from the client
curl -G \
  --data-urlencode "altcha=$payload" \
  http://localhost:3000/verify -i
```

Expect 202 on success or 417 on failure/reuse.

## Building and running without Docker

You can run locally with Bun (requires Bun installed):

```powershell
bun install
bun run build
bun start
```

```bash
# Unix/macOS
bun install
bun run build
bun start
```

Or for live reload during development:

```powershell
bun run dev
```

```bash
# Unix/macOS
bun run dev
```

## Production notes

- Change SECRET to a strong, unique value. Never use the default.
- Consider terminating TLS in front of the container and restricting access to /verify if needed.
- For horizontal scaling, replace the in-memory token cache with a shared store.
- Pin image versions and consider multi-arch builds if deploying across architectures.

## License

MIT © Umami Creative GmbH
