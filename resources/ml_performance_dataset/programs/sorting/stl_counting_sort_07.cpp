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


void countingSort(vector<int>& arr, int maxVal) {
    vector<int> count(maxVal + 1, 0);
    for (int x : arr) count[x]++;
    int idx = 0;
    for (int i = 0; i <= maxVal; i++)
        while (count[i]-- > 0) arr[idx++] = i;
}
int main() {
    vector<int> arr = {1, 8, 15, 2, 9, 16, 3, 10, 17, 4, 11, 18, 5, 12, 19, 6, 13};
    int maxVal = *max_element(arr.begin(), arr.end());
    countingSort(arr, maxVal);
    for (int x : arr) cout << x << " ";
    return 0;
}
