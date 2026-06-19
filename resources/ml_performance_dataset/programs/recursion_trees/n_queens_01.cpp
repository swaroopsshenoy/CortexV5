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


int n = 4;
bool isSafe(vector<int>& col, int row, int c) {
    for (int r = 0; r < row; r++) {
        if (col[r] == c || abs(col[r] - c) == abs(r - row)) return false;
    }
    return true;
}
int solve(vector<int>& col, int row) {
    if (row == n) return 1;
    int count = 0;
    for (int c = 0; c < n; c++) {
        if (isSafe(col, row, c)) {
            col[row] = c;
            count += solve(col, row + 1);
        }
    }
    return count;
}
int main() {
    vector<int> col(n);
    cout << solve(col, 0) << " solutions" << endl;
    return 0;
}
