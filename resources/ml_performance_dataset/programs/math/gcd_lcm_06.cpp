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


long long gcd(long long a, long long b) { return b == 0 ? a : gcd(b, a % b); }
long long lcm(long long a, long long b) { return a / gcd(a, b) * b; }
int main() {
    vector<long long> nums = {25, 43, 61, 79, 97};
    long long g = nums[0], l = nums[0];
    for (int i = 1; i < (int)nums.size(); i++) {
        g = gcd(g, nums[i]);
        l = lcm(l, nums[i]);
    }
    cout << "GCD=" << g << " LCM=" << l << endl;
    return 0;
}
