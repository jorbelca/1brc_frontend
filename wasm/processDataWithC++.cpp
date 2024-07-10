#include <iostream>
#include <sstream>
#include <map> // Usar map para ordenar alfabéticamente
#include <limits>
#include <string>
#include <iomanip> // Para usar std::setprecision

// Estructura para almacenar los datos de cada estación
struct StationData
{
    double min_temp = std::numeric_limits<double>::max();
    double max_temp = std::numeric_limits<double>::lowest();
    double sum_temp = 0.0;
    int count = 0;
};

extern "C"
{
    // Función que procesa los datos y devuelve los resultados
    const char *process_and_get_results(const char *chunk)
    {
        std::map<std::string, StationData> stationMap;
        std::stringstream file(chunk);
        std::string line;

        while (std::getline(file, line))
        {
            std::stringstream ss(line);
            std::string station;
            double temperature;

            if (std::getline(ss, station, ';') && ss >> temperature)
            {
                auto &data = stationMap[station];
                data.min_temp = std::min(data.min_temp, temperature);
                data.max_temp = std::max(data.max_temp, temperature);
                data.sum_temp += temperature;
                data.count++;
            }
        }

        std::ostringstream results;
        results << std::fixed << std::setprecision(2); // Establecer precisión de dos decimales

        if (stationMap.empty())
        {
            std::cout << "DEBUG: No hay datos en stationMap" << std::endl;
            return "";
        }

        for (const auto &pair : stationMap)
        {
            const auto &data = pair.second;
            double average_temp = data.count > 0 ? data.sum_temp / data.count : 0.0;
            results << pair.first << "="
                    << data.min_temp << "/"
                    << average_temp << "/"
                    << data.max_temp << ", ";
        }

        std::string resultStr = results.str();
        if (!resultStr.empty())
        {
            resultStr.pop_back();
            resultStr.pop_back();
        }

        // Devolver la cadena de resultados
        char *resultPtr = new char[resultStr.size() + 1];
        std::strcpy(resultPtr, resultStr.c_str());
        return resultPtr;
    }
}

// Prueba de que funciona el script en c++
//  int main()
//  {
//      const char *data_chunk = "StationA;25.5\nStationB;30.0\nStationA;20.0\nStationB;35.0\n";

//     std::string results = process_and_get_results(data_chunk);
//     std::cout << "Resultados: " << results << std::endl;

//     return 0;
// }
