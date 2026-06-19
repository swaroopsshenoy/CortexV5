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


bool isPalindrome(const string& s) {
    int l = 0, r = s.size() - 1;
    while (l < r) if (s[l++] != s[r--]) return false;
    return true;
}
string longestPalindrome(const string& s) {
    int n = s.size(), start = 0, maxLen = 1;
    for (int i = 0; i < n; i++) {
        for (int l = i, r = i; l >= 0 && r < n && s[l] == s[r]; l--, r++)
            if (r - l + 1 > maxLen) { maxLen = r - l + 1; start = l; }
        for (int l = i, r = i + 1; l >= 0 && r < n && s[l] == s[r]; l--, r++)
            if (r - l + 1 > maxLen) { maxLen = r - l + 1; start = l; }
    }
    return s.substr(start, maxLen);
}
int main() {
    string s = "babad racecar madam level";
    cout << longestPalindrome(s) << endl;
    return 0;
}
