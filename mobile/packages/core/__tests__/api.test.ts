import { _setBaseUrlForTests, api, ApiError, baseUrl, saveToken } from "../src/api";

// AsyncStorage mock — keep tokens in-memory during tests.
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

const g: any = globalThis;

describe("api()", () => {
  beforeEach(() => {
    _setBaseUrlForTests("https://api.test.example");
    g.fetch = jest.fn();
  });

  afterEach(() => {
    _setBaseUrlForTests(null);
    delete g.fetch;
  });

  test("appends /api and returns parsed JSON on 200", async () => {
    g.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ hello: "world" }),
    });
    const res = await api<{ hello: string }>("/ping", { auth: false });
    expect(res).toEqual({ hello: "world" });
    const url = (g.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe("https://api.test.example/api/ping");
  });

  test("attaches bearer token when saved", async () => {
    await saveToken("tok-42");
    g.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    });
    await api("/whoami");
    const init = (g.fetch as jest.Mock).mock.calls[0][1];
    expect(init.headers.Authorization).toBe("Bearer tok-42");
    await saveToken(null);
  });

  test("throws ApiError with server detail on 4xx", async () => {
    g.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ detail: "Bad thing" }),
    });
    await expect(api("/x", { auth: false })).rejects.toBeInstanceOf(ApiError);
    try {
      await api("/x", { auth: false });
    } catch (e: any) {
      expect(e.status).toBe(400);
      expect(e.message).toBe("Bad thing");
    }
  });

  test("baseUrl is override-aware", () => {
    _setBaseUrlForTests("https://override.example/");
    // trailing slash stripped
    expect(baseUrl()).toBe("https://override.example");
  });
});
