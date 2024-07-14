var Module = {
  onRuntimeInitialized: function () {
    self.process_chunk = Module.cwrap("process_chunk", null, ["string"]);
    self.get_results = Module.cwrap("get_results", "number", []);
    self.free_results = Module.cwrap("free_results", null, ["number"]);
  },
};

// Función para convertir puntero UTF-8 a cadena
function UTF8ToString(ptr) {
  const memory = new Uint8Array(importObject.env.memory.buffer);
  let endPtr = ptr;
  while (memory[endPtr]) ++endPtr;
  return new TextDecoder("utf-8").decode(memory.subarray(ptr, endPtr));
}

const importObject = {
  env: {
    memory: new WebAssembly.Memory({ initial: 65536, maximum: 65536 }),
    table: new WebAssembly.Table({
      memoryBase: 0,
      tableBase: 0,
      initial: 0,
      maximum: 0,
      element: "anyfunc",
    }),
    abort: console.error,
    __cxa_throw: () => {},
    _emscripten_memcpy_js: () => {},
    emscripten_resize_heap: () => {},
    _abort_js: () => {},
    _tzset_js: () => {},
    __assert_fail: () => {},
  },
  wasi_snapshot_preview1: {
    fd_write: () => {},
    fd_close: () => {},
    environ_sizes_get: () => {},
    environ_get: () => {},
    fd_seek: () => {},
  },
};

async function processWithWASM(block) {
  try {
    let scriptFile;
    // Cargar el script WASM
    try {
      scriptFile = await fetch("/wasm/processDataWithC++.wasm");
    } catch (error) {
      console.error("Error al cargar el archivo:" + error);
    }

    const { instance } = await WebAssembly.instantiateStreaming(
      scriptFile,
      importObject
    );

    // Asignar las funciones exportadas a `Module`
    Module.process_chunk = instance.exports.process_chunk;
    Module.get_results = instance.exports.get_results;
    Module.free_results = instance.exports.free_results;

    // Procesar el bloque
    Module.process_chunk(block);

    // Obtener los resultados
    const resultPtr = Module.get_results();

    // Convertir el puntero a una cadena de texto
    const result = UTF8ToString(resultPtr);

    Module.free_results(resultPtr);

    return result;
  } catch (error) {
    console.error("Error al cargar el módulo WASM:", error);
    throw error;
  }
}

self.processWithWASM = processWithWASM;
