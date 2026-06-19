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


int ternarySearch(const vector<int>& arr, int l, int r, int target) {
    if (r >= l) {
        int mid1 = l + (r - l) / 3;
        int mid2 = r - (r - l) / 3;
        if (arr[mid1] == target) return mid1;
        if (arr[mid2] == target) return mid2;
        if (target < arr[mid1]) return ternarySearch(arr, l, mid1 - 1, target);
        if (target > arr[mid2]) return ternarySearch(arr, mid2 + 1, r, target);
        return ternarySearch(arr, mid1 + 1, mid2 - 1, target);
    }
    return -1;
}
int main() {
    vector<int> arr(25);
    iota(arr.begin(), arr.end(), 0);
    cout << ternarySearch(arr, 0, arr.size()-1, 12) << endl;
    return 0;
}
