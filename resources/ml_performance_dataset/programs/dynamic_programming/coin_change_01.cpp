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


int coinChange(vector<int>& coins, int amount) {
    vector<int> dp(amount + 1, INT_MAX);
    dp[0] = 0;
    for (int i = 1; i <= amount; i++) {
        for (int c : coins) {
            if (c <= i && dp[i - c] != INT_MAX)
                dp[i] = min(dp[i], dp[i - c] + 1);
        }
    }
    return dp[amount] == INT_MAX ? -1 : dp[amount];
}
int main() {
    vector<int> coins = {2, 3, 4};
    cout << coinChange(coins, 15) << endl;
    return 0;
}
