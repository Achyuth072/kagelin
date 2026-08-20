import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { TelemetryConsentPrompt } from "@/components/telemetry/TelemetryConsentPrompt";
import { PrivacySection } from "@/components/settings/PrivacySection";
import {
  TELEMETRY_CONSENT_KEY,
  TELEMETRY_DEVICE_ID_KEY,
  getTelemetryConsent,
  setTelemetryConsent,
} from "@/lib/telemetry/store";
import * as telemetryClient from "@/lib/telemetry/client";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: () => true,
}));

describe("Telemetry Consent UI and Privacy Settings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    telemetryClient.clearTelemetryQueue();
  });

  describe("TelemetryConsentPrompt", () => {
    it("renders prompt when telemetry consent is unprompted", async () => {
      render(<TelemetryConsentPrompt />);

      await waitFor(() => {
        expect(
          screen.getByText(/Kagelin is open source & privacy-first/i),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: /^enable$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^no thanks$/i }),
      ).toBeInTheDocument();
    });

    it("does not render prompt when consent is already granted", async () => {
      setTelemetryConsent("granted");
      render(<TelemetryConsentPrompt />);

      await waitFor(() => {
        expect(
          screen.queryByText(/Kagelin is open source & privacy-first/i),
        ).not.toBeInTheDocument();
      });
    });

    it("does not render prompt when consent is already denied", async () => {
      setTelemetryConsent("denied");
      render(<TelemetryConsentPrompt />);

      await waitFor(() => {
        expect(
          screen.queryByText(/Kagelin is open source & privacy-first/i),
        ).not.toBeInTheDocument();
      });
    });

    it("grants consent, generates device id, and tracks app_opened on clicking Enable", async () => {
      render(<TelemetryConsentPrompt />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^enable$/i }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /^enable$/i }));

      await waitFor(() => {
        expect(getTelemetryConsent()).toBe("granted");
        expect(localStorage.getItem(TELEMETRY_CONSENT_KEY)).toBe("granted");
        expect(localStorage.getItem(TELEMETRY_DEVICE_ID_KEY)).toBeTruthy();
      });

      const queued = telemetryClient.getTelemetryQueue();
      expect(queued).toContainEqual(
        expect.objectContaining({
          name: "app_opened",
          properties: expect.objectContaining({
            display_mode: expect.stringMatching(/^(standalone|browser)$/),
            platform: expect.stringMatching(/^(ios|android|desktop)$/),
          }),
        }),
      );

      await waitFor(() => {
        expect(
          screen.queryByText(/Kagelin is open source & privacy-first/i),
        ).not.toBeInTheDocument();
      });
    });

    it("denies consent and closes prompt on clicking No thanks", async () => {
      render(<TelemetryConsentPrompt />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^no thanks$/i }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /^no thanks$/i }));

      await waitFor(() => {
        expect(getTelemetryConsent()).toBe("denied");
        expect(localStorage.getItem(TELEMETRY_CONSENT_KEY)).toBe("denied");
        expect(localStorage.getItem(TELEMETRY_DEVICE_ID_KEY)).toBeNull();
      });

      await waitFor(() => {
        expect(
          screen.queryByText(/Kagelin is open source & privacy-first/i),
        ).not.toBeInTheDocument();
      });
    });

    it("denies consent and closes prompt on clicking Dismiss (X) button", async () => {
      render(<TelemetryConsentPrompt />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^dismiss$/i }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /^dismiss$/i }));

      await waitFor(() => {
        expect(getTelemetryConsent()).toBe("denied");
        expect(localStorage.getItem(TELEMETRY_CONSENT_KEY)).toBe("denied");
      });
    });
  });

  describe("PrivacySection in Settings", () => {
    it("renders switch unchecked when consent is unprompted", async () => {
      render(<PrivacySection />);

      const toggle = screen.getByRole("switch", {
        name: /share anonymous telemetry/i,
      });
      expect(toggle).not.toBeChecked();
    });

    it("renders switch unchecked on the server, before consent has loaded from localStorage", () => {
      const html = renderToString(<PrivacySection />);
      expect(html).toContain('aria-checked="false"');
      expect(html).not.toContain('aria-checked="true"');
    });

    it("renders switch unchecked when consent is denied", async () => {
      setTelemetryConsent("denied");
      render(<PrivacySection />);

      const toggle = screen.getByRole("switch", {
        name: /share anonymous telemetry/i,
      });
      expect(toggle).not.toBeChecked();
    });

    it("renders switch checked when consent is granted", async () => {
      setTelemetryConsent("granted");
      render(<PrivacySection />);

      const toggle = screen.getByRole("switch", {
        name: /share anonymous telemetry/i,
      });
      expect(toggle).toBeChecked();
    });

    it("enables telemetry when switched from off to on", async () => {
      render(<PrivacySection />);

      const toggle = screen.getByRole("switch", {
        name: /share anonymous telemetry/i,
      });
      expect(toggle).not.toBeChecked();

      fireEvent.click(toggle);

      await waitFor(() => {
        expect(getTelemetryConsent()).toBe("granted");
        expect(localStorage.getItem(TELEMETRY_CONSENT_KEY)).toBe("granted");
        expect(localStorage.getItem(TELEMETRY_DEVICE_ID_KEY)).toBeTruthy();
      });

      const queued = telemetryClient.getTelemetryQueue();
      expect(queued).toContainEqual(
        expect.objectContaining({
          name: "app_opened",
          properties: expect.objectContaining({
            display_mode: expect.stringMatching(/^(standalone|browser)$/),
            platform: expect.stringMatching(/^(ios|android|desktop)$/),
          }),
        }),
      );
    });

    it("disables telemetry and immediately purges device ID when switched from on to off", async () => {
      setTelemetryConsent("granted");
      expect(localStorage.getItem(TELEMETRY_DEVICE_ID_KEY)).toBeTruthy();

      render(<PrivacySection />);

      const toggle = screen.getByRole("switch", {
        name: /share anonymous telemetry/i,
      });
      expect(toggle).toBeChecked();

      fireEvent.click(toggle);

      await waitFor(() => {
        expect(getTelemetryConsent()).toBe("denied");
        expect(localStorage.getItem(TELEMETRY_CONSENT_KEY)).toBe("denied");
        expect(localStorage.getItem(TELEMETRY_DEVICE_ID_KEY)).toBeNull();
      });
    });
  });
});
