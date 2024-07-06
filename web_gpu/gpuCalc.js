import { path } from "../index.js";

export async function initWebGPU() {
  try {
    if (!navigator.gpu) {
      throw Error("WebGPU not supported.");
    }

    // Obtener un adaptador de GPU
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "low-power",
    });

    if (!adapter) {
      throw Error("Couldn't request WebGPU adapter.");
    }

    // Solicitar dispositivo
    const device = await adapter.requestDevice();

    // Definir shader de cómputo en WebGPU
    const computeShaderModule = device.createShaderModule({
      code: `
        struct Temperatures {
         temperatures : array<f32>
        };
    
        @group(0) @binding(0) var<storage, read_write> temperatures: Temperatures;
    
        @compute @workgroup_size(1)
        fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
          let temp = temperatures.temperatures[GlobalInvocationID.x];
          // Aquí podrías realizar cálculos más complejos si es necesario
        }
      `,
    });

    // Función para procesar archivo CSV dado el path
    async function processFile() {
      try {
        const response = await fetch(path);

        if (!response.ok) {
          throw new Error("No se pudo cargar el archivo.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let temperatures = [];
        let partialLine = "";
        const BATCH_SIZE = 15000;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          partialLine += chunk;

          const lines = partialLine.split("\n");

          // Procesar todas las líneas menos la última incompleta
          for (let i = 0; i < lines.length - 1; i++) {
            const [, tempStr] = lines[i].split(";");
            if (tempStr) {
              const temp = parseFloat(tempStr);
              if (!isNaN(temp)) {
                temperatures.push(temp);
              }
            }
          }

          // Mantener la última línea incompleta para la próxima iteración
          partialLine = lines[lines.length - 1];
          // Procesar el lote si es grande
          if (temperatures.length >= BATCH_SIZE) {
            await processBatch(temperatures);
            temperatures = []; // Limpiar el lote después de procesar
          }
        }

        // Procesar la última línea
        const [, tempStr] = partialLine.split(";");
        if (tempStr) {
          const temp = parseFloat(tempStr);
          if (!isNaN(temp)) {
            temperatures.push(temp);
          }
        }
        // Procesar el lote final
        if (temperatures.length > 0) {
          await processBatch(temperatures);
        }
      } catch (error) {
        console.error("Error al procesar el archivo:", error);
        alert("Error al procesar el archivo.");
      }
    }

    async function processBatch(temperatures) {
      // Crear buffer en GPU
      const buffer = device.createBuffer({
        size: temperatures.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(buffer, 0, new Float32Array(temperatures));

      // Crear bind group layout
      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
              type: "storage",
            },
          },
        ],
      });

      // Crear pipeline layout
      const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });

      // Crear pipeline de cómputo
      const computePipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: {
          module: computeShaderModule,
          entryPoint: "main",
        },
      });

      // Crear bind group
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: {
              buffer: buffer,
            },
          },
        ],
      });

      // Ejecutar el cálculo en GPU
      const commandEncoder = device.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(temperatures.length / 256); // Dispatch por cada temperatura
      computePass.end();

      device.queue.submit([commandEncoder.finish()]);
    }
    processFile();
  } catch (error) {
    console.error("Error al inicializar WebGPU:", error);
    alert("Error al inicializar WebGPU.");
  }

  // Exponer función de procesamiento para la interfaz HTML (opcional)
}
