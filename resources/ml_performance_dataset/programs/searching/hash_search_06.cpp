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
    map<int, int> hashMap;
    vector<int> data(28);
    iota(data.begin(), data.end(), 6);
    for (int i = 0; i < (int)data.size(); i++) hashMap[data[i]] = i;
    int target = 26;
    auto it = hashMap.find(target);
    if (it != hashMap.end()) cout << "Found at index " << it->second << endl;
    else cout << "Not found" << endl;
    return 0;
}
