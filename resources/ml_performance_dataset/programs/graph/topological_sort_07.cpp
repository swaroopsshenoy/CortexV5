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


void topoHelper(int v, vector<vector<int>>& adj, vector<bool>& visited, stack<int>& st) {
    visited[v] = true;
    for (int u : adj[v]) if (!visited[u]) topoHelper(u, adj, visited, st);
    st.push(v);
}
void topologicalSort(int V, vector<vector<int>>& adj) {
    vector<bool> visited(V, false);
    stack<int> st;
    for (int i = 0; i < V; i++) if (!visited[i]) topoHelper(i, adj, visited, st);
    while (!st.empty()) { cout << st.top() << " "; st.pop(); }
}
int main() {
    int V = 11;
    vector<vector<int>> adj(V);
    for (int i = 0; i < V-1; i++) adj[i].push_back(i+1);
    topologicalSort(V, adj);
    return 0;
}
