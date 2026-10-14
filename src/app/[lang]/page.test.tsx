import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

const rootParams = vi.hoisted(() => ({ lang: "en" }));
vi.mock("next/root-params", () => ({ lang: async () => rootParams.lang }));

describe("Home", () => {
  beforeEach(() => {
    rootParams.lang = "en";
  });

  it("renders the product heading", async () => {
    render(await Home());
    expect(
      screen.getByRole("heading", { level: 1, name: "CRAT" }),
    ).toBeDefined();
  });

  it("renders the German description", async () => {
    rootParams.lang = "de";
    render(await Home());
    expect(screen.getByText(/Beantworte Compliance-Fragen/)).toBeDefined();
  });
});
