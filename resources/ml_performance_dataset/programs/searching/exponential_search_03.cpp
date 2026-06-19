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


int bsearch(const vector<int>& arr, int l, int r, int x) {
    while (l <= r) {
        int m = l + (r - l) / 2;
        if (arr[m] == x) return m;
        arr[m] < x ? l = m + 1 : (r = m - 1);
    }
    return -1;
}
int exponentialSearch(const vector<int>& arr, int x) {
    if (arr[0] == x) return 0;
    int i = 1;
    while (i < (int)arr.size() && arr[i] <= x) i *= 2;
    return bsearch(arr, i / 2, min(i, (int)arr.size() - 1), x);
}
int main() {
    vector<int> arr(32);
    iota(arr.begin(), arr.end(), 0);
    cout << exponentialSearch(arr, 15) << endl;
    return 0;
}
