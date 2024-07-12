#include <iostream>
#include <fstream>
#include <sstream>
#include <map>
#include <limits>
#include <string>
#include <iomanip>
#include <algorithm>
#include <cstring>
#include <chrono> // Library for time

// Struct for the data
struct StationData
{
    double min_temp = std::numeric_limits<double>::max();
    double max_temp = std::numeric_limits<double>::lowest();
    double sum_temp = 0.0;
    int count = 0;
};

// Function to trim spaces from both ends of a string
std::string trim(const std::string &str)
{
    size_t first = str.find_first_not_of(' ');
    if (first == std::string::npos)
        return "";
    size_t last = str.find_last_not_of(' ');
    return str.substr(first, last - first + 1);
}
// This function process the data and returns in the format established
const char *process_and_get_results(std::ifstream &infile)
{
    std::map<std::string, StationData> stationMap;
    std::string line;

    while (std::getline(infile, line))
    {
        std::stringstream ss(line);
        std::string station;
        double temperature;

        if (std::getline(ss, station, ';') && ss >> temperature)
        {
            station = trim(station); // Trim station name
            auto &data = stationMap[station];
            data.min_temp = std::min(data.min_temp, temperature);
            data.max_temp = std::max(data.max_temp, temperature);
            data.sum_temp += temperature;
            data.count++;
        }
    }

    std::ostringstream results;
    results << std::fixed << std::setprecision(2); // Two decimals

    if (stationMap.empty())
    {
        std::cout << "DEBUG: There is no data in the stationMap" << std::endl;
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

    // Return the string with the result
    char *resultPtr = new char[resultStr.size() + 1];
    std::strcpy(resultPtr, resultStr.c_str());
    return resultPtr;
}

// Test that the file works in  C++
int main()
{
    // DATA IN
    // const char *data_chunk = "Mombasa;14.1\nVancouver;- 2.3\n Hamilton;5.5 \nDubai;25.6\n Beijing;2.2 \nAtlanta;36.4\n Pyongyang;20.5\n Flores, Petén;7.2\n Palm Springs;25.7\n Dili;18.1\n Kyoto;12.3\n Canberra;2.3\n Denpasar;21.4\n Marrakesh;9.8\n Xi'an;23.9\n San Francisco; 17.0\n Lusaka; 9.9\n Phnom Penh; 21.9 \nPyongyang; 6.0\n Petropavlovsk - Kamchatsky; 5.0\n Toronto; 17.5 \nJos;26.7\nJos; 31.3\nAlexandria; 25.1\nWarsaw; 6.9\nPhnom Penh; 14.5 ";

    auto start = std::chrono::high_resolution_clock::now();
    // Specify the path to your input file
    std::string filepath = "../1brc/measurements.txt";

    // Open the file
    std::ifstream data(filepath);
    if (!data)
    {
        std::cerr << "Error opening file: " << filepath << std::endl;
        return 1;
    }

    std::string results = process_and_get_results(data);
    auto end = std::chrono::high_resolution_clock::now();
    data.close();
    // Stop measuring time

    auto duration = std::chrono::duration_cast<std::chrono::seconds>(end - start);

    // Calculate minutes and seconds
    auto minutes = std::chrono::duration_cast<std::chrono::minutes>(duration);
    auto seconds = duration - std::chrono::duration_cast<std::chrono::seconds>(minutes);

    std::cout << "Results: " << results << std::endl;
    std::cout << "Execution time: " << minutes.count() << " minutes and "
              << seconds.count() << " seconds" << std::endl;
    return 0;
}

// cd to directory
// g++ -std=c++17 -o C++ test_processDataWithC++.cpp ->  to Compile
//  ./C++  -> to execute
