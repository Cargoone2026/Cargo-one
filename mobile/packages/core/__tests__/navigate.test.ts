import {
  buildNativeNavigationUrl,
  buildNavigationFallbackUrl,
} from "../src/navigate";

const dest = { lat: 51.5074, lng: -0.1278, label: "London Bridge" };

describe("buildNativeNavigationUrl", () => {
  test("iOS → native maps:// scheme (Apple Maps, NOT Safari)", () => {
    const url = buildNativeNavigationUrl(dest, "ios");
    expect(url).toMatch(/^maps:\/\/\?daddr=51\.5074,-0\.1278/);
    expect(url).toContain("dirflg=d");
    expect(url).toContain("q=London%20Bridge");
    // Critically: NOT a Google URL.
    expect(url).not.toContain("google");
    expect(url).not.toContain("safari");
  });

  test("Android → google.navigation deep-link (turn-by-turn)", () => {
    const url = buildNativeNavigationUrl(dest, "android");
    expect(url).toMatch(/^google\.navigation:q=51\.5074,-0\.1278/);
  });

  test("desktop / unknown → Google Maps HTTPS directions (dev only)", () => {
    const url = buildNativeNavigationUrl(dest, "desktop");
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?/);
  });

  test("null / invalid destination → null", () => {
    expect(buildNativeNavigationUrl(null, "ios")).toBeNull();
    expect(buildNativeNavigationUrl({ lat: NaN, lng: 0 }, "ios")).toBeNull();
    expect(buildNativeNavigationUrl({ lat: 0, lng: undefined as unknown as number }, "android")).toBeNull();
  });

  test("URLs escape unsafe label characters", () => {
    const evil = { lat: 51, lng: 0, label: "A&B <script>" };
    for (const p of ["ios", "android"] as const) {
      const url = buildNativeNavigationUrl(evil, p);
      expect(url).not.toContain("<script>");
      expect(url).not.toContain(" ");
    }
  });
});

describe("buildNavigationFallbackUrl", () => {
  test("Android fallback = geo: intent (opens OS chooser)", () => {
    const url = buildNavigationFallbackUrl(dest, "android");
    expect(url).toMatch(/^geo:51\.5074,-0\.1278/);
  });
  test("iOS fallback = Apple Maps HTTPS universal link", () => {
    const url = buildNavigationFallbackUrl(dest, "ios");
    expect(url).toMatch(/^https:\/\/maps\.apple\.com\/\?daddr=51\.5074,-0\.1278/);
  });
  test("returns null for invalid destinations", () => {
    expect(buildNavigationFallbackUrl(null, "ios")).toBeNull();
  });
});
