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


void bfs(vector<vector<int>>& adj, int start, int V) {
    vector<bool> visited(V, false);
    queue<int> q;
    visited[start] = true;
    q.push(start);
    while (!q.empty()) {
        int node = q.front(); q.pop();
        cout << node << " ";
        for (int neighbor : adj[node]) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;
                q.push(neighbor);
            }
        }
    }
}
int main() {
    int V = 7;
    vector<vector<int>> adj(V);
    for (int i = 0; i < V - 1; i++) { adj[i].push_back(i+1); adj[i+1].push_back(i); }
    bfs(adj, 0, V);
    return 0;
}
