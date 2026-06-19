#include <iostream>
#include <vector>
#include <algorithm>
#include <string>
#include <cmath>
#include <climits>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <functional>
#include <numeric>
using namespace std;


int main() {
    int rows = 7, cols = 7;
    int** matrix = new int*[rows];
    for (int i = 0; i < rows; i++) {
        matrix[i] = new int[cols];
        for (int j = 0; j < cols; j++) matrix[i][j] = i * cols + j;
    }
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) cout << matrix[i][j] << " ";
        cout << endl;
        delete[] matrix[i];
    }
    delete[] matrix;
    return 0;
}
