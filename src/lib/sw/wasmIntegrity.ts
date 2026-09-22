// 00 61 73 6d is the WebAssembly binary magic number ("\0asm").
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];

export function hasWasmMagicBytes(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < WASM_MAGIC.length) return false;
  const bytes = new Uint8Array(buffer, 0, WASM_MAGIC.length);
  return WASM_MAGIC.every((byte, index) => bytes[index] === byte);
}
