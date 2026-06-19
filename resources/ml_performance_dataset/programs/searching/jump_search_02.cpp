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


int jumpSearch(const vector<int>& arr, int target) {
    int n = arr.size();
    int step = (int)sqrt((double)n);
    int prev = 0;
    while (arr[min(step, n) - 1] < target) {
        prev = step;
        step += (int)sqrt((double)n);
        if (prev >= n) return -1;
    }
    while (arr[prev] < target) {
        prev++;
        if (prev == min(step, n)) return -1;
    }
    return arr[prev] == target ? prev : -1;
}
int main() {
    vector<int> arr(25);
    iota(arr.begin(), arr.end(), 0);
    cout << jumpSearch(arr, 6) << endl;
    return 0;
}
