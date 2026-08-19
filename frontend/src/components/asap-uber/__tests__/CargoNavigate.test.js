/**
 * R68 — Navigation abstraction unit tests.
 *
 * Pure logic tests for `buildNavigationUrl`. The full ceremony
 * (map render, browser handoff, active-job map panel wiring) is covered
 * by the frontend Playwright tests driven from the testing agent.
 */
import { buildNavigationUrl } from "../CargoNavigate";

describe("buildNavigationUrl", () => {
  const dest = { lat: 51.5074, lng: -0.1278, label: "London Bridge" };

  test("returns null for invalid destinations", () => {
    expect(buildNavigationUrl({}, "ios")).toBeNull();
    expect(buildNavigationUrl({ lat: 51 }, "android")).toBeNull();
    expect(buildNavigationUrl({ lat: NaN, lng: 0 }, "desktop")).toBeNull();
  });

  test("ios → Apple Maps universal link with daddr + dirflg=d", () => {
    const url = buildNavigationUrl(dest, "ios");
    expect(url).toMatch(/^https:\/\/maps\.apple\.com\/\?daddr=51\.5074,-0\.1278/);
    expect(url).toContain("dirflg=d");
    expect(url).toContain("q=London%20Bridge");
  });

  test("android → geo: intent scheme", () => {
    const url = buildNavigationUrl(dest, "android");
    expect(url).toMatch(/^geo:51\.5074,-0\.1278/);
    expect(url).toContain("q=51.5074,-0.1278");
  });

  test("desktop → Google Maps directions URL", () => {
    const url = buildNavigationUrl(dest, "desktop");
    expect(url).toMatch(
      /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=51\.5074,-0\.1278/,
    );
  });

  test("omits label when not provided", () => {
    const noLabel = { lat: 51.5, lng: -0.12 };
    expect(buildNavigationUrl(noLabel, "ios")).not.toContain("q=");
    expect(buildNavigationUrl(noLabel, "android")).not.toContain("(");
    expect(buildNavigationUrl(noLabel, "desktop")).not.toContain(
      "destination_place_id=",
    );
  });

  test("URLs never contain unescaped user text", () => {
    const evil = { lat: 51, lng: 0, label: "A&B <script>" };
    for (const p of ["ios", "android", "desktop"]) {
      const url = buildNavigationUrl(evil, p);
      expect(url).not.toContain("<script>");
      expect(url).not.toContain(" ");
    }
  });
});
