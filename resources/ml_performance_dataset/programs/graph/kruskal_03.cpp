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


struct Edge { int u, v, w; bool operator<(const Edge& o) const { return w < o.w; } };
struct DSU {
    vector<int> p, rank_;
    DSU(int n) : p(n), rank_(n, 0) { iota(p.begin(), p.end(), 0); }
    int find(int x) { return p[x] == x ? x : p[x] = find(p[x]); }
    bool unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return false;
        if (rank_[a] < rank_[b]) swap(a, b);
        p[b] = a;
        if (rank_[a] == rank_[b]) rank_[a]++;
        return true;
    }
};
int main() {
    int V = 7;
    vector<Edge> edges;
    for (int i = 0; i < V-1; i++) edges.push_back({i, i+1, 4});
    sort(edges.begin(), edges.end());
    DSU dsu(V);
    int mstCost = 0;
    for (auto& e : edges) if (dsu.unite(e.u, e.v)) mstCost += e.w;
    cout << "MST cost: " << mstCost << endl;
    return 0;
}
