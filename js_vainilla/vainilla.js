function parseAndCalculate(block) {
  //The task is to write a  program which reads the file, calculates the min, mean, and max temperature value per weather station,
  // and emits the results on stdout like this(i.e. sorted alphabetically by station name, 
  //and the result values per station in the format `<min>/<mean>/<max>`, rounded to one fractional digit):
  let stations = {};
  const dataSeparated = block.split("\n");

  // Primer paso: Poblar el objeto stations
  for (let i = 0; i < dataSeparated.length; i++) {
    const [city, tempStr] = dataSeparated[i].split(";");
    const temp = parseFloat(tempStr);

    if (!stations[city]) {
      stations[city] = { temps: [] };
    }

    stations[city].temps.push(temp);
  }

  // Segundo paso: Calcular estadísticas y generar resultados ordenados
  stations = Object.keys(stations)
    .sort()
    .map((city) => {
      const temps = stations[city].temps;
      const count = temps.length;
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      const sum = temps.reduce((acc, t) => acc + t, 0);
      const mean = (sum / count).toFixed(1);

      return `${city}: ${min.toFixed(1)}/${mean}/${max.toFixed(1)}`;
    });
  return stations;

  // Emitir los resultados
  //results.forEach((res) => console.log(`${res.city}: ${res.result}`));
}

self.parseAndCalculate = parseAndCalculate;
