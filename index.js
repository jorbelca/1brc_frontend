import { test } from "./js_vainilla/vainilla.js";

const path = "./1brc/measurements.txt";

async function processLargeFile(processBlock) {
  // Get the file with fetch
  const response = await fetch(path);

  // Create the reader
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  //Buffer for the process
  let buffer = "";

  //1 million lines
  const BLOCK_SIZE = 1000 * 1000;

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
      await processBlock(block.join("\n"));
    }

    // Update the buffer
    buffer = lines.join("\n");
  }

  // Infinite bucle to read the file
  while (true) {
    // Read a fragment
    const { done, value } = await reader.read();

    // End the reading
    if (done) {
      // If there is data in the "block", it process it
      if (buffer.length > 0) {
        await processBlock(buffer);
      }

      console.log("Proceso completado correctamente");

      break;
    }

    //call the function
    await readBlock(value);
  }
}

// Llama a la función con la ruta del archivo y la función de procesamiento
processLargeFile(test);
