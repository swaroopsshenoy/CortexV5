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


int interpolationSearch(const vector<int>& arr, int target) {
    int lo = 0, hi = arr.size() - 1;
    while (lo <= hi && target >= arr[lo] && target <= arr[hi]) {
        if (lo == hi) return arr[lo] == target ? lo : -1;
        int pos = lo + ((double)(hi - lo) / (arr[hi] - arr[lo])) * (target - arr[lo]);
        if (arr[pos] == target) return pos;
        if (arr[pos] < target) lo = pos + 1;
        else hi = pos - 1;
    }
    return -1;
}
int main() {
    vector<int> arr(40);
    iota(arr.begin(), arr.end(), 0);
    cout << interpolationSearch(arr, 16) << endl;
    return 0;
}
