function test(block) {
  //The task is to write a  program which reads the file, calculates the min, mean, and max temperature value per weather station, and emits the results on stdout like this(i.e. sorted alphabetically by station name, and the result values per station in the format `<min>/<mean>/<max>`, rounded to one fractional digit):
  let stations = {};
  const dataSeparated = block.split("\n");
  for (let i = 0; i < dataSeparated.length; i++) {
    const [city, tempStr] = dataSeparated[i].split(";");
    const temp = parseFloat(tempStr);

    if (!stations[city]) {
      stations[city] = { temps: [], sum: 0, count: 0, min: temp, max: temp };
    }

    const station = stations[city];
    station.temps.push(temp);
    station.sum += temp;
    station.count += 1;
    if (temp < station.min) station.min = temp;
    if (temp > station.max) station.max = temp;
  }

  let results = [];

  for (let city in stations) {
    const { sum, count, min, max } = stations[city];
    const mean = (sum / count).toFixed(1);
    results.push({
      city,
      result: `${min.toFixed(1)}/${mean}/${max.toFixed(1)}`,
    });
  }

  results.sort((a, b) => a.city.localeCompare(b.city));

  // results.forEach(({ city, result }) => {
  //   console.log(`${city}: ${result}`);
  // });
}

self.test = test;
