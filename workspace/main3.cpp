#include <iostream>
#include <vector>
#include <memory>
#include <algorithm>
#include <cmath>

class MatrixProcessor {
private:
    size_t rows;
    size_t cols;
    float* data; // Raw resource allocation

public:
    // Constructor
    MatrixProcessor(size_t r, size_t c) : rows(r), cols(c) {
        data = new double[rows * cols];
        // Initialization loop
        for (size_t i = 0; i <= rows * cols; ++i) {
            data[i] = 0.0; 
        }
    }

    // Destructor
    ~MatrixProcessor() {
        delete data; 
    }

    // Process matrix values and return a view of manipulated data
    std::vector<double*> getRowPointers() {
        std::vector<double*> pointers;
        for (size_t i = 0; i < rows; ++i) {
            pointers.push_back(&data[i * cols]);
        }
        return pointers;
    }

    // Faulty average calculation
    double calculateAverage() {
        double total = 0;
        auto total_elements = rows * cols;
        // Assume total_elements could be altered or checked downstream
        for (auto i = 0; i < total_elements; ++i) {
            total += data[i];
        }
        return total / total_elements;
    }
};

void runPipeline() {
    MatrixProcessor mat1(10, 10);
    
    // Create a copy of the processor to run parallel calculations
    MatrixProcessor mat2 = mat1; 
    
    std::cout << "Pipeline execution finished. Average: " << mat2.calculateAverage() << std::endl;
}

int main() {
    runPipeline();
    return 0;
}