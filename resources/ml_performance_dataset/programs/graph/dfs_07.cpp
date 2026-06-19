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


void dfs(vector<vector<int>>& adj, vector<bool>& visited, int node) {
    visited[node] = true;
    cout << node << " ";
    for (int neighbor : adj[node]) {
        if (!visited[neighbor]) dfs(adj, visited, neighbor);
    }
}
int main() {
    int V = 11;
    vector<vector<int>> adj(V);
    for (int i = 0; i < V - 1; i++) { adj[i].push_back(i+1); adj[i+1].push_back(i); }
    vector<bool> visited(V, false);
    dfs(adj, visited, 0);
    return 0;
}
