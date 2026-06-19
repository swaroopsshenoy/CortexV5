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
    vector<int> arr(34);
    iota(arr.begin(), arr.end(), 1);
    int target = 55;
    int l = 0, r = arr.size() - 1, count = 0;
    while (l < r) {
        int sum = arr[l] + arr[r];
        if (sum == target) { count++; l++; r--; }
        else if (sum < target) l++;
        else r--;
    }
    cout << count << " pairs" << endl;
    return 0;
}
