import { path } from "../index.js";

//Function to process the csv
export async function processWithWASM() {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error("No se pudo cargar el archivo.");
    }
    //Charge the wasm script
    const scriptFile = await fetch("wasm/processDataWithC++.wasm");
    const bytes = await scriptFile.arrayBuffer();

    let asmLibraryArg = {
      __memory_base: 0,
      __table_base: 0,
      __handle_stack_overflow: () => {},
      emscripten_resize_heap: () => {},
      _emscripten_resize_heap: () => {},
      _emscripten_memcpy_js: () => {},
      fd_seek: () => {},
      fd_write: () => {},
      fd_read: () => {},
      fd_close: () => {},
      environ_sizes_get: () => {},
      environ_get: () => {},
      _tzset_js: () => {},
      __lock: () => {},
      __unlock: () => {},
      memory: new WebAssembly.Memory({ initial: 0, maximum: 256 }),
      table: new WebAssembly.Table({
        initial: 1,
        maximum: 1,
        element: "anyfunc",
      }),
      abort: console.error,
      _abort_js: console.error,
      __assert_fail: console.error,
      __cxa_throw: function (ptr, type, destructor) {
        throw new Error(
          "cxa_throw called: ptr=" +
            ptr +
            ", type=" +
            type +
            ", destructor=" +
            destructor
        );
      },
    };

    const { instance } = await WebAssembly.instantiate(bytes, {
      env: asmLibraryArg,
      wasi_snapshot_preview1: asmLibraryArg,
    });

    // Exported C++ functions
    const { exports } = instance;
    const { process_and_get_results, _malloc, _free } = exports;

    //Variables to read the file
    const chunkSize = 1 * 1024; // 1 MB
    let offset = 0;

    const readNextChunk = async () => {
      while (offset < response.bodyUsed) {
        const chunk = await response.body.getReader().read();
        if (chunk.done) break;

        // Codificar el fragmento y pasarlo al módulo Wasm
        const encodedData = new Uint8Array(chunk.value);
        const dataPtr = _malloc(encodedData.length + 1);

        if (dataPtr === 0) {
          throw new Error("No se pudo asignar memoria.");
        }

        const data = new Uint8Array(
          instance.exports.memory.buffer,
          dataPtr,
          encodedData.length + 1
        );
        data.set(encodedData);
        data[encodedData.length] = 0; // Null-terminate the string

        process_and_get_results(dataPtr);
        _free(dataPtr);

        offset += chunkSize;
      }

      // Obtener y mostrar resultados finales
      const resultsPtr = process_and_get_results();
      const results = new TextDecoder("utf-8").decode(
        new Uint8Array(instance.exports.memory.buffer, resultsPtr)
      );

      console.log("Archivo procesado completamente:" + results);
    };

    await readNextChunk();
  } catch (error) {
    console.error("Error al procesar el archivo:", error);
    alert("Error al procesar el archivo.");
    throw error;
  }
}

//To compile the C++ file
// emcc processDataWithC++.cpp -o processDataWithC++.js \
// -s WASM=1 \
// -s EXPORTED_FUNCTIONS="['_process_and_get_results', '_malloc', '_free']" \
// -s EXPORTED_RUNTIME_METHODS="['cwrap', 'getValue']" \
// --no-entry \
// --std=c++17
