import '@testing-library/jest-dom/vitest';

// jsdom 26 exposes Blob but does not implement the browser's arrayBuffer() helper.
// Keep the test environment close enough to a real browser for local archive/audio fixtures.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Object.defineProperty(Blob.prototype, 'arrayBuffer', {
    configurable: true,
    value: function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Could not read Blob fixture.'));
        reader.onload = () => {
          if (!(reader.result instanceof ArrayBuffer)) {
            reject(new Error('Blob fixture did not produce an ArrayBuffer.'));
            return;
          }
          resolve(reader.result);
        };
        reader.readAsArrayBuffer(this);
      });
    },
  });
}
