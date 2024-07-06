importScripts("../js_vainilla/vainilla.js");

self.onmessage = async function (event) {
  const { block } = event.data;
  //Process function
  parseAndCalculate(block);

  self.postMessage("done");
};
