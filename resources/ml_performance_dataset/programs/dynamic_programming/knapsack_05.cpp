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


int knapsack(int W, vector<int>& wt, vector<int>& val, int n) {
    vector<vector<int>> dp(n + 1, vector<int>(W + 1, 0));
    for (int i = 1; i <= n; i++) {
        for (int w = 0; w <= W; w++) {
            dp[i][w] = dp[i-1][w];
            if (wt[i-1] <= w) dp[i][w] = max(dp[i][w], dp[i-1][w - wt[i-1]] + val[i-1]);
        }
    }
    return dp[n][W];
}
int main() {
    vector<int> val = {6, 11, 1, 6, 11, 1, 6, 11};
    vector<int> wt  = {3, 5, 7, 1, 3, 5, 7, 1};
    cout << knapsack(35, wt, val, 8) << endl;
    return 0;
}
