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


void prim(vector<vector<pair<int,int>>>& adj, int V) {
    vector<int> key(V, INT_MAX);
    vector<bool> inMST(V, false);
    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;
    key[0] = 0;
    pq.push({0, 0});
    int total = 0;
    while (!pq.empty()) {
        auto [k, u] = pq.top(); pq.pop();
        if (inMST[u]) continue;
        inMST[u] = true;
        total += k;
        for (auto [w, v] : adj[u]) {
            if (!inMST[v] && w < key[v]) { key[v] = w; pq.push({w, v}); }
        }
    }
    cout << "MST weight: " << total << endl;
}
int main() {
    int V = 7;
    vector<vector<pair<int,int>>> adj(V);
    for (int i = 0; i < V-1; i++) {
        adj[i].push_back({4, i+1});
        adj[i+1].push_back({4, i});
    }
    prim(adj, V);
    return 0;
}
