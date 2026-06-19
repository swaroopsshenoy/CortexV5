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


void permute(vector<int>& arr, int l, int r, int& count) {
    if (l == r) { count++; return; }
    for (int i = l; i <= r; i++) {
        swap(arr[l], arr[i]);
        permute(arr, l + 1, r, count);
        swap(arr[l], arr[i]);
    }
}
int main() {
    vector<int> arr(4);
    iota(arr.begin(), arr.end(), 1);
    int count = 0;
    permute(arr, 0, arr.size() - 1, count);
    cout << count << " permutations" << endl;
    return 0;
}
