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


struct Edge { int u, v, w; };
void bellmanFord(vector<Edge>& edges, int V, int src) {
    vector<int> dist(V, INT_MAX);
    dist[src] = 0;
    for (int i = 0; i < V - 1; i++) {
        for (auto& e : edges) {
            if (dist[e.u] != INT_MAX && dist[e.u] + e.w < dist[e.v])
                dist[e.v] = dist[e.u] + e.w;
        }
    }
    for (int i = 0; i < V; i++) cout << dist[i] << " ";
}
int main() {
    int V = 10;
    vector<Edge> edges;
    for (int i = 0; i < V-1; i++) edges.push_back({i, i+1, 3});
    bellmanFord(edges, V, 0);
    return 0;
}
