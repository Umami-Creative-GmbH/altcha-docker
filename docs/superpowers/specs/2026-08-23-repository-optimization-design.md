# Repository Optimization Design

## Goal

Reduce the repository's dependency and container footprint, align every production path with Bun 1.4.0, remove obsolete Express compatibility code, fix currently resolvable dependency advisories, and publish the intended API and demo images without changing their HTTP contracts.

## Scope

The implementation covers the seven findings from the repository audit:

1. Pin build and runtime containers to Bun 1.4.0.
2. Apply safe transitive security updates supported by the existing dependency ranges.
3. Remove unused direct dependencies.
4. Publish the API and demo Docker targets explicitly.
5. Raise the TypeScript output target from ES2016 to ES2022.
6. Replace the TypeScript-emitted production tree and runtime `node_modules` with Bun production bundles.
7. Remove unnecessary body parsers and the Express 4-era asynchronous handler wrapper.

The public API routes, status codes, environment variable names, default values, replay protection behavior, demo routes, and exposed ports remain unchanged.

## Dependencies and Security

Remove `altcha` because no source file imports it; the browser demo obtains the widget from jsDelivr. Remove `dotenv` because all entrypoints run under Bun 1.4.0, which loads supported `.env` files automatically. Remove the unused development tools `@yarnpkg/pnpify` and `ts-node`.

Run `bun audit fix` without `--latest`. This may update transitive packages only to versions satisfying the declared dependency ranges. No forced major-version upgrades or audit ignores are allowed. The final lockfile must produce zero known advisories when checked against the npm advisory service.

## Build and Container Architecture

Keep TypeScript as the static type checker but configure it with `target: ES2022` and `noEmit: true`. The production build uses Bun's bundler with `target=bun` and production minification for both `src/index.ts` and `src/demo.ts`. The existing asset-copy script continues to place `src/demo/index.html` under the build directory.

The Docker build stage installs the frozen lockfile and runs the type-check plus bundle build. Final API and demo stages use the official Bun 1.4.0 slim image and copy only their required bundle and assets. They do not copy `package.json`, `bun.lock`, or `node_modules`. Both final stages run as the existing non-root `bun` user.

The API image remains the primary GHCR image name. The demo image is published under the same name with an `-demo` suffix. The GitHub Actions build uses an explicit matrix whose entries identify the Docker target and image name, so it cannot silently publish whichever stage happens to be last in the Dockerfile.

## Application Cleanup

The API has GET-only routes and therefore does not need `express.json()`. The demo accepts a URL-encoded form and retains `express.urlencoded()` but removes its unused JSON parser.

Express 5 already forwards rejected promises from async route handlers. The custom `asyncHandler` wrapper and its `NextFunction` and `RequestHandler` imports are removed, while the route handlers remain async functions. Existing error responses and Express's default error propagation remain intact.

## Testing Strategy

Add HTTP-level characterization tests using Bun and ephemeral listeners, without adding a test framework dependency. The tests cover API liveness, challenge creation, missing verification payload handling, demo HTML serving, challenge proxying, and URL-encoded verification submission. These tests establish the route behavior before middleware and handler simplification.

Because the application cleanup is intentionally behavior-preserving and the remaining changes are build/configuration changes, characterization tests replace artificial failing tests. Production behavior changes, if unexpectedly required, must still follow a red-green test cycle.

Verification includes:

- `bun test`
- `bun run tsc`
- `bun run build`
- starting the bundled API and demo through integration tests
- `bun audit`
- `docker compose config`
- Docker API and demo target builds when a Docker daemon is available
- checking the final Git diff and working-tree status

## Documentation

Update README build/runtime wording if it describes TypeScript emission, runtime dependencies, Docker image names, or the old Bun version. Keep the documented HTTP contracts and Compose workflow unchanged.

## Non-Goals

- Replacing Express with `Bun.serve`
- Compiling standalone executables
- Changing ALTCHA algorithms or proof-of-work defaults
- Changing endpoint methods or response codes
- Adding a shared replay store
- Changing the CDN-hosted demo widget
