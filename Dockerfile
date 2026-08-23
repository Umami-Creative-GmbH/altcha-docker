# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.4.0

FROM oven/bun:${BUN_VERSION} AS build
WORKDIR /usr/src/app
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=bun.lock,target=bun.lock \
    bun install --frozen-lockfile
COPY package.json tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN bun run build

FROM oven/bun:${BUN_VERSION}-slim AS api
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/build/index.js ./build/index.js
USER bun
EXPOSE 3000
CMD ["bun", "./build/index.js"]

FROM oven/bun:${BUN_VERSION}-slim AS demo
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/build/demo.js ./build/demo.js
COPY --from=build /usr/src/app/build/demo ./build/demo
USER bun
EXPOSE 8080
CMD ["bun", "./build/demo.js"]
