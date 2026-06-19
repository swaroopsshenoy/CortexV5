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
    int n = 10;
    vector<vector<int>> A(n, vector<int>(n)), B(n, vector<int>(n));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) {
        A[i][j] = i * n + j + 1;
        B[i][j] = (i + j) * 3;
    }
    // Addition
    vector<vector<int>> C(n, vector<int>(n));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) C[i][j] = A[i][j] + B[i][j];
    // Transpose of C
    vector<vector<int>> T(n, vector<int>(n));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) T[i][j] = C[j][i];
    int trace = 0;
    for (int i = 0; i < n; i++) trace += T[i][i];
    cout << "Trace: " << trace << endl;
    return 0;
}
