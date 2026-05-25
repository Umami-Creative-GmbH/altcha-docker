import { describe, expect, test } from "bun:test";
import { parseApiConfig, parseDemoConfig } from "./config";

describe("parseApiConfig", () => {
  test("uses defaults for optional API config", () => {
    const config = parseApiConfig({ SECRET: "local-secret" });

    expect(config).toEqual({
      algorithm: "PBKDF2/SHA-256",
      corsOrigin: "*",
      expireMinutes: 10,
      hmacKey: "local-secret",
      maxNumber: 5000,
      maxRecords: 1000,
      port: 3000,
    });
  });

  test("parses numeric and string API config", () => {
    const config = parseApiConfig({
      ALGORITHM: "SHA-256",
      CORS_ORIGIN: "https://example.com, https://admin.example.com",
      EXPIREMINUTES: "5",
      MAXNUMBER: "9000",
      MAXRECORDS: "25",
      PORT: "4000",
      SECRET: "configured-secret",
    });

    expect(config.algorithm).toBe("SHA-256");
    expect(config.corsOrigin).toEqual(["https://example.com", "https://admin.example.com"]);
    expect(config.expireMinutes).toBe(5);
    expect(config.maxNumber).toBe(9000);
    expect(config.maxRecords).toBe(25);
    expect(config.port).toBe(4000);
    expect(config.hmacKey).toBe("configured-secret");
  });

  test("supports COST as legacy fallback when MAXNUMBER is absent", () => {
    const config = parseApiConfig({ COST: "7000", SECRET: "configured-secret" });

    expect(config.maxNumber).toBe(7000);
  });

  test("rejects missing secret", () => {
    expect(() => parseApiConfig({})).toThrow("SECRET is required");
  });

  test("rejects invalid numbers", () => {
    expect(() => parseApiConfig({ PORT: "abc", SECRET: "configured-secret" })).toThrow("PORT must be a positive integer");
    expect(() => parseApiConfig({ EXPIREMINUTES: "0", SECRET: "configured-secret" })).toThrow("EXPIREMINUTES must be a positive integer");
    expect(() => parseApiConfig({ MAXRECORDS: "-1", SECRET: "configured-secret" })).toThrow("MAXRECORDS must be a positive integer");
    expect(() => parseApiConfig({ MAXNUMBER: "1.5", SECRET: "configured-secret" })).toThrow("MAXNUMBER must be a positive integer");
  });
});

describe("parseDemoConfig", () => {
  test("uses defaults for optional demo config", () => {
    const config = parseDemoConfig({});

    expect(config).toEqual({
      apiBaseUrl: "http://server:3000",
      port: 8080,
    });
  });

  test("parses demo config", () => {
    const config = parseDemoConfig({ API_BASE_URL: "http://api:3333", DEMO_PORT: "9090" });

    expect(config.apiBaseUrl).toBe("http://api:3333");
    expect(config.port).toBe(9090);
  });

  test("rejects invalid API_BASE_URL", () => {
    expect(() => parseDemoConfig({ API_BASE_URL: "not a url" })).toThrow("API_BASE_URL must be a valid URL");
  });
});
