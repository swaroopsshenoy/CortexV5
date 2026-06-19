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
    vector<int> arr = {3, 2, 1, 0, 7, 6, 5, 4, 3, 2, 1, 0, 7, 6, 5, 4, 3};
    map<int, int> freq;
    for (int x : arr) freq[x]++;
    int maxFreq = 0, mode = 0;
    for (auto& [k, v] : freq) if (v > maxFreq) { maxFreq = v; mode = k; }
    cout << "Mode: " << mode << " Freq: " << maxFreq << endl;
    return 0;
}
