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
    vector<int> v(20);
    iota(v.begin(), v.end(), 1);
    vector<int> result(v.size());
    transform(v.begin(), v.end(), result.begin(), [](int x) { return x * x; });
    vector<int> evens;
    copy_if(result.begin(), result.end(), back_inserter(evens), [](int x) { return x % 2 == 0; });
    cout << evens.size() << endl;
    return 0;
}
