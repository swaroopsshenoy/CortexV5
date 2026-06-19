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


struct SegTree {
    int n;
    vector<int> tree;
    SegTree(vector<int>& arr) : n(arr.size()), tree(4 * arr.size()) { build(arr, 0, 0, n-1); }
    void build(vector<int>& arr, int node, int l, int r) {
        if (l == r) { tree[node] = arr[l]; return; }
        int m = (l + r) / 2;
        build(arr, 2*node+1, l, m);
        build(arr, 2*node+2, m+1, r);
        tree[node] = tree[2*node+1] + tree[2*node+2];
    }
    int query(int node, int l, int r, int ql, int qr) {
        if (qr < l || r < ql) return 0;
        if (ql <= l && r <= qr) return tree[node];
        int m = (l + r) / 2;
        return query(2*node+1, l, m, ql, qr) + query(2*node+2, m+1, r, ql, qr);
    }
    int query(int l, int r) { return query(0, 0, n-1, l, r); }
};
int main() {
    vector<int> arr(26);
    iota(arr.begin(), arr.end(), 1);
    SegTree st(arr);
    cout << st.query(0, 14) << endl;
    return 0;
}
