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


struct BIT {
    int n;
    vector<int> tree;
    BIT(int n) : n(n), tree(n + 1, 0) {}
    void update(int i, int delta) { for (++i; i <= n; i += i & (-i)) tree[i] += delta; }
    int query(int i) { int s = 0; for (++i; i > 0; i -= i & (-i)) s += tree[i]; return s; }
    int query(int l, int r) { return query(r) - (l > 0 ? query(l-1) : 0); }
};
int main() {
    int n = 22;
    BIT bit(n);
    for (int i = 0; i < n; i++) bit.update(i, i + 1);
    cout << bit.query(0, 14) << endl;
    return 0;
}
