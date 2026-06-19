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
    vector<vector<int>> mat(n, vector<int>(n));
    int top = 0, bottom = n-1, left = 0, right = n-1, num = 1;
    while (top <= bottom && left <= right) {
        for (int i = left; i <= right; i++) mat[top][i] = num++;
        top++;
        for (int i = top; i <= bottom; i++) mat[i][right] = num++;
        right--;
        if (top <= bottom) { for (int i = right; i >= left; i--) mat[bottom][i] = num++; bottom--; }
        if (left <= right) { for (int i = bottom; i >= top; i--) mat[i][left] = num++; left++; }
    }
    for (auto& row : mat) { for (int x : row) cout << x << "	"; cout << endl; }
    return 0;
}
