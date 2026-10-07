import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/../app/api/tasks/complete/route";

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

const TASK_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/tasks/complete", {
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

describe("POST /api/tasks/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user is authenticated", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null });

    const res = await POST(makeRequest({ taskId: TASK_UUID }));

    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 when taskId is not a uuid", async () => {
    signedIn();

    const res = await POST(makeRequest({ taskId: "abc" }));

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("completes the task through the RPC", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "completed", error: null });

    const res = await POST(makeRequest({ taskId: TASK_UUID }));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("complete_task_from_notification", {
      p_task_id: TASK_UUID,
    });
  });

  it("returns 200 when the task is already completed", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "already_completed", error: null });

    const res = await POST(makeRequest({ taskId: TASK_UUID }));

    expect(res.status).toBe(200);
  });

  it("returns 400 for a task that is missing or not the user's", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "not_found", error: null });

    const res = await POST(makeRequest({ taskId: TASK_UUID }));

    expect(res.status).toBe(400);
  });

  it("returns 400 for a recurring task, which only the app can complete", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "recurring", error: null });

    const res = await POST(makeRequest({ taskId: TASK_UUID }));

    expect(res.status).toBe(400);
  });

  it("returns 500 when the RPC errors", async () => {
    signedIn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const res = await POST(makeRequest({ taskId: TASK_UUID }));

    expect(res.status).toBe(500);
  });
});
