import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("smoke", () => {
  it("resolves the @/ alias and drops falsy classes", () => {
    expect(cn("a", false && "b")).toBe("a");
  });
});
