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
    int n = 7;
    vector<vector<int>> A(n, vector<int>(n)), B(n, vector<int>(n)), C(n, vector<int>(n, 0));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) { A[i][j] = i + j; B[i][j] = i * j + 1; }
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            for (int k = 0; k < n; k++)
                C[i][j] += A[i][k] * B[k][j];
    cout << C[0][0] << " " << C[n-1][n-1] << endl;
    return 0;
}
