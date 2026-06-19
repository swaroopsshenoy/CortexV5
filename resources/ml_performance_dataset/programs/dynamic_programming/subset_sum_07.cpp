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


bool subsetSum(vector<int>& arr, int sum) {
    int n = arr.size();
    vector<vector<bool>> dp(n + 1, vector<bool>(sum + 1, false));
    for (int i = 0; i <= n; i++) dp[i][0] = true;
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= sum; j++) {
            dp[i][j] = dp[i-1][j];
            if (arr[i-1] <= j) dp[i][j] = dp[i][j] || dp[i-1][j - arr[i-1]];
        }
    }
    return dp[n][sum];
}
int main() {
    vector<int> arr = {8, 5, 2, 9, 6};
    cout << (subsetSum(arr, 35) ? "YES" : "NO") << endl;
    return 0;
}
