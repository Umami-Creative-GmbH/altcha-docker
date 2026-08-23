# Repository Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the repository with Bun 1.4.0, remove unused and vulnerable dependency weight, produce dependency-free production bundles, and publish explicit API and demo images without changing HTTP behavior.

**Architecture:** TypeScript remains the type checker while `scripts/build.ts` owns clean Bun production bundles and demo asset copying. Docker installs dependencies only in the build stage; slim final stages receive one bundle each, and GitHub Actions publishes each target under an explicit image name.

**Tech Stack:** Bun 1.4.0, TypeScript 7, Express 5, Bun test, Docker BuildKit, GitHub Actions

## Global Constraints

- Preserve all public routes, methods, status codes, environment variables, defaults, replay behavior, and ports.
- Pin every Docker stage to Bun `1.4.0`; final stages use the corresponding slim image.
- Do not introduce new runtime or test dependencies.
- Apply only audit fixes supported by current declared ranges; do not use `--latest` or audit ignores.
- Publish the API under the existing GHCR repository name and the demo with an `-demo` suffix.
- Final Docker stages must not contain `package.json`, `bun.lock`, or `node_modules`.

---

### Task 1: Characterize HTTP contracts

**Files:**
- Create: `src/api-app.test.ts`
- Create: `src/demo-app.test.ts`

**Interfaces:**
- Consumes: `createApiApp(config: ApiConfig): Promise<Express>` and `createDemoApp(config: DemoConfig): Express`.
- Produces: HTTP-level regression coverage for the middleware cleanup and bundled entrypoints.

- [ ] **Step 1: Add API tests with a real ephemeral listener**

Use `app.listen(0, "127.0.0.1")`, close every opened server in `afterEach`, and test `GET /` = 204, `GET /challenge` = 200 JSON, and `GET /verify` without `altcha` = 417. Use this literal config:

```ts
const config: ApiConfig = {
  algorithm: "PBKDF2/SHA-256",
  corsOrigin: "*",
  expireMinutes: 1,
  hmacKey: "integration-test-secret",
  maxNumber: 1,
  maxRecords: 10,
  port: 0,
};
```

- [ ] **Step 2: Add demo tests with a real local upstream**

Start a `Bun.serve` upstream returning `Response.json({ challenge: "fixture" })` from `/challenge` and status 202 from `/verify` only for `altcha=fixture-token`. Assert the real demo serves HTML from `/`, proxies the literal challenge JSON, and returns 202 for a URL-encoded `POST /test` with `altcha=fixture-token`. Stop both servers in `afterEach`.

- [ ] **Step 3: Establish the characterization baseline**

Run: `bun test src/api-app.test.ts src/demo-app.test.ts`

Expected: all tests pass against the current middleware, proving they protect existing behavior.

- [ ] **Step 4: Run the full baseline suite**

Run: `bun test`

Expected: the original 13 tests and all new integration tests pass.

---

### Task 2: Remove obsolete Express middleware

**Files:**
- Modify: `src/api-app.ts:5-58`
- Modify: `src/demo-app.ts:25-26`
- Test: `src/api-app.test.ts`
- Test: `src/demo-app.test.ts`

**Interfaces:**
- Consumes: the HTTP contracts protected by Task 1.
- Produces: native Express 5 async handlers and only the request parsers used by each application.

- [ ] **Step 1: Simplify API handlers**

Use `import express, { type Express, type Request, type Response } from "express";`. Delete `asyncHandler`, delete `app.use(express.json())`, and pass both async handlers directly to `app.get`.

- [ ] **Step 2: Remove the demo JSON parser**

Delete `app.use(express.json())` while retaining `express.urlencoded({ extended: true })`.

- [ ] **Step 3: Verify behavior and types**

Run: `bun test src/api-app.test.ts src/demo-app.test.ts` and `bun run tsc`.

Expected: both commands exit 0.

---

### Task 3: Minimize and secure dependencies

**Files:**
- Modify: `package.json:4-31`
- Modify: `bun.lock`
- Modify: `src/index.ts:1-7`
- Modify: `src/demo.ts:1-7`

**Interfaces:**
- Consumes: Bun's automatic `.env` loading.
- Produces: a lockfile without the unused browser widget, dotenv, Yarn PnP, or ts-node dependency trees and without known advisories.

- [ ] **Step 1: Remove explicit dotenv startup code**

Delete the `dotenv` imports and `dotenv.config()` calls from both entrypoints without replacement.

- [ ] **Step 2: Remove unused packages**

Run:

```sh
bun remove altcha dotenv
bun remove --development @yarnpkg/pnpify ts-node
```

- [ ] **Step 3: Apply compatible advisory fixes**

Run: `bun audit fix`

Expected: safe transitive versions are selected without changing direct dependency ranges.

- [ ] **Step 4: Verify usage, audit, and tests**

Run `rg -n 'from "(altcha|dotenv)"|pnpify|ts-node' src scripts package.json`, `bun audit`, and `bun test`.

Expected: the search finds no obsolete usage, the audit reports zero vulnerabilities, and tests pass.

---

### Task 4: Create clean Bun production bundles

**Files:**
- Create: `scripts/build.ts`
- Retain: `scripts/copy-demo-assets.ts`
- Modify: `package.json:4-11`
- Modify: `tsconfig.json:14-60`

**Interfaces:**
- Consumes: `src/index.ts`, `src/demo.ts`, and `scripts/copy-demo-assets.ts`.
- Produces: `build/index.js`, `build/demo.js`, and `build/demo/index.html` from a clean directory.

- [ ] **Step 1: Add the build orchestrator**

Create `scripts/build.ts`:

```ts
import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outdir = join(root, "build");
await rm(outdir, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: [join(root, "src", "index.ts"), join(root, "src", "demo.ts")],
  minify: true,
  outdir,
  target: "bun",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await import("./copy-demo-assets");
```

- [ ] **Step 2: Update package and TypeScript configuration**

Set `main` to `build/index.js`, set `build` to `bun run tsc && bun ./scripts/build.ts`, set TypeScript `target` to `ES2022`, and set `noEmit` to `true`. Keep CommonJS module checking because the demo uses `__dirname` and Bun owns production output.

- [ ] **Step 3: Prove the build cleans stale artifacts**

Place `build/stale.js`, run `bun run build`, and verify the stale file is absent while `build/index.js`, `build/demo.js`, and `build/demo/index.html` exist.

- [ ] **Step 4: Verify build and tests**

Run `bun run tsc`, `bun run build`, and `bun test`.

Expected: all commands exit 0.

---

### Task 5: Minimize Docker runtime stages

**Files:**
- Modify: `Dockerfile:1-34`
- Modify: `.dockerignore:6-18`
- Modify: `README.Docker.md:20-95`

**Interfaces:**
- Consumes: the three build outputs from Task 4.
- Produces: explicit `api` and `demo` images on Bun 1.4.0 slim with no runtime installation.

- [ ] **Step 1: Rewrite Docker stages around bundles**

Use `ARG BUN_VERSION=1.4.0`, a full `oven/bun:${BUN_VERSION}` build stage, and `oven/bun:${BUN_VERSION}-slim` final stages. Copy only `build/index.js` to API or `build/demo.js` plus `build/demo/index.html` to demo. Retain `USER bun` and ports. Use `CMD ["bun", "./build/index.js"]` and `CMD ["bun", "./build/demo.js"]`.

- [ ] **Step 2: Tighten the build context**

Add `build`, `compose.yaml`, `README.Docker.md`, and `docs` to `.dockerignore` while retaining existing secret, VCS, editor, and dependency exclusions.

- [ ] **Step 3: Update Docker documentation**

Document Bun 1.4.0 slim, direct bundled entrypoints, no runtime `node_modules`, and the API/base plus demo/`-demo` registry names.

- [ ] **Step 4: Validate configuration and images**

Run `docker compose config`, then—if the daemon is available—build `api` and `demo` with local audit tags. If unavailable, record the limitation and do not claim local image verification.

---

### Task 6: Publish both intended images

**Files:**
- Modify: `.github/workflows/docker-publish.yml:22-85`

**Interfaces:**
- Consumes: Docker targets `api` and `demo`.
- Produces: `${REGISTRY}/${IMAGE_NAME}` and `${REGISTRY}/${IMAGE_NAME}-demo` with identical metadata tag rules.

- [ ] **Step 1: Add an explicit target matrix**

Add:

```yaml
strategy:
  matrix:
    include:
      - target: api
        image_suffix: ""
      - target: demo
        image_suffix: "-demo"
```

Use the matrix target in the job name and build action `target`. Set metadata `images` to `${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}${{ matrix.image_suffix }}`.

- [ ] **Step 2: Preserve multi-architecture behavior**

Keep the pinned actions, QEMU, Buildx, login, `linux/amd64,linux/arm64`, and GHA cache settings unchanged.

- [ ] **Step 3: Inspect the completed workflow**

Confirm each row supplies `target` and `image_suffix`, the build action consumes `target`, and metadata consumes the suffixed image name.

---

### Task 7: Final verification and commit

**Files:**
- Verify: all files modified by Tasks 1-6

**Interfaces:**
- Consumes: the complete optimized repository.
- Produces: evidence that the approved design is implemented without regressions.

- [ ] **Step 1: Run full verification**

Run:

```sh
bun test
bun run tsc
bun run build
bun audit
docker compose config
git diff --check
```

Expected: all available checks succeed; Docker daemon limitations are reported separately.

- [ ] **Step 2: Inspect artifacts and dependency graph**

Verify `build/` contains only `index.js`, `demo.js`, and `demo/index.html`. Verify `bun pm ls --all` omits all four removed direct dependencies. Inspect bundle sizes and the final diff.

- [ ] **Step 3: Review the design line by line**

Confirm all seven findings, public-contract constraints, security rules, Docker names, and non-goals in `docs/superpowers/specs/2026-08-23-repository-optimization-design.md` are satisfied.

- [ ] **Step 4: Commit intended files only**

Commit with `git commit -m "perf: optimize Bun build and containers"`.
