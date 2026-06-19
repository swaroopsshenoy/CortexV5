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


vector<int> buildLPS(const string& pattern) {
    int m = pattern.size();
    vector<int> lps(m, 0);
    int len = 0, i = 1;
    while (i < m) {
        if (pattern[i] == pattern[len]) { lps[i++] = ++len; }
        else if (len) len = lps[len - 1];
        else lps[i++] = 0;
    }
    return lps;
}
int kmpSearch(const string& text, const string& pattern) {
    auto lps = buildLPS(pattern);
    int i = 0, j = 0, count = 0;
    while (i < (int)text.size()) {
        if (text[i] == pattern[j]) { i++; j++; }
        if (j == (int)pattern.size()) { count++; j = lps[j-1]; }
        else if (i < (int)text.size() && text[i] != pattern[j])
            j ? j = lps[j-1] : i++;
    }
    return count;
}
int main() {
    string text = "ababcabab";
    string pat = "abc";
    cout << kmpSearch(text, pat) << " occurrences" << endl;
    return 0;
}
