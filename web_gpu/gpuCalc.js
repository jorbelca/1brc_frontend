export async function processDataWithGPU(device, data) {
  // Verificar que data sea un arreglo de strings
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Los datos proporcionados no son válidos.");
  }

  const stations = new Map();
  const encodedData = [];

  data = data.toString().split(" ");
  // Iterar sobre los datos para construir el array de datos
  for (let line of data) {
    // Dividir la línea en estación y temperatura
    const [station, temp] = line.split(";");
    let stationCode;

    if (!stations.has(station)) {
      stationCode = stations.size;
      stations.set(station, stationCode);
    } else {
      stationCode = stations.get(station);
    }

    // Añadir estación y temperatura al array
    encodedData.push(stationCode);
    encodedData.push(parseFloat(temp));
  }
  console.log("Datos de entrada:" + encodedData);
  // Crear buffer en la GPU
  const dataBuffer = device.createBuffer({
    size: encodedData.length * 4, // 2 elementos (station, temp) por cada entrada, 4 bytes por float
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Escribir los datos en el buffer
  const dataArray = new Float32Array(encodedData);
  device.queue.writeBuffer(dataBuffer, 0, dataArray);

  // Crear buffer para resultados (min, max, sum, count por estación)
  const numStations = stations.size;
  const resultBufferSize = 4 * 4 * numStations; // Min, Max, Sum, Count por cada estación
  const resultBuffer = device.createBuffer({
    size: resultBufferSize,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  // In structs, WebGPU uses comma to separate values, WebGL ;
  //https://google.github.io/tour-of-wgsl/types/structures/
  const shaderModule = device.createShaderModule({
    label: "Station Data compute temperature module",
    code: /*wgsl*/ `
       struct StationData {
        minTemp: f32,
        maxTemp: f32,
        sumTemp: f32,
        count: u32
      };

      @group(0) @binding(0) var<storage, read> dataBuffer: array<f32>;
      @group(0) @binding(1) var<storage, read_write> resultBuffer: array<StationData>;

      @compute @workgroup_size(256)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
       let index: u32 = global_id.x * 2u;

      if (index >= arrayLength(&dataBuffer)) {
        return;
      }

      let stationCode: u32 = u32(dataBuffer[index]);
      let temperature: f32 = bitcast<f32>(dataBuffer[index * 2u + 1u]);

        let result = &resultBuffer[stationCode];

        if (result.count == 0) {
          result.minTemp = temperature;
          result.maxTemp = temperature;
        } else {
          result.minTemp = min(result.minTemp, temperature);
          result.maxTemp = max(result.maxTemp, temperature);
        }

        result.sumTemp += temperature;
        result.count +=1;
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
  computePass.dispatchWorkgroups(Math.ceil(encodedData.length / 512));
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

  console.log(resultArray);
  const results = {};
  for (let [name, code] of stations.entries()) {
    const index = code * 4;
    const minTemp = resultArray[index];
    const maxTemp = resultArray[index + 1];
    const sumTemp = resultArray[index + 2];
    const count = resultArray[index + 3];

    console.log(name + " Count : " + count, name + " SumTemp : " + sumTemp);
    if (count > 0) {
      results[name] = {
        min: minTemp.toFixed(1),
        max: maxTemp.toFixed(1),
        avg: (sumTemp / count).toFixed(1),
      };
    }
  }

  console.log("Resultados:", JSON.stringify(results, null, 2));

  resultReadBuffer.unmap();
  return results;
}
