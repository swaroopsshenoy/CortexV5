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
    int n = 4;
    vector<vector<int>> mat(n, vector<int>(n));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) mat[i][j] = i * n + j;
    // Rotate 90 degrees clockwise
    for (int i = 0; i < n / 2; i++) for (int j = i; j < n - i - 1; j++) {
        int tmp = mat[i][j];
        mat[i][j] = mat[n-j-1][i];
        mat[n-j-1][i] = mat[n-i-1][n-j-1];
        mat[n-i-1][n-j-1] = mat[j][n-i-1];
        mat[j][n-i-1] = tmp;
    }
    for (auto& row : mat) { for (int x : row) cout << x << " "; cout << endl; }
    return 0;
}
