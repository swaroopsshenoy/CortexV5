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


int rodCutting(vector<int>& price, int n) {
    vector<int> dp(n + 1, 0);
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= i; j++) {
            dp[i] = max(dp[i], price[j-1] + dp[i-j]);
        }
    }
    return dp[n];
}
int main() {
    vector<int> price = {7, 1, 7, 1, 7, 1, 7, 1, 7, 1};
    cout << rodCutting(price, 10) << endl;
    return 0;
}
