# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base

WORKDIR /usr/src/app

FROM base AS build

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=bun.lock,target=bun.lock \
    bun i --frozen-lockfile

COPY . .
RUN bun run build

FROM base AS final

ENV NODE_ENV=production
USER bun
COPY package.json .
COPY .env .
COPY src/demo/index.html ./build/demo/index.html
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/build ./build

EXPOSE 3000

CMD ["bun", "start"]
