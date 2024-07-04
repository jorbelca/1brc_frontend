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

export async function processLargeFile() {
  try {
    const BLOCK_SIZE = 15000;
    const WORKER_COUNT = navigator.hardwareConcurrency || 2;

    // Get the file with fetch
    const response = await fetch(path);

    // Create the reader
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    //Buffer for the process
    let buffer = "";

    // Create an array of  new workers
    const workers = Array.from(
      { length: WORKER_COUNT },
      () => new Worker("./web_workers/worker.js")
    );
    let workerIndex = 0;

    function getNextWorker() {
      workerIndex = (workerIndex + 1) % WORKER_COUNT;
      return workers[workerIndex];
    }

    // Promises to track worker completion
    const workerPromises = workers.map((worker) => {
      new Promise((resolve) => {
        worker.onmessage = function (event) {
          if (event.data === "done") {
            resolve();
          }
        };
      });
    });

    // Function to process block using workers
    async function processBlockWithWorker(block) {
      const worker = getNextWorker();
      const promise = new Promise((resolve) => {
        worker.onmessage = function (event) {
          if (event.data === "done") {
            resolve();
          }
        };
      });

      worker.postMessage({ block });
      await promise;
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
        console.log("Proceso completado correctamente");

        await Promise.all(workerPromises);
        workers.forEach((worker) => worker.terminate());
        break;
      }

      //call the function
      await readBlock(value);
    }
  } catch (error) {
    console.error(error);
  }
}
// Init Timer
const start = performance.now();
//Call to the function

processLargeFile().then(() => {
  //End timer
  const end = performance.now();
  console.log(convertTime(end - start));
});

export function convertTime(durationMs) {
  //Convert to minuts and seconds
  const minutes = Math.floor(durationMs / (1000 * 60));
  const seconds = ((durationMs % (1000 * 60)) / 1000).toFixed(2);
  return `Duration: ${minutes} minutes ${seconds} seconds`;
}
