# Project: Frontend Technologies Comparison in the 1 Billion Rows Challenge

⏳ **The project is currently on standby.**

## Project Description

This project aims to compare various frontend technologies in the implementation of the "1 Billion Rows Challenge." The goal is to analyze the performance and efficiency of different tools and frameworks when handling large volumes of data.

## Project Goals

- **Learning:** Learn and get a first approach to the technologies used.
- **Performance:** Evaluate the performance of each technology when handling large volumes of data.
- **Ease of Development:** Analyze the ease of use and development time with each technology.

## Technologies Used

In this project, the following frontend technologies are implemented and compared:

- **Web Workers + Vanilla JS**
- **Web GPU**
- **WebAssembly (C++)**

## Project Status

- **Web Workers + Vanilla JS:** ✅ Completed. The result was less than 3 minutes.
- **Web GPU:** 🚧 I have a first version, but it does not work correctly. I am trying to debug the issues, but debugging WGSL code is complex.
- **WASM:** 🚧 A first version is available but not functional. There is a test file that checks the script works correctly, but segmenting the file and passing it to the WASM function does not work correctly.

## Prerequisites

To run the project, you need the file generated by the [1 Billion Rows Challenge](https://github.com/gunnarmorling/1brc#submitting).

## How to Start

### 1. Clone the Repository

First, clone the repository to your local machine:

```bash
git clone https://github.com/jorbelca/1brc_frontend
cd 1brc_frontend
```

### 2. Open the HTML File

Navigate to the project folder and open the `index.html` file in your web browser. Open the console. This file is configured to import and execute each of the scripts corresponding to the different technologies.

## Contributions

Contributions are welcome! If you want to contribute to the project, follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/new-feature`).
3. Make the necessary changes and commit them (`git commit -m 'Add new feature'`).
4. Push the changes to your repository (`git push origin feature/new-feature`).
5. Open a Pull Request in this repository.

## License

This project is licensed under the MIT License.
