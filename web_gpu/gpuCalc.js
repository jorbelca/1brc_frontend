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
    code: /*glsl*/ `
     enable f16;

      struct StationData 
      { minTemp: f16,
        maxTemp: f16,
        sumTemp: f16,
        count: u32,
      };

      @group(0) @binding(0) var<storage, read_write> dataBuffer: array<f16>;
      @group(0) @binding(1) var<storage, read_write> resultBuffer: array<StationData>;

      @compute @workgroup_size(256)
      fn main(@builtin(global_invocation_id) global_id: vec3<f16>) {
        let index = global_id.x;

        // Leer la línea del buffer de datos
        var line: array<f16, 256>; // Suponer longitud máxima de línea
        for (var i = 0; i < 256; i = i + 1) {
          line[i] = dataBuffer[index * 256 + i];
        }

        // Buscar el separador ';' y extraer la estación y temperatura
        var stationHash: f16 = 0;
        var temperature: f16 = 0.0;
        var parsingTemperature = false;
        var tempString: array<u8, 16>;
        var tempIndex = 0;

        for (var i = 0; i < 256; i = i + 1) {
          if (line[i] == 59) { // ';'
            parsingTemperature = true;
          } else if (parsingTemperature) {
            tempString[tempIndex] = line[i];
            tempIndex = tempIndex + 1;
          } else {
            stationHash = stationHash * 31 + f16(line[i]); // Hash simple de estación
          }
        }

        // Convertir tempString a f32
        var tempStr ;
        for (var i = 0; i < tempIndex; i = i + 1) {
          tempStr = tempStr + f16(tempString[i] - 48) * pow(10, tempIndex - i - 1);
        }
        temperature = f16(tempStr);

        // Actualizar resultados
        let result = &resultBuffer[stationHash % resultBuffer.length];
        atomicMin(&result.minTemp, temperature);
        atomicMax(&result.maxTemp, temperature);
        atomicAdd(&result.sumTemp, temperature);
        atomicAdd(&result.count, 1);
      }
    `,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
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
