import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

describe("clipboard helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the browser clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("returns false instead of throwing when copying is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", {
      createElement() {
        throw new Error("blocked");
      },
    });

    await expect(copyTextToClipboard("hello")).resolves.toBe(false);
  });
});
