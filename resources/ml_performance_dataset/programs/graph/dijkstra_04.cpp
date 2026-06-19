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


void dijkstra(vector<vector<pair<int,int>>>& adj, int src, int V) {
    vector<int> dist(V, INT_MAX);
    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;
    dist[src] = 0;
    pq.push({0, src});
    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d > dist[u]) continue;
        for (auto [w, v] : adj[u]) {
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                pq.push({dist[v], v});
            }
        }
    }
    for (int i = 0; i < V; i++) cout << "Dist[" << i << "]=" << dist[i] << " ";
}
int main() {
    int V = 8;
    vector<vector<pair<int,int>>> adj(V);
    for (int i = 0; i < V-1; i++) {
        adj[i].push_back({5, i+1});
        adj[i+1].push_back({5, i});
    }
    dijkstra(adj, 0, V);
    return 0;
}
