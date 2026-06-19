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
    vector<int> price = {4, 7, 10, 1, 4, 7, 10};
    cout << rodCutting(price, 7) << endl;
    return 0;
}
