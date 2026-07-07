import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { Turnstile, type TurnstileHandle } from "@/components/auth/Turnstile";

vi.mock("next/script", () => ({
  default: () => null,
}));

interface RenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  theme?: string;
}

describe("Turnstile (Supabase CAPTCHA widget)", () => {
  const mockRender = vi.fn(
    (_container: HTMLElement, _options: RenderOptions) => "widget-1",
  );
  const mockReset = vi.fn();
  const mockRemove = vi.fn();

  beforeEach(() => {
    mockRender.mockClear();
    mockReset.mockClear();
    mockRemove.mockClear();
    window.turnstile = {
      render: mockRender,
      reset: mockReset,
      remove: mockRemove,
    };
  });

  it("renders the widget into the container once window.turnstile is available", () => {
    render(<Turnstile siteKey="test-site-key" onVerify={vi.fn()} />);

    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockRender).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({ sitekey: "test-site-key" }),
    );
  });

  it("calls onVerify with the token produced by the widget's callback", () => {
    const onVerify = vi.fn();
    render(<Turnstile siteKey="test-site-key" onVerify={onVerify} />);

    const options = mockRender.mock.calls[0][1];
    options.callback("captcha-token-123");

    expect(onVerify).toHaveBeenCalledWith("captcha-token-123");
  });

  it("calls onExpire when the widget's expired-callback fires", () => {
    const onExpire = vi.fn();
    render(
      <Turnstile
        siteKey="test-site-key"
        onVerify={vi.fn()}
        onExpire={onExpire}
      />,
    );

    const options = mockRender.mock.calls[0][1];
    options["expired-callback"]?.();

    expect(onExpire).toHaveBeenCalled();
  });

  it("exposes reset() via handleRef, delegating to window.turnstile.reset", () => {
    const handleRef = createRef<TurnstileHandle>();
    render(
      <Turnstile
        siteKey="test-site-key"
        onVerify={vi.fn()}
        handleRef={handleRef}
      />,
    );

    handleRef.current?.reset();

    expect(mockReset).toHaveBeenCalledWith("widget-1");
  });

  it("removes the widget on unmount", () => {
    const { unmount } = render(
      <Turnstile siteKey="test-site-key" onVerify={vi.fn()} />,
    );
    unmount();

    expect(mockRemove).toHaveBeenCalledWith("widget-1");
  });
});
