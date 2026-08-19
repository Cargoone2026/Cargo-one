import {
  bookingPhase,
  navigateTargetForPhase,
  sortByCreatedAtDesc,
  mergeActive,
  money,
  miles,
  eta,
  contactVisible,
} from "../src/bookings";
import type { Booking } from "../src/types";

describe("sortByCreatedAtDesc (R70 parity)", () => {
  test("newest first, id tiebreak", () => {
    const rows = [
      { id: "a", created_at: "2026-01-01T00:00:00Z" },
      { id: "c", created_at: "2026-01-03T00:00:00Z" },
      { id: "b", created_at: "2026-01-02T00:00:00Z" },
      { id: "d", created_at: "2026-01-03T00:00:00Z" }, // tie with c → higher id first
    ];
    const sorted = sortByCreatedAtDesc(rows);
    expect(sorted.map((r) => r.id)).toEqual(["d", "c", "b", "a"]);
  });

  test("handles missing timestamps", () => {
    const rows = [
      { id: "old", created_at: "2020-01-01T00:00:00Z" },
      { id: "no-ts" },
      { id: "new", created_at: "2030-01-01T00:00:00Z" },
    ];
    expect(sortByCreatedAtDesc(rows)[0].id).toBe("new");
  });
});

describe("mergeActive", () => {
  test("interleaves paid bookings + unpaid posted jobs newest-first", () => {
    const bookings = [
      { id: "b-old", created_at: "2026-01-01T00:00:00Z" },
      { id: "b-new", created_at: "2026-01-05T00:00:00Z" },
    ];
    const jobs = [
      { id: "j-newest", created_at: "2026-01-06T00:00:00Z" },
      { id: "j-mid", created_at: "2026-01-03T00:00:00Z" },
    ];
    const out = mergeActive(bookings, jobs);
    expect(out.map((r: any) => r.id)).toEqual(["j-newest", "b-new", "j-mid", "b-old"]);
  });
});

describe("bookingPhase", () => {
  test("R68 phase mapping (unchanged)", () => {
    expect(bookingPhase("quote")).toBeNull();
    expect(bookingPhase("deposit_paid")).toBeNull();
    expect(bookingPhase("travelling")).toBe("to_pickup");
    expect(bookingPhase("arrived")).toBe("arrived");
    expect(bookingPhase("collected")).toBe("to_dropoff");
    expect(bookingPhase("on_route")).toBe("to_dropoff");
    expect(bookingPhase("delivered")).toBe("completed");
    expect(bookingPhase("completed")).toBe("completed");
  });
});

describe("navigateTargetForPhase", () => {
  const job = {
    pickup_lat: 51.5,
    pickup_lng: -0.1,
    dropoff_lat: 53.5,
    dropoff_lng: -2.2,
  };
  test("to_pickup uses pickup coords", () => {
    expect(navigateTargetForPhase("to_pickup", job)).toEqual({ lat: 51.5, lng: -0.1 });
  });
  test("to_dropoff uses dropoff coords", () => {
    expect(navigateTargetForPhase("to_dropoff", job)).toEqual({ lat: 53.5, lng: -2.2 });
  });
  test("arrived (at pickup) navigates to the DROPOFF next", () => {
    expect(navigateTargetForPhase("arrived", job)).toEqual({ lat: 53.5, lng: -2.2 });
  });
  test("returns null when job is missing", () => {
    expect(navigateTargetForPhase("to_pickup", null)).toBeNull();
  });
});

describe("formatters", () => {
  test("money", () => {
    expect(money(0)).toBe("£0");
    expect(money(199.6)).toBe("£200");
    expect(money(null)).toBe("£0");
  });
  test("miles", () => {
    expect(miles(12.345)).toBe("12.3 mi");
    expect(miles(undefined)).toBe("—");
  });
  test("eta", () => {
    expect(eta(0)).toBe("—");
    expect(eta(45)).toBe("45 min");
    expect(eta(60)).toBe("1h");
    expect(eta(135)).toBe("2h 15m");
  });
});

describe("contactVisible (R37 parity)", () => {
  const base: Booking = {
    id: "b1",
    job_id: "j1",
    customer_id: "c1",
    driver_id: "d1",
    status: "deposit_paid",
    payment_status: "pending",
    created_at: "2026-02-01T00:00:00Z",
  };
  test("hidden pre-payment", () => {
    expect(contactVisible(base)).toBe(false);
  });
  test("hidden paid but pre-travelling", () => {
    expect(contactVisible({ ...base, payment_status: "paid", status: "confirmed" })).toBe(false);
  });
  test("visible paid + active", () => {
    expect(contactVisible({ ...base, payment_status: "paid", status: "travelling" })).toBe(true);
  });
});
