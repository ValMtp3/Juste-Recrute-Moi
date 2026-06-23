import { describe, expect, it, vi } from "vitest";
import { emitAppEvent, onAppEvent } from "./appEvents";

describe("appEvents", () => {
  it("émet et désabonne un événement applicatif typé", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const handler = vi.fn();
    const off = onAppEvent("lead-updated", handler);
    emitAppEvent("lead-updated", { job_id: "job-1", status: "applied" });
    expect(handler).toHaveBeenCalledWith({ job_id: "job-1", status: "applied" });

    off();
    emitAppEvent("lead-updated", { job_id: "job-2", status: "discarded" });
    expect(handler).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
