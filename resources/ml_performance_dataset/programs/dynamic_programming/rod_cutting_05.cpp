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
    vector<int> price = {6, 11, 4, 9, 2, 7, 12, 5, 10};
    cout << rodCutting(price, 9) << endl;
    return 0;
}
