import { processDataWithGPU } from "./gpuCalc.js";

//Script to test that the webgpu works

export async function testProcessDataWithGPU() {
  if (!navigator.gpu) {
    console.error("WebGPU no es compatible con este navegador.");
    return;
  }

  // Inicializar el adaptador y el dispositivo
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  // Datos de prueba
  const testData = [
    "StationA;25.3 StationB;30.1 StationA;26.7 StationB;29.5 StationC;22.0",
  ];
  // Llamar a la función processDataWithGPU
  const results = await processDataWithGPU(device, testData);

  // Valores esperados
  const expectedResults = {
    StationA: { min: 25.3, max: 26.7, avg: (25.3 + 26.7) / 2 },
    StationB: { min: 29.5, max: 30.1, avg: (30.1 + 29.5) / 2 },
    StationC: { min: 22.0, max: 22.0, avg: 22.0 },
  };

  // Verificar los resultados
  let allTestsPassed = true;
  for (const station in expectedResults) {
    const expected = expectedResults[station];
    const actual = results[station];

    if (!actual) {
      console.error(`No se encontraron resultados para ${station}`);
      allTestsPassed = false;
      continue;
    }

    const minMatch = Math.abs(expected.min - actual.min) < 0.001;
    const maxMatch = Math.abs(expected.max - actual.max) < 0.001;
    const avgMatch = Math.abs(expected.avg - actual.avg) < 0.001;

    if (!minMatch || !maxMatch || !avgMatch) {
      console.error(
        `Los resultados para ${station} no coinciden. Esperado: ${JSON.stringify(
          expected
        )}, Actual: ${JSON.stringify(actual)}`
      );
      allTestsPassed = false;
    }
  }

  if (allTestsPassed) {
    console.log("Todos los tests pasaron correctamente.");
  } else {
    console.log("Algunos tests fallaron.");
  }
}
