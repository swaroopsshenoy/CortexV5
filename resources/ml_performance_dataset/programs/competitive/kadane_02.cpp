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
    vector<int> arr = {7, 9, 11, -7, -5, -3, -1, 1, 3, 5};
    int maxSum = arr[0], cur = arr[0];
    for (int i = 1; i < (int)arr.size(); i++) {
        cur = max(arr[i], cur + arr[i]);
        maxSum = max(maxSum, cur);
    }
    cout << maxSum << endl;
    return 0;
}
