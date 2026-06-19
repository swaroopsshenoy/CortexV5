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
    set<int> a, b;
    for (int j = 0; j < 10; j++) a.insert(j);
    for (int j = 2; j < 12; j++) b.insert(j);
    vector<int> inter, uni;
    set_intersection(a.begin(), a.end(), b.begin(), b.end(), back_inserter(inter));
    set_union(a.begin(), a.end(), b.begin(), b.end(), back_inserter(uni));
    cout << "Intersection: " << inter.size() << " Union: " << uni.size() << endl;
    return 0;
}
