/**
 * Push-token endpoint smoke tests. Verifies the shape of the requests
 * the mobile apps send to /users/me/push-tokens — enough coverage to
 * catch a regression in the endpoint URL / verb / body without needing
 * a live backend.
 */
import { saveToken } from "../src/api";
import { CustomerAPI, DriverAPI } from "../src/endpoints";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: (k: string) => Promise.resolve(store[k] ?? null),
      setItem: (k: string, v: string) => {
        store[k] = v;
        return Promise.resolve();
      },
      removeItem: (k: string) => {
        delete store[k];
        return Promise.resolve();
      },
    },
  };
});

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

beforeEach(async () => {
  await saveToken("t.customer");
});

function stubFetch(response: any = { ok: true }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  global.fetch = jest.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(response),
      json: async () => response,
    } as any;
  }) as any;
  return calls;
}

describe("push-token registration", () => {
  it("customer: POST /users/me/push-tokens with token + platform", async () => {
    const calls = stubFetch({ ok: true });
    await CustomerAPI.registerPushToken("ExponentPushToken[abc]", "ios");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/users\/me\/push-tokens$/);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      token: "ExponentPushToken[abc]",
      platform: "ios",
    });
  });

  it("driver: same endpoint reused via DriverAPI.registerPushToken", async () => {
    const calls = stubFetch({ ok: true });
    await DriverAPI.registerPushToken("ExponentPushToken[xyz]", "android");
    expect(calls[0].url).toMatch(/\/users\/me\/push-tokens$/);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      token: "ExponentPushToken[xyz]",
      platform: "android",
    });
  });

  it("unregisters via DELETE /users/me/push-tokens/{encoded-token}", async () => {
    const calls = stubFetch({ ok: true });
    await CustomerAPI.unregisterPushToken("ExponentPushToken[with special/chars]");
    expect(calls[0].init.method).toBe("DELETE");
    // '[' and ']' and '/' must be URL-encoded so path routing survives.
    expect(calls[0].url).toMatch(
      /\/users\/me\/push-tokens\/ExponentPushToken%5Bwith%20special%2Fchars%5D$/,
    );
  });
});
