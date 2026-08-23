import { afterEach, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createDemoApp } from "./demo-app";

const expressServers: Server[] = [];
const bunServers: Bun.Server<unknown>[] = [];

const startDemo = async (apiBaseUrl: string): Promise<string> => {
  const app = createDemoApp({ apiBaseUrl, port: 0 });
  const server = await new Promise<Server>((resolve, reject) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
    listeningServer.once("error", reject);
  });
  expressServers.push(server);

  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
};

const startUpstream = (): string => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/challenge") return Response.json({ challenge: "fixture" });
      if (url.pathname === "/verify" && url.searchParams.get("altcha") === "fixture-token") {
        return new Response(null, { status: 202 });
      }
      return new Response(null, { status: 417 });
    },
  });
  bunServers.push(server);
  return server.url.toString().replace(/\/$/, "");
};

afterEach(async () => {
  await Promise.all(expressServers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
  for (const server of bunServers.splice(0)) server.stop(true);
});

describe("demo HTTP contract", () => {
  test("serves the demo HTML", async () => {
    const baseUrl = await startDemo(startUpstream());

    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("<altcha-widget");
  });

  test("proxies challenge responses from the API", async () => {
    const baseUrl = await startDemo(startUpstream());

    const response = await fetch(`${baseUrl}/challenge`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: "fixture" });
  });

  test("submits URL-encoded ALTCHA payloads to the API", async () => {
    const baseUrl = await startDemo(startUpstream());

    const response = await fetch(`${baseUrl}/test`, {
      body: new URLSearchParams({ altcha: "fixture-token" }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });

    expect(response.status).toBe(202);
  });
});
