export async function processDataWithGPU(device, data) {
  // Verificar que data sea un arreglo de strings
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Los datos proporcionados no son válidos.");
  }
  // Preparar datos para la GPU
  const encoder = new TextEncoder();
  let dataStr = data.map((item) => item + "\n").join("");
  let encodedData = encoder.encode(dataStr);

  // Alinear los datos a múltiplos de 4
  const padding = (4 - (encodedData.byteLength % 4)) % 4;
  if (padding > 0) {
    const paddedData = new Uint8Array(encodedData.byteLength + padding);
    paddedData.set(encodedData);
    encodedData = paddedData;
  }

  // Crear buffer en la GPU
  const dataBuffer = device.createBuffer({
    size: encodedData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Escribir los datos en el buffer
  device.queue.writeBuffer(dataBuffer, 0, encodedData);

  // Crear buffer para resultados (min, max, sum, count por estación)
  const numStations = 10000; // Suponer un máximo de 1000 estaciones para simplicidad
  const resultBufferSize = 4 * 4 * numStations; // Min, Max, Sum, Count por cada estación
  const resultBuffer = device.createBuffer({
    size: resultBufferSize,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });
  // In structs, WebGPU uses comma to separate values, WebGL ;
  const shaderModule = device.createShaderModule({
    code: /*wgsl*/ `
      struct StationData {
        minTemp: f32,
        maxTemp: f32,
        sumTemp: f32,
        count: u32,
      };

      @group(0) @binding(0) var<storage, read> dataBuffer: array<u32>;
      @group(0) @binding(1) var<storage, read_write> resultBuffer: array<StationData>;

     const NUM_STATIONS: u32 = 10000u;

      @compute @workgroup_size(256)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index:u32 = global_id.x;

        // Leer la línea del buffer de datos
        var line: array<u32, 64>; // Suponer longitud máxima de línea en palabras de 4 bytes
        for (var i:u32 = 0u; i < 64u; i = i + 1u) {
          line[i] = dataBuffer[index * 64u + i];
        }

        // Buscar el separador ';' y extraer la estación y temperatura
        var stationHash: u32 = 0u;
        var temperature: f32 = 0.0;
        var parsingTemperature = false;
        var tempString: array<u32, 16>;
        var tempIndex:u32 = 0u;

         for (var i:u32 = 0u; i < 64u; i = i + 1u) {
          let char = line[i] & 0xFFu;
          if (char == 59u) { // ';'
            parsingTemperature = true;
          } else if (parsingTemperature) {
            tempString[tempIndex] = char;
            tempIndex = tempIndex + 1u;
          } else {
            stationHash = stationHash * 31u + char; // Hash simple de estación
          }
        }

        // Convertir tempString a f32
        var tempStr: f32 = 0.0;
        for (var i:u32 = 0u; i < tempIndex; i = i + 1u) {
          tempStr = tempStr + f32(tempString[i] - 48u) * pow(10.0, f32(tempIndex - i - 1u));
        }
        temperature = tempStr;

        // Actualizar resultados
        let resultIndex = stationHash % NUM_STATIONS;
        let result = &resultBuffer[resultIndex];
        result.minTemp = min(result.minTemp, temperature);
        result.maxTemp = max(result.maxTemp, temperature);
        result.sumTemp = result.sumTemp + temperature;
        result.count = result.count + 1u;
      }
    `,
  });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const computePipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: "main",
    },
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: dataBuffer } },
      { binding: 1, resource: { buffer: resultBuffer } },
    ],
  });

  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, bindGroup);
  computePass.dispatchWorkgroups(Math.ceil(data.length / 256));
  computePass.end();

  device.queue.submit([commandEncoder.finish()]);

  // Leer resultados de la GPU
  const resultReadBuffer = device.createBuffer({
    size: resultBufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const copyEncoder = device.createCommandEncoder();
  copyEncoder.copyBufferToBuffer(
    resultBuffer,
    0,
    resultReadBuffer,
    0,
    resultBufferSize
  );
  device.queue.submit([copyEncoder.finish()]);

  await resultReadBuffer.mapAsync(GPUMapMode.READ);
  const resultArray = new Float32Array(resultReadBuffer.getMappedRange());

  const results = {};
  for (let i = 0; i < resultArray.length; i += 4) {
    const station = i / 4;
    const minTemp = resultArray[i];
    const maxTemp = resultArray[i + 1];
    const sumTemp = resultArray[i + 2];
    const count = resultArray[i + 3];
    if (count > 0) {
      const avgTemp = sumTemp / count;
      results[station] = { min: minTemp, max: maxTemp, avg: avgTemp };
    }
  }

  resultReadBuffer.unmap();
  return results;
}
