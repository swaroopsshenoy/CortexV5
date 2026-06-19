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


string rleEncode(const string& s) {
    string result;
    int i = 0;
    while (i < (int)s.size()) {
        char c = s[i];
        int count = 0;
        while (i < (int)s.size() && s[i] == c) { i++; count++; }
        result += c;
        result += to_string(count);
    }
    return result;
}
int main() {
    string s = "aaabbbcc";
    cout << rleEncode(s) << endl;
    return 0;
}
