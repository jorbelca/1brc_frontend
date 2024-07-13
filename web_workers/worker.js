importScripts("../js_vainilla/vainilla.js");
importScripts("../wasm/processWithWasm.js");

self.onmessage = async function (event) {
  const { block } = event.data;

  try {
    //Process function
    //VAINILLA_JS
    //const result = await parseAndCalculate(block);
    //WASM
    const result = await processWithWASM(block);
    self.postMessage({ status: "done", result });
  } catch (error) {
    self.postMessage({ status: "error", error: error.message });
  }
};
