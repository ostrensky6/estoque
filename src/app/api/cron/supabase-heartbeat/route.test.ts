import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { createClient } from "@supabase/supabase-js";

// Mock Supabase Client
vi.mock("@supabase/supabase-js", () => {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn().mockReturnValue({
    upsert: mockUpsert,
  });
  return {
    createClient: vi.fn().mockReturnValue({
      from: mockFrom,
    }),
  };
});

describe("Supabase Heartbeat Cron Route Handler", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it("returns 401 Unauthorized if CRON_SECRET is missing", async () => {
    process.env.CRON_SECRET = "";
    const request = new Request("http://localhost/api/cron/supabase-heartbeat", {
      headers: { authorization: "Bearer some-token" },
    });
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("returns 401 Unauthorized if Authorization header is incorrect", async () => {
    process.env.CRON_SECRET = "super-secret";
    const request = new Request("http://localhost/api/cron/supabase-heartbeat", {
      headers: { authorization: "Bearer wrong-token" },
    });
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("returns 500 if Supabase environment variables are missing", async () => {
    process.env.CRON_SECRET = "super-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";

    const request = new Request("http://localhost/api/cron/supabase-heartbeat", {
      headers: { authorization: "Bearer super-secret" },
    });
    const response = await GET(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Missing Supabase environment variables");
  });

  it("returns 200 OK and updates table on correct credentials", async () => {
    process.env.CRON_SECRET = "super-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.VERCEL_ENV = "test";
    process.env.VERCEL_URL = "test.vercel.app";

    const request = new Request("http://localhost/api/cron/supabase-heartbeat", {
      headers: { authorization: "Bearer super-secret" },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.app).toBe("Kontrol");
    expect(data.checked_at).toBeDefined();

    // Verify createClient was called correctly
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      expect.any(Object)
    );
  });
});
