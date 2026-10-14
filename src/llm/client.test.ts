import { describe, it, expect, vi } from "vitest";
import { LlmError, withRetries } from "./client";

describe("withRetries", () => {
  it("returns the first successful result", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new LlmError("invalid_output", "bad"))
      .mockResolvedValueOnce("ok");
    await expect(withRetries(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after the given number of attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new LlmError("request_failed", "down"));
    await expect(withRetries(fn, 3)).rejects.toThrow("down");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry refusals or unexpected errors", async () => {
    const refused = vi.fn().mockRejectedValue(new LlmError("refused", "no"));
    await expect(withRetries(refused)).rejects.toThrow("no");
    expect(refused).toHaveBeenCalledTimes(1);

    const bug = vi.fn().mockRejectedValue(new TypeError("bug"));
    await expect(withRetries(bug)).rejects.toThrow(TypeError);
    expect(bug).toHaveBeenCalledTimes(1);
  });
});
