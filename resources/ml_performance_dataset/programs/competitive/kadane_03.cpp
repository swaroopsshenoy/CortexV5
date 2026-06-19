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
    vector<int> arr = {7, 10, -7, -4, -1, 2, 5, 8, 11, -6, -3};
    int maxSum = arr[0], cur = arr[0];
    for (int i = 1; i < (int)arr.size(); i++) {
        cur = max(arr[i], cur + arr[i]);
        maxSum = max(maxSum, cur);
    }
    cout << maxSum << endl;
    return 0;
}
