importScripts("../js_vainilla/vainilla.js");

self.onmessage = async function (event) {
  const { block } = event.data;
  try {
    // Process function
    test(block);
    self.postMessage("done");
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
