import { describe, expect, it } from "vitest";
import { hasWasmMagicBytes } from "@/lib/sw/wasmIntegrity";

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

describe("hasWasmMagicBytes", () => {
  it("accepts a buffer starting with the wasm magic number", () => {
    expect(hasWasmMagicBytes(bytes(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00))).toBe(
      true,
    );
  });

  it("rejects an HTML page compiled in place of the binary", () => {
    // 3c 21 44 4f is '<!DO', the start of '<!DOCTYPE html>'.
    expect(hasWasmMagicBytes(bytes(0x3c, 0x21, 0x44, 0x4f))).toBe(false);
  });

  it("rejects a buffer shorter than the magic number", () => {
    expect(hasWasmMagicBytes(bytes(0x00, 0x61))).toBe(false);
  });

  it("rejects an empty buffer", () => {
    expect(hasWasmMagicBytes(bytes())).toBe(false);
  });
});
