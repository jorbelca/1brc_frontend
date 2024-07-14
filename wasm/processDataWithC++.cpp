#include <iostream>
#include <sstream>
#include <map>
#include <limits>
#include <string>
#include <iomanip>
#include <algorithm>
#include <vector>
#include <cstring>
#include <emscripten/emscripten.h>

// Struct for the data
struct StationData
{
    double min_temp = std::numeric_limits<double>::max();
    double max_temp = std::numeric_limits<double>::lowest();
    double sum_temp = 0.0;
    int count = 0;
};

// Function to trim spaces from both ends of a C-style string
void trim(char *str)
{
    char *end;

    // Trim leading space
    while (isspace((unsigned char)*str))
        str++;

    if (*str == 0)
        return;

    // Trim trailing space
    end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end))
        end--;

    // Write new null terminator
    *(end + 1) = 0;
}

extern "C"
{
    std::map<std::string, StationData> stationMap;

    EMSCRIPTEN_KEEPALIVE void process_chunk(const char *chunk)
    {
        std::stringstream file(chunk);
        std::string line;

        while (std::getline(file, line))
        {
            std::stringstream ss(line);
            std::string station;
            double temperature;

            if (std::getline(ss, station, ';') && ss >> temperature)
            {
                std::vector<char> station_cstr(station.begin(), station.end());
                station_cstr.push_back('\0');
                trim(station_cstr.data());
                station = std::string(station_cstr.data());
                station.erase(remove_if(station.begin(), station.end(), ::isspace), station.end());
                auto &data = stationMap[station];
                data.min_temp = std::min(data.min_temp, temperature);
                data.max_temp = std::max(data.max_temp, temperature);
                data.sum_temp += temperature;
                data.count++;
            }
        }
    }

    EMSCRIPTEN_KEEPALIVE const char *get_results()
    {
        std::ostringstream results;
        results << std::fixed << std::setprecision(2);
        if (stationMap.empty())
            return "";

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
            resultStr.pop_back(); // Remove last space
            resultStr.pop_back(); // Remove last comma
        }

        char *resultPtr = new char[resultStr.size() + 1];
        std::strcpy(resultPtr, resultStr.c_str());
        return resultPtr;
    }

    EMSCRIPTEN_KEEPALIVE void free_results(const char *ptr)
    {
        delete[] ptr;
    }
}
// To compile

//  emcc processDataWithC++.cpp -o processDataWithC++.js \
//   -s WASM=1 \
//   -s EXPORTED_FUNCTIONS="['_process_chunk', '_get_results','_free_results' ,'_malloc', '_free']" \
//   -s EXPORTED_RUNTIME_METHODS="['cwrap', 'UTF8ToString', 'getValue']" \
//   --no-entry \
//   --std=c++17