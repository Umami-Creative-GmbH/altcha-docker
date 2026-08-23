import { afterEach, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createApiApp } from "./api-app";
import type { ApiConfig } from "./config";

const config: ApiConfig = {
  algorithm: "PBKDF2/SHA-256",
  corsOrigin: "*",
  expireMinutes: 1,
  hmacKey: "integration-test-secret",
  maxNumber: 1,
  maxRecords: 10,
  port: 0,
};

const servers: Server[] = [];

const startApi = async (): Promise<string> => {
  const app = await createApiApp(config);
  const server = await new Promise<Server>((resolve, reject) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
    listeningServer.once("error", reject);
  });
  servers.push(server);

  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe("API HTTP contract", () => {
  test("serves the liveness endpoint without a body", async () => {
    const baseUrl = await startApi();

    const response = await fetch(`${baseUrl}/`);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  test("creates a challenge with the configured algorithm and cost", async () => {
    const baseUrl = await startApi();

    const response = await fetch(`${baseUrl}/challenge`);
    const body = await response.json() as { parameters: { algorithm: string; cost: number }; signature: string };

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body.parameters.algorithm).toBe("PBKDF2/SHA-256");
    expect(body.parameters.cost).toBe(1);
    expect(body.signature.length).toBeGreaterThan(0);
  });

  test("rejects verification requests without a payload", async () => {
    const baseUrl = await startApi();

    const response = await fetch(`${baseUrl}/verify`);

    expect(response.status).toBe(417);
  });
});
