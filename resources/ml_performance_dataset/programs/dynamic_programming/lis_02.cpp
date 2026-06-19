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


int lis(vector<int>& arr) {
    int n = arr.size();
    vector<int> dp(n, 1);
    for (int i = 1; i < n; i++)
        for (int j = 0; j < i; j++)
            if (arr[j] < arr[i]) dp[i] = max(dp[i], dp[j] + 1);
    return *max_element(dp.begin(), dp.end());
}
int main() {
    vector<int> arr = {7, 13, 4, 10, 1, 7, 13, 4, 10, 1};
    cout << lis(arr) << endl;
    return 0;
}
