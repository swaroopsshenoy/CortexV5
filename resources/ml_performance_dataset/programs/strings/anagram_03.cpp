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


bool isAnagram(const string& a, const string& b) {
    if (a.size() != b.size()) return false;
    map<char, int> freq;
    for (char c : a) freq[c]++;
    for (char c : b) if (--freq[c] < 0) return false;
    return true;
}
int main() {
    vector<pair<string,string>> tests = {
        {"listen", "silent"},
        {"hello", "world"},
        {"anagr", "nagar"}
    };
    for (auto& [a, b] : tests) cout << a << "/" << b << ": " << (isAnagram(a, b) ? "YES" : "NO") << endl;
    return 0;
}
