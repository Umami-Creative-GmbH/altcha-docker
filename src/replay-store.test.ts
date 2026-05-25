import { describe, expect, test } from "bun:test";
import { createInMemoryReplayStore } from "./replay-store";

describe("createInMemoryReplayStore", () => {
  test("tracks inserted challenge IDs", () => {
    const store = createInMemoryReplayStore(2);

    expect(store.get("a")).toBe(false);
    store.set("a", true);
    expect(store.get("a")).toBe(true);
  });

  test("ignores false writes", () => {
    const store = createInMemoryReplayStore(2);
    store.set("a", false);

    expect(store.get("a")).toBe(false);
  });

  test("evicts oldest IDs when max records is exceeded", () => {
    const store = createInMemoryReplayStore(2);

    store.set("a", true);
    store.set("b", true);
    store.set("c", true);

    expect(store.get("a")).toBe(false);
    expect(store.get("b")).toBe(true);
    expect(store.get("c")).toBe(true);
  });

  test("does not duplicate existing IDs in eviction order", () => {
    const store = createInMemoryReplayStore(2);

    store.set("a", true);
    store.set("a", true);
    store.set("b", true);
    store.set("c", true);

    expect(store.get("a")).toBe(false);
    expect(store.get("b")).toBe(true);
    expect(store.get("c")).toBe(true);
  });
});
