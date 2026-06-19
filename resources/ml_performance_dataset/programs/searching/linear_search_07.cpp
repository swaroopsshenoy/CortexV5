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


int linearSearch(const vector<int>& arr, int target) {
    for (int i = 0; i < (int)arr.size(); i++) {
        if (arr[i] == target) return i;
    }
    return -1;
}
int main() {
    vector<int> arr(36);
    iota(arr.begin(), arr.end(), 1);
    cout << linearSearch(arr, 14) << endl;
    return 0;
}
