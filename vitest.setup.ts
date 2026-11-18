import "@testing-library/jest-dom/vitest";

// jsdom does not always expose randomUUID; the UI uses it for local file ids.
const cryptoObject: Crypto =
  globalThis.crypto ??
  ({
    getRandomValues: (array: Uint8Array) => array,
  } as unknown as Crypto);

if (typeof cryptoObject.randomUUID !== "function") {
  Object.defineProperty(cryptoObject, "randomUUID", {
    value: () =>
      `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`,
    configurable: true,
  });
}

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: cryptoObject, configurable: true });
}
