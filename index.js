import { testRead } from "./testingOptimizations/testingReads.js";

const path = "./1brc/measurements.txt";

// Register the Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/web_workers/worker.js", { scope: "/web_workers/" })
    .then((registration) => {
      console.log("Service Worker registrado correctamente:", registration);
    })
    .catch((error) => {
      console.error("Error al registrar el Service Worker:", error);
    });
}

export async function processLargeFile(size) {
  const start = performance.now();
  // Get the file with fetch
  const response = await fetch(path);

  // Create the reader
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  //Buffer for the process
  let buffer = "";

  const BLOCK_SIZE = size;

  // Create a new worker
  const worker = new Worker("./web_workers/worker.js");

  let resolveWorkerPromise;
  // Promises to track worker completion
  let workerPromise = new Promise((resolve) => {
    resolveWorkerPromise = resolve;
  });
  worker.onmessage = function (event) {
    if (event.data === "done") {
      // Resolve the worker promise to indicate that the block has been processed
      resolveWorkerPromise();
    }
  };

  // Function to process block using workers
  function processBlockWithWorker(block) {
    workerPromise = new Promise((resolve) => {
      workerPromise.resolve = resolve();
      worker.postMessage({ block });
    });

    return workerPromise;
  }

  // Reads and process every fragment
  async function readBlock(chunk) {
    // Decodes and += to the buffer
    buffer += decoder.decode(chunk, { stream: true });

    // Divides the buffer in lines
    let lines = buffer.split("\n");

    while (lines.length > BLOCK_SIZE) {
      // Separates the blocks in the correct size
      const block = lines.splice(0, BLOCK_SIZE);

      // Process the block
      await processBlockWithWorker(block.join("\n"));
    }
    // Update the buffer
    buffer = lines.join("\n");
  }

  // // Infinite bucle to read the file
  while (true) {
    // Read a fragment
    const { done, value } = await reader.read();

    // End the reading
    if (done) {
      // If there is data in the "block", it process it
      if (buffer.length > 0) {
        await processBlockWithWorker(buffer);
      }
      const end = performance.now();

      console.log("Proceso completado correctamente");
      worker.terminate();

      return end - start;
    }

    //call the function
    await readBlock(value);
  }
}
// Init Timer

// Llama a la función con la ruta del archivo y la función de procesamiento
// processLargeFile().then(() => {
//   //End timer
// });

testRead();

export function convertTime(durationMs) {
  //Convert to minuts and seconds
  const minutes = Math.floor(durationMs / (1000 * 60));
  const seconds = ((durationMs % (1000 * 60)) / 1000).toFixed(2);
  return `Duration: ${minutes} minutes ${seconds} seconds`;
}
