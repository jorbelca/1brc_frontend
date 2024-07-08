import { processFile } from "./processFile.js";

export async function initWebGPU() {
  try {
    if (!navigator.gpu) {
      throw Error("WebGPU not supported.");
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "low-power",
    });
    if (!adapter) {
      throw Error("Couldn't request WebGPU adapter.");
    }

    const device = await adapter.requestDevice({
      requiredFeatures: ["shader-f16"],
    });

    return await processFile(device);
  } catch (error) {
    console.error("Error al inicializar WebGPU:", error);
    alert("Error al inicializar WebGPU.");
    throw error;
  }
}



//float16 -> https://developer.chrome.com/blog/io24-webassembly-webgpu-2