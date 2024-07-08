import { path } from "../index.js";
import { processDataWithGPU } from "./gpuCalc.js";

// Función para procesar el archivo CSV
export async function processFile(device) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error("No se pudo cargar el archivo.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let partialLine = "";
    const BATCH_SIZE = 15 * 1000;
    let data = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      partialLine += chunk;

      const lines = partialLine.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line) {
          data.push(line);
        }
      }

      if (data.length >= BATCH_SIZE) {
        await processDataWithGPU(device, data);
        data = [];
      }

      partialLine = lines[lines.length - 1];
    }

    if (partialLine) {
      data.push(partialLine);
    }

    if (data.length > 0) {
      await processDataWithGPU(device, data);
    }
  } catch (error) {
    console.error("Error al procesar el archivo:", error);
    alert("Error al procesar el archivo.");
    throw error;
  }
}
