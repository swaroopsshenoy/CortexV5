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
    vector<int> v(13);
    iota(v.begin(), v.end(), 1);
    sort(v.begin(), v.end(), greater<int>());
    auto it = find(v.begin(), v.end(), 2);
    if (it != v.end()) v.erase(it);
    v.erase(remove_if(v.begin(), v.end(), [](int x) { return x % 3 == 0; }), v.end());
    int total = accumulate(v.begin(), v.end(), 0);
    cout << total << endl;
    return 0;
}
