import { describe, expect, it } from "vitest";
import { APP } from "@/config/app";

describe("app config", () => {
  it("defaults to Arabic", () => {
    expect(APP.defaultLocale).toBe("ar");
  });
});
