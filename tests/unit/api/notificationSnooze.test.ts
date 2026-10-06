import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/../app/api/notifications/snooze/route";

const mockGetClaims = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getClaims: mockGetClaims },
      rpc: mockRpc,
    }),
  ),
}));

const REF_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/notifications/snooze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function signedIn() {
  mockGetClaims.mockResolvedValue({
    data: { claims: { sub: "user-1" } },
    error: null,
  });
}

describe("POST /api/notifications/snooze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user is authenticated", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null });

    const res = await POST(
      makeRequest({ type: "due_date", referenceId: REF_UUID }),
    );

    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 for a type that is not a snoozable reminder", async () => {
    signedIn();

    const res = await POST(
      makeRequest({ type: "habit_reminder", referenceId: REF_UUID }),
    );

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 when referenceId is not a uuid", async () => {
    signedIn();

    const res = await POST(
      makeRequest({ type: "event_reminder", referenceId: "abc" }),
    );

    expect(res.status).toBe(400);
  });

  it("snoozes through the RPC", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "snoozed", error: null });

    const res = await POST(
      makeRequest({ type: "event_reminder", referenceId: REF_UUID }),
    );

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("snooze_reminder", {
      p_type: "event_reminder",
      p_reference_id: REF_UUID,
    });
  });

  it("returns 200 when the item is gone, since there is nothing left to remind", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "dropped", error: null });

    const res = await POST(
      makeRequest({ type: "due_date", referenceId: REF_UUID }),
    );

    expect(res.status).toBe(200);
  });

  it("returns 400 when there is no sent reminder to snooze", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "not_found", error: null });

    const res = await POST(
      makeRequest({ type: "due_date", referenceId: REF_UUID }),
    );

    expect(res.status).toBe(400);
  });

  it("returns 500 when the RPC errors", async () => {
    signedIn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const res = await POST(
      makeRequest({ type: "due_date", referenceId: REF_UUID }),
    );

    expect(res.status).toBe(500);
  });
});
