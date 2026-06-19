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
    vector<string> words = {"the","quick","brown","fox","jumps","the","lazy","dog","the","fox"};
    map<string, int> freq;
    for (const auto& w : words) freq[w]++;
    vector<pair<int,string>> sorted;
    for (auto& [k, v] : freq) sorted.push_back({v, k});
    sort(sorted.rbegin(), sorted.rend());
    for (int i = 0; i < min(4, (int)sorted.size()); i++)
        cout << sorted[i].second << ": " << sorted[i].first << endl;
    return 0;
}
