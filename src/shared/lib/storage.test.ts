import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readLocalStorage,
  readSessionStorage,
  removeLocalStorage,
  removeSessionStorage,
  writeLocalStorage,
  writeSessionStorage,
} from "./storage";

describe("storage helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back when browser storage is unavailable", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("blocked");
      },
      get sessionStorage() {
        throw new Error("blocked");
      },
    });

    expect(readLocalStorage("missing", "fallback")).toBe("fallback");
    expect(readSessionStorage("missing", "fallback")).toBe("fallback");
    expect(() => writeLocalStorage("key", "value")).not.toThrow();
    expect(() => writeSessionStorage("key", "value")).not.toThrow();
    expect(() => removeLocalStorage("key")).not.toThrow();
    expect(() => removeSessionStorage("key")).not.toThrow();
  });
});
