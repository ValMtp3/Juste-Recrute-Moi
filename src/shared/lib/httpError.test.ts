import { describe, expect, it } from "vitest";
import { readJsonResponse, responseErrorMessage } from "./httpError";

describe("responseErrorMessage", () => {
  it("turns structured validation details into readable text", async () => {
    const response = new Response(JSON.stringify({
      detail: [{ loc: ["body", "free_source_max_requests"], msg: "Input should be less than 500" }],
    }), { status: 422, headers: { "Content-Type": "application/json" } });

    await expect(responseErrorMessage(response, "fallback")).resolves.toBe(
      "body.free_source_max_requests : Input should be less than 500",
    );
  });

  it("falls back when the response body is empty", async () => {
    await expect(responseErrorMessage(new Response("", { status: 500 }), "fallback")).resolves.toBe("fallback");
  });
});

describe("readJsonResponse", () => {
  it("returns parsed JSON for readable responses", async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });

    await expect(readJsonResponse<{ ok: boolean }>(response, "fallback")).resolves.toEqual({ ok: true });
  });

  it("throws a user-facing fallback for unreadable success bodies", async () => {
    const response = new Response("<html>backend restarted</html>", {
      headers: { "Content-Type": "text/html" },
    });

    await expect(readJsonResponse(response, "Réponse illisible")).rejects.toThrow("Réponse illisible");
  });
});
