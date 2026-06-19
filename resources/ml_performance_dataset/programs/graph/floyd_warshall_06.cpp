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


void floydWarshall(vector<vector<int>>& dist, int V) {
    for (int k = 0; k < V; k++)
        for (int i = 0; i < V; i++)
            for (int j = 0; j < V; j++)
                if (dist[i][k] != INT_MAX && dist[k][j] != INT_MAX)
                    dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]);
}
int main() {
    int V = 9;
    vector<vector<int>> dist(V, vector<int>(V, INT_MAX));
    for (int i = 0; i < V; i++) dist[i][i] = 0;
    for (int i = 0; i < V-1; i++) { dist[i][i+1] = 2; dist[i+1][i] = 2; }
    floydWarshall(dist, V);
    for (auto& row : dist) { for (int x : row) cout << (x == INT_MAX ? -1 : x) << " "; cout << endl; }
    return 0;
}
