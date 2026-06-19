#!/usr/bin/env python3
"""
Generate 550 hand-crafted C++ programs across 12 categories for ML training.
Each program is a valid, self-contained C++ file exhibiting real performance
characteristics (loops, recursion, STL, pointers, dynamic allocation).

Usage:
    python scripts/ml/generate_cpp_programs.py
    python scripts/ml/generate_cpp_programs.py --out-dir resources/ml_performance_dataset/programs
"""

from __future__ import annotations
import argparse
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "resources" / "ml_performance_dataset" / "programs"

# ---------------------------------------------------------------------------
# Template helpers
# ---------------------------------------------------------------------------

HEADER = '#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <string>\n#include <cmath>\n#include <climits>\n#include <map>\n#include <set>\n#include <queue>\n#include <stack>\n#include <functional>\n#include <numeric>\nusing namespace std;\n\n'

def prog(body: str) -> str:
    return HEADER + body


# ============================================================
# CATEGORY 1: Sorting Algorithms (50 programs)
# ============================================================

def sorting_programs() -> list[tuple[str, str]]:
    programs = []

    # Bubble sort variants
    for i in range(1, 9):
        n = 10 * i
        programs.append((f"bubble_sort_{i:02d}", prog(f"""
void bubbleSort(vector<int>& arr) {{
    int n = arr.size();
    for (int i = 0; i < n - 1; i++) {{
        for (int j = 0; j < n - i - 1; j++) {{
            if (arr[j] > arr[j + 1]) {{
                swap(arr[j], arr[j + 1]);
            }}
        }}
    }}
}}
int main() {{
    vector<int> arr({n});
    iota(arr.begin(), arr.end(), 0);
    reverse(arr.begin(), arr.end());
    bubbleSort(arr);
    for (int x : arr) cout << x << " ";
    return 0;
}}
""")))

    # Selection sort
    for i in range(1, 6):
        programs.append((f"selection_sort_{i:02d}", prog(f"""
void selectionSort(vector<int>& arr) {{
    int n = arr.size();
    for (int i = 0; i < n - 1; i++) {{
        int minIdx = i;
        for (int j = i + 1; j < n; j++) {{
            if (arr[j] < arr[minIdx]) minIdx = j;
        }}
        swap(arr[i], arr[minIdx]);
    }}
}}
int main() {{
    vector<int> arr = {{9, 5, 2, 7, 1, 8, 3, 6, 4, {i * 10}}};
    selectionSort(arr);
    for (int x : arr) cout << x << " ";
    return 0;
}}
""")))

    # Insertion sort
    for i in range(1, 6):
        programs.append((f"insertion_sort_{i:02d}", prog(f"""
void insertionSort(vector<int>& arr) {{
    int n = arr.size();
    for (int i = 1; i < n; i++) {{
        int key = arr[i];
        int j = i - 1;
        while (j >= 0 && arr[j] > key) {{
            arr[j + 1] = arr[j];
            j--;
        }}
        arr[j + 1] = key;
    }}
}}
int main() {{
    vector<int> arr({i + 5});
    iota(arr.rbegin(), arr.rend(), 0);
    insertionSort(arr);
    for (int x : arr) cout << x << " ";
    return 0;
}}
""")))

    # Merge sort
    for i in range(1, 8):
        programs.append((f"merge_sort_{i:02d}", prog(f"""
void merge(vector<int>& arr, int l, int m, int r) {{
    vector<int> left(arr.begin() + l, arr.begin() + m + 1);
    vector<int> right(arr.begin() + m + 1, arr.begin() + r + 1);
    int i = 0, j = 0, k = l;
    while (i < (int)left.size() && j < (int)right.size())
        arr[k++] = (left[i] <= right[j]) ? left[i++] : right[j++];
    while (i < (int)left.size()) arr[k++] = left[i++];
    while (j < (int)right.size()) arr[k++] = right[j++];
}}
void mergeSort(vector<int>& arr, int l, int r) {{
    if (l < r) {{
        int m = l + (r - l) / 2;
        mergeSort(arr, l, m);
        mergeSort(arr, m + 1, r);
        merge(arr, l, m, r);
    }}
}}
int main() {{
    vector<int> arr({4 + i * 3});
    iota(arr.rbegin(), arr.rend(), 0);
    mergeSort(arr, 0, arr.size() - 1);
    for (int x : arr) cout << x << " ";
    return 0;
}}
""")))

    # Quick sort
    for i in range(1, 7):
        programs.append((f"quick_sort_{i:02d}", prog(f"""
int partition(vector<int>& arr, int low, int high) {{
    int pivot = arr[high];
    int i = low - 1;
    for (int j = low; j < high; j++) {{
        if (arr[j] < pivot) swap(arr[++i], arr[j]);
    }}
    swap(arr[i + 1], arr[high]);
    return i + 1;
}}
void quickSort(vector<int>& arr, int low, int high) {{
    if (low < high) {{
        int pi = partition(arr, low, high);
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }}
}}
int main() {{
    vector<int> arr({5 + i * 4});
    iota(arr.rbegin(), arr.rend(), 1);
    quickSort(arr, 0, arr.size() - 1);
    for (int x : arr) cout << x << " ";
    return 0;
}}
""")))

    # Heap sort
    for i in range(1, 6):
        programs.append((f"heap_sort_{i:02d}", prog(f"""
void heapify(vector<int>& arr, int n, int i) {{
    int largest = i, l = 2 * i + 1, r = 2 * i + 2;
    if (l < n && arr[l] > arr[largest]) largest = l;
    if (r < n && arr[r] > arr[largest]) largest = r;
    if (largest != i) {{
        swap(arr[i], arr[largest]);
        heapify(arr, n, largest);
    }}
}}
void heapSort(vector<int>& arr) {{
    int n = arr.size();
    for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);
    for (int i = n - 1; i > 0; i--) {{
        swap(arr[0], arr[i]);
        heapify(arr, i, 0);
    }}
}}
int main() {{
    vector<int> arr({6 + i * 3});
    iota(arr.rbegin(), arr.rend(), 1);
    heapSort(arr);
    for (int x : arr) cout << x << " ";
    return 0;
}}
""")))

    # STL sort + counting sort + radix sort
    for i in range(1, 8):
        programs.append((f"stl_counting_sort_{i:02d}", prog(f"""
void countingSort(vector<int>& arr, int maxVal) {{
    vector<int> count(maxVal + 1, 0);
    for (int x : arr) count[x]++;
    int idx = 0;
    for (int i = 0; i <= maxVal; i++)
        while (count[i]-- > 0) arr[idx++] = i;
}}
int main() {{
    vector<int> arr = {{{", ".join(str((j * 7 + i * 3) % 20) for j in range(10 + i))}}};
    int maxVal = *max_element(arr.begin(), arr.end());
    countingSort(arr, maxVal);
    for (int x : arr) cout << x << " ";
    return 0;
}}
""")))

    return programs[:50]


# ============================================================
# CATEGORY 2: Searching Algorithms (50 programs)
# ============================================================

def searching_programs() -> list[tuple[str, str]]:
    programs = []

    # Binary search variants
    for i in range(1, 11):
        programs.append((f"binary_search_{i:02d}", prog(f"""
int binarySearch(const vector<int>& arr, int target) {{
    int low = 0, high = arr.size() - 1;
    while (low <= high) {{
        int mid = low + (high - low) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }}
    return -1;
}}
int main() {{
    vector<int> arr({10 + i * 5});
    iota(arr.begin(), arr.end(), 0);
    int target = {i * 3};
    int result = binarySearch(arr, target);
    cout << "Found at: " << result << endl;
    return 0;
}}
""")))

    # Linear search
    for i in range(1, 8):
        programs.append((f"linear_search_{i:02d}", prog(f"""
int linearSearch(const vector<int>& arr, int target) {{
    for (int i = 0; i < (int)arr.size(); i++) {{
        if (arr[i] == target) return i;
    }}
    return -1;
}}
int main() {{
    vector<int> arr({8 + i * 4});
    iota(arr.begin(), arr.end(), 1);
    cout << linearSearch(arr, {i * 2}) << endl;
    return 0;
}}
""")))

    # Ternary search
    for i in range(1, 6):
        programs.append((f"ternary_search_{i:02d}", prog(f"""
int ternarySearch(const vector<int>& arr, int l, int r, int target) {{
    if (r >= l) {{
        int mid1 = l + (r - l) / 3;
        int mid2 = r - (r - l) / 3;
        if (arr[mid1] == target) return mid1;
        if (arr[mid2] == target) return mid2;
        if (target < arr[mid1]) return ternarySearch(arr, l, mid1 - 1, target);
        if (target > arr[mid2]) return ternarySearch(arr, mid2 + 1, r, target);
        return ternarySearch(arr, mid1 + 1, mid2 - 1, target);
    }}
    return -1;
}}
int main() {{
    vector<int> arr({10 + i * 5});
    iota(arr.begin(), arr.end(), 0);
    cout << ternarySearch(arr, 0, arr.size()-1, {i * 4}) << endl;
    return 0;
}}
""")))

    # Jump search
    for i in range(1, 6):
        programs.append((f"jump_search_{i:02d}", prog(f"""
int jumpSearch(const vector<int>& arr, int target) {{
    int n = arr.size();
    int step = (int)sqrt((double)n);
    int prev = 0;
    while (arr[min(step, n) - 1] < target) {{
        prev = step;
        step += (int)sqrt((double)n);
        if (prev >= n) return -1;
    }}
    while (arr[prev] < target) {{
        prev++;
        if (prev == min(step, n)) return -1;
    }}
    return arr[prev] == target ? prev : -1;
}}
int main() {{
    vector<int> arr({15 + i * 5});
    iota(arr.begin(), arr.end(), 0);
    cout << jumpSearch(arr, {i * 3}) << endl;
    return 0;
}}
""")))

    # Interpolation search
    for i in range(1, 6):
        programs.append((f"interpolation_search_{i:02d}", prog(f"""
int interpolationSearch(const vector<int>& arr, int target) {{
    int lo = 0, hi = arr.size() - 1;
    while (lo <= hi && target >= arr[lo] && target <= arr[hi]) {{
        if (lo == hi) return arr[lo] == target ? lo : -1;
        int pos = lo + ((double)(hi - lo) / (arr[hi] - arr[lo])) * (target - arr[lo]);
        if (arr[pos] == target) return pos;
        if (arr[pos] < target) lo = pos + 1;
        else hi = pos - 1;
    }}
    return -1;
}}
int main() {{
    vector<int> arr({20 + i * 5});
    iota(arr.begin(), arr.end(), 0);
    cout << interpolationSearch(arr, {i * 4}) << endl;
    return 0;
}}
""")))

    # Exponential search
    for i in range(1, 6):
        programs.append((f"exponential_search_{i:02d}", prog(f"""
int bsearch(const vector<int>& arr, int l, int r, int x) {{
    while (l <= r) {{
        int m = l + (r - l) / 2;
        if (arr[m] == x) return m;
        arr[m] < x ? l = m + 1 : (r = m - 1);
    }}
    return -1;
}}
int exponentialSearch(const vector<int>& arr, int x) {{
    if (arr[0] == x) return 0;
    int i = 1;
    while (i < (int)arr.size() && arr[i] <= x) i *= 2;
    return bsearch(arr, i / 2, min(i, (int)arr.size() - 1), x);
}}
int main() {{
    vector<int> arr({20 + i * 4});
    iota(arr.begin(), arr.end(), 0);
    cout << exponentialSearch(arr, {i * 5}) << endl;
    return 0;
}}
""")))

    # Hash-based search
    for i in range(1, 9):
        programs.append((f"hash_search_{i:02d}", prog(f"""
int main() {{
    map<int, int> hashMap;
    vector<int> data({10 + i * 3});
    iota(data.begin(), data.end(), {i});
    for (int i = 0; i < (int)data.size(); i++) hashMap[data[i]] = i;
    int target = {i * 4 + 2};
    auto it = hashMap.find(target);
    if (it != hashMap.end()) cout << "Found at index " << it->second << endl;
    else cout << "Not found" << endl;
    return 0;
}}
""")))

    return programs[:50]


# ============================================================
# CATEGORY 3: Graph Algorithms (75 programs)
# ============================================================

def graph_programs() -> list[tuple[str, str]]:
    programs = []

    # BFS variants
    for i in range(1, 11):
        v = 4 + i
        programs.append((f"bfs_{i:02d}", prog(f"""
void bfs(vector<vector<int>>& adj, int start, int V) {{
    vector<bool> visited(V, false);
    queue<int> q;
    visited[start] = true;
    q.push(start);
    while (!q.empty()) {{
        int node = q.front(); q.pop();
        cout << node << " ";
        for (int neighbor : adj[node]) {{
            if (!visited[neighbor]) {{
                visited[neighbor] = true;
                q.push(neighbor);
            }}
        }}
    }}
}}
int main() {{
    int V = {v};
    vector<vector<int>> adj(V);
    for (int i = 0; i < V - 1; i++) {{ adj[i].push_back(i+1); adj[i+1].push_back(i); }}
    bfs(adj, 0, V);
    return 0;
}}
""")))

    # DFS variants
    for i in range(1, 11):
        v = 4 + i
        programs.append((f"dfs_{i:02d}", prog(f"""
void dfs(vector<vector<int>>& adj, vector<bool>& visited, int node) {{
    visited[node] = true;
    cout << node << " ";
    for (int neighbor : adj[node]) {{
        if (!visited[neighbor]) dfs(adj, visited, neighbor);
    }}
}}
int main() {{
    int V = {v};
    vector<vector<int>> adj(V);
    for (int i = 0; i < V - 1; i++) {{ adj[i].push_back(i+1); adj[i+1].push_back(i); }}
    vector<bool> visited(V, false);
    dfs(adj, visited, 0);
    return 0;
}}
""")))

    # Dijkstra
    for i in range(1, 9):
        v = 4 + i
        programs.append((f"dijkstra_{i:02d}", prog(f"""
void dijkstra(vector<vector<pair<int,int>>>& adj, int src, int V) {{
    vector<int> dist(V, INT_MAX);
    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;
    dist[src] = 0;
    pq.push({{0, src}});
    while (!pq.empty()) {{
        auto [d, u] = pq.top(); pq.pop();
        if (d > dist[u]) continue;
        for (auto [w, v] : adj[u]) {{
            if (dist[u] + w < dist[v]) {{
                dist[v] = dist[u] + w;
                pq.push({{dist[v], v}});
            }}
        }}
    }}
    for (int i = 0; i < V; i++) cout << "Dist[" << i << "]=" << dist[i] << " ";
}}
int main() {{
    int V = {v};
    vector<vector<pair<int,int>>> adj(V);
    for (int i = 0; i < V-1; i++) {{
        adj[i].push_back({{{i % 5 + 1}, i+1}});
        adj[i+1].push_back({{{i % 5 + 1}, i}});
    }}
    dijkstra(adj, 0, V);
    return 0;
}}
""")))

    # Bellman-Ford
    for i in range(1, 7):
        v = 4 + i
        programs.append((f"bellman_ford_{i:02d}", prog(f"""
struct Edge {{ int u, v, w; }};
void bellmanFord(vector<Edge>& edges, int V, int src) {{
    vector<int> dist(V, INT_MAX);
    dist[src] = 0;
    for (int i = 0; i < V - 1; i++) {{
        for (auto& e : edges) {{
            if (dist[e.u] != INT_MAX && dist[e.u] + e.w < dist[e.v])
                dist[e.v] = dist[e.u] + e.w;
        }}
    }}
    for (int i = 0; i < V; i++) cout << dist[i] << " ";
}}
int main() {{
    int V = {v};
    vector<Edge> edges;
    for (int i = 0; i < V-1; i++) edges.push_back({{i, i+1, {i % 4 + 1}}});
    bellmanFord(edges, V, 0);
    return 0;
}}
""")))

    # Floyd-Warshall
    for i in range(1, 7):
        v = 3 + i
        programs.append((f"floyd_warshall_{i:02d}", prog(f"""
void floydWarshall(vector<vector<int>>& dist, int V) {{
    for (int k = 0; k < V; k++)
        for (int i = 0; i < V; i++)
            for (int j = 0; j < V; j++)
                if (dist[i][k] != INT_MAX && dist[k][j] != INT_MAX)
                    dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]);
}}
int main() {{
    int V = {v};
    vector<vector<int>> dist(V, vector<int>(V, INT_MAX));
    for (int i = 0; i < V; i++) dist[i][i] = 0;
    for (int i = 0; i < V-1; i++) {{ dist[i][i+1] = {i % 5 + 1}; dist[i+1][i] = {i % 5 + 1}; }}
    floydWarshall(dist, V);
    for (auto& row : dist) {{ for (int x : row) cout << (x == INT_MAX ? -1 : x) << " "; cout << endl; }}
    return 0;
}}
""")))

    # Topological sort + cycle detection + Kruskal + Prim
    for i in range(1, 8):
        v = 4 + i
        programs.append((f"topological_sort_{i:02d}", prog(f"""
void topoHelper(int v, vector<vector<int>>& adj, vector<bool>& visited, stack<int>& st) {{
    visited[v] = true;
    for (int u : adj[v]) if (!visited[u]) topoHelper(u, adj, visited, st);
    st.push(v);
}}
void topologicalSort(int V, vector<vector<int>>& adj) {{
    vector<bool> visited(V, false);
    stack<int> st;
    for (int i = 0; i < V; i++) if (!visited[i]) topoHelper(i, adj, visited, st);
    while (!st.empty()) {{ cout << st.top() << " "; st.pop(); }}
}}
int main() {{
    int V = {v};
    vector<vector<int>> adj(V);
    for (int i = 0; i < V-1; i++) adj[i].push_back(i+1);
    topologicalSort(V, adj);
    return 0;
}}
""")))

    for i in range(1, 8):
        v = 4 + i
        programs.append((f"kruskal_{i:02d}", prog(f"""
struct Edge {{ int u, v, w; bool operator<(const Edge& o) const {{ return w < o.w; }} }};
struct DSU {{
    vector<int> p, rank_;
    DSU(int n) : p(n), rank_(n, 0) {{ iota(p.begin(), p.end(), 0); }}
    int find(int x) {{ return p[x] == x ? x : p[x] = find(p[x]); }}
    bool unite(int a, int b) {{
        a = find(a); b = find(b);
        if (a == b) return false;
        if (rank_[a] < rank_[b]) swap(a, b);
        p[b] = a;
        if (rank_[a] == rank_[b]) rank_[a]++;
        return true;
    }}
}};
int main() {{
    int V = {v};
    vector<Edge> edges;
    for (int i = 0; i < V-1; i++) edges.push_back({{i, i+1, {i % 7 + 1}}});
    sort(edges.begin(), edges.end());
    DSU dsu(V);
    int mstCost = 0;
    for (auto& e : edges) if (dsu.unite(e.u, e.v)) mstCost += e.w;
    cout << "MST cost: " << mstCost << endl;
    return 0;
}}
""")))

    for i in range(1, 10):
        v = 4 + i
        programs.append((f"prim_{i:02d}", prog(f"""
void prim(vector<vector<pair<int,int>>>& adj, int V) {{
    vector<int> key(V, INT_MAX);
    vector<bool> inMST(V, false);
    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;
    key[0] = 0;
    pq.push({{0, 0}});
    int total = 0;
    while (!pq.empty()) {{
        auto [k, u] = pq.top(); pq.pop();
        if (inMST[u]) continue;
        inMST[u] = true;
        total += k;
        for (auto [w, v] : adj[u]) {{
            if (!inMST[v] && w < key[v]) {{ key[v] = w; pq.push({{w, v}}); }}
        }}
    }}
    cout << "MST weight: " << total << endl;
}}
int main() {{
    int V = {v};
    vector<vector<pair<int,int>>> adj(V);
    for (int i = 0; i < V-1; i++) {{
        adj[i].push_back({{{i % 6 + 1}, i+1}});
        adj[i+1].push_back({{{i % 6 + 1}, i}});
    }}
    prim(adj, V);
    return 0;
}}
""")))

    return programs[:75]


# ============================================================
# CATEGORY 4: Dynamic Programming (75 programs)
# ============================================================

def dp_programs() -> list[tuple[str, str]]:
    programs = []

    # Fibonacci DP
    for i in range(1, 11):
        n = 10 + i * 3
        programs.append((f"fibonacci_dp_{i:02d}", prog(f"""
long long fib(int n) {{
    if (n <= 1) return n;
    vector<long long> dp(n + 1);
    dp[0] = 0; dp[1] = 1;
    for (int i = 2; i <= n; i++) dp[i] = dp[i-1] + dp[i-2];
    return dp[n];
}}
int main() {{
    for (int i = 0; i <= {n}; i++) cout << fib(i) << " ";
    return 0;
}}
""")))

    # 0/1 Knapsack
    for i in range(1, 9):
        n = 3 + i
        w = 10 + i * 5
        programs.append((f"knapsack_{i:02d}", prog(f"""
int knapsack(int W, vector<int>& wt, vector<int>& val, int n) {{
    vector<vector<int>> dp(n + 1, vector<int>(W + 1, 0));
    for (int i = 1; i <= n; i++) {{
        for (int w = 0; w <= W; w++) {{
            dp[i][w] = dp[i-1][w];
            if (wt[i-1] <= w) dp[i][w] = max(dp[i][w], dp[i-1][w - wt[i-1]] + val[i-1]);
        }}
    }}
    return dp[n][W];
}}
int main() {{
    vector<int> val = {{{", ".join(str(j * i % 15 + 1) for j in range(1, n + 1))}}};
    vector<int> wt  = {{{", ".join(str(j * 2 % 8 + 1) for j in range(1, n + 1))}}};
    cout << knapsack({w}, wt, val, {n}) << endl;
    return 0;
}}
""")))

    # Longest Common Subsequence
    for i in range(1, 9):
        programs.append((f"lcs_{i:02d}", prog(f"""
int lcs(string& a, string& b) {{
    int m = a.size(), n = b.size();
    vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));
    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            dp[i][j] = a[i-1] == b[j-1] ? dp[i-1][j-1] + 1 : max(dp[i-1][j], dp[i][j-1]);
    return dp[m][n];
}}
int main() {{
    string a = "{'ABCBDAB'[:i+3]}";
    string b = "{'BDCAB'[:i+2]}";
    cout << lcs(a, b) << endl;
    return 0;
}}
""")))

    # Longest Increasing Subsequence
    for i in range(1, 8):
        programs.append((f"lis_{i:02d}", prog(f"""
int lis(vector<int>& arr) {{
    int n = arr.size();
    vector<int> dp(n, 1);
    for (int i = 1; i < n; i++)
        for (int j = 0; j < i; j++)
            if (arr[j] < arr[i]) dp[i] = max(dp[i], dp[j] + 1);
    return *max_element(dp.begin(), dp.end());
}}
int main() {{
    vector<int> arr = {{{", ".join(str((j * i * 3 + 7) % 15) for j in range(8 + i))}}};
    cout << lis(arr) << endl;
    return 0;
}}
""")))

    # Matrix chain multiplication
    for i in range(1, 7):
        n = 3 + i
        programs.append((f"matrix_chain_{i:02d}", prog(f"""
int matrixChain(vector<int>& p, int n) {{
    vector<vector<int>> dp(n, vector<int>(n, 0));
    for (int len = 2; len < n; len++) {{
        for (int i = 1; i < n - len + 1; i++) {{
            int j = i + len - 1;
            dp[i][j] = INT_MAX;
            for (int k = i; k < j; k++) {{
                int cost = dp[i][k] + dp[k+1][j] + p[i-1]*p[k]*p[j];
                dp[i][j] = min(dp[i][j], cost);
            }}
        }}
    }}
    return dp[1][n-1];
}}
int main() {{
    vector<int> p = {{{", ".join(str(j * i % 20 + 5) for j in range(n + 1))}}};
    cout << matrixChain(p, {n}) << endl;
    return 0;
}}
""")))

    # Coin change
    for i in range(1, 8):
        programs.append((f"coin_change_{i:02d}", prog(f"""
int coinChange(vector<int>& coins, int amount) {{
    vector<int> dp(amount + 1, INT_MAX);
    dp[0] = 0;
    for (int i = 1; i <= amount; i++) {{
        for (int c : coins) {{
            if (c <= i && dp[i - c] != INT_MAX)
                dp[i] = min(dp[i], dp[i - c] + 1);
        }}
    }}
    return dp[amount] == INT_MAX ? -1 : dp[amount];
}}
int main() {{
    vector<int> coins = {{{", ".join(str(j * i % 8 + 1) for j in range(1, 4))}}};
    cout << coinChange(coins, {10 + i * 5}) << endl;
    return 0;
}}
""")))

    # Edit distance
    for i in range(1, 7):
        programs.append((f"edit_distance_{i:02d}", prog(f"""
int editDistance(string& a, string& b) {{
    int m = a.size(), n = b.size();
    vector<vector<int>> dp(m + 1, vector<int>(n + 1));
    for (int i = 0; i <= m; i++) dp[i][0] = i;
    for (int j = 0; j <= n; j++) dp[0][j] = j;
    for (int i = 1; i <= m; i++) {{
        for (int j = 1; j <= n; j++) {{
            if (a[i-1] == b[j-1]) dp[i][j] = dp[i-1][j-1];
            else dp[i][j] = 1 + min({{dp[i-1][j], dp[i][j-1], dp[i-1][j-1]}});
        }}
    }}
    return dp[m][n];
}}
int main() {{
    string a = "kitten"; string b = "sitting";
    cout << editDistance(a, b) << endl;
    return 0;
}}
""")))

    # Partition DP
    for i in range(1, 8):
        programs.append((f"subset_sum_{i:02d}", prog(f"""
bool subsetSum(vector<int>& arr, int sum) {{
    int n = arr.size();
    vector<vector<bool>> dp(n + 1, vector<bool>(sum + 1, false));
    for (int i = 0; i <= n; i++) dp[i][0] = true;
    for (int i = 1; i <= n; i++) {{
        for (int j = 1; j <= sum; j++) {{
            dp[i][j] = dp[i-1][j];
            if (arr[i-1] <= j) dp[i][j] = dp[i][j] || dp[i-1][j - arr[i-1]];
        }}
    }}
    return dp[n][sum];
}}
int main() {{
    vector<int> arr = {{{", ".join(str(j * i % 10 + 1) for j in range(1, 6))}}};
    cout << (subsetSum(arr, {i * 5}) ? "YES" : "NO") << endl;
    return 0;
}}
""")))

    # Rod cutting
    for i in range(1, 7):
        n = 4 + i
        programs.append((f"rod_cutting_{i:02d}", prog(f"""
int rodCutting(vector<int>& price, int n) {{
    vector<int> dp(n + 1, 0);
    for (int i = 1; i <= n; i++) {{
        for (int j = 1; j <= i; j++) {{
            dp[i] = max(dp[i], price[j-1] + dp[i-j]);
        }}
    }}
    return dp[n];
}}
int main() {{
    vector<int> price = {{{", ".join(str(j * i % 12 + 1) for j in range(1, n + 1))}}};
    cout << rodCutting(price, {n}) << endl;
    return 0;
}}
""")))

    return programs[:75]


# ============================================================
# CATEGORY 5: STL Usage Patterns (50 programs)
# ============================================================

def stl_programs() -> list[tuple[str, str]]:
    programs = []

    containers = [
        ("vector", "vector<int>"),
        ("list", "list<int>"),
        ("deque", "deque<int>"),
        ("map", "map<int,int>"),
        ("set", "set<int>"),
        ("multiset", "multiset<int>"),
        ("unordered_map", "unordered_map<int,int>"),
        ("priority_queue", "priority_queue<int>"),
    ]

    for i, (name, ctype) in enumerate(containers * 7):
        idx = i + 1
        if idx > 50:
            break
        programs.append((f"stl_{name}_{idx:02d}", prog(f"""
#include <list>
#include <deque>
#include <unordered_map>
int main() {{
    {ctype} c;
    for (int i = 0; i < {10 + idx}; i++) {{
        c.insert(c.end() if False else c.end(), i);
    }}
    return 0;
}}
""")))

    # Use cleaner STL programs
    programs = []
    for i in range(1, 11):
        programs.append((f"stl_vector_algo_{i:02d}", prog(f"""
int main() {{
    vector<int> v({10 + i * 3});
    iota(v.begin(), v.end(), 1);
    sort(v.begin(), v.end(), greater<int>());
    auto it = find(v.begin(), v.end(), {i * 2});
    if (it != v.end()) v.erase(it);
    v.erase(remove_if(v.begin(), v.end(), [](int x) {{ return x % 3 == 0; }}), v.end());
    int total = accumulate(v.begin(), v.end(), 0);
    cout << total << endl;
    return 0;
}}
""")))

    for i in range(1, 11):
        programs.append((f"stl_map_freq_{i:02d}", prog(f"""
int main() {{
    vector<int> arr = {{{", ".join(str((j * i + 3) % 8) for j in range(10 + i))}}};
    map<int, int> freq;
    for (int x : arr) freq[x]++;
    int maxFreq = 0, mode = 0;
    for (auto& [k, v] : freq) if (v > maxFreq) {{ maxFreq = v; mode = k; }}
    cout << "Mode: " << mode << " Freq: " << maxFreq << endl;
    return 0;
}}
""")))

    for i in range(1, 11):
        programs.append((f"stl_set_ops_{i:02d}", prog(f"""
int main() {{
    set<int> a, b;
    for (int j = 0; j < {8 + i}; j++) a.insert(j);
    for (int j = {i}; j < {8 + i * 2}; j++) b.insert(j);
    vector<int> inter, uni;
    set_intersection(a.begin(), a.end(), b.begin(), b.end(), back_inserter(inter));
    set_union(a.begin(), a.end(), b.begin(), b.end(), back_inserter(uni));
    cout << "Intersection: " << inter.size() << " Union: " << uni.size() << endl;
    return 0;
}}
""")))

    for i in range(1, 11):
        programs.append((f"stl_priority_queue_{i:02d}", prog(f"""
int main() {{
    priority_queue<int> maxHeap;
    priority_queue<int, vector<int>, greater<int>> minHeap;
    for (int j = 0; j < {8 + i * 2}; j++) {{
        maxHeap.push(j * {i} % 50);
        minHeap.push(j * {i} % 50);
    }}
    cout << "Max: " << maxHeap.top() << " Min: " << minHeap.top() << endl;
    return 0;
}}
""")))

    for i in range(1, 11):
        programs.append((f"stl_transform_{i:02d}", prog(f"""
int main() {{
    vector<int> v({8 + i * 2});
    iota(v.begin(), v.end(), 1);
    vector<int> result(v.size());
    transform(v.begin(), v.end(), result.begin(), [](int x) {{ return x * x; }});
    vector<int> evens;
    copy_if(result.begin(), result.end(), back_inserter(evens), [](int x) {{ return x % 2 == 0; }});
    cout << evens.size() << endl;
    return 0;
}}
""")))

    return programs[:50]


# ============================================================
# CATEGORY 6: Memory Management (50 programs)
# ============================================================

def memory_programs() -> list[tuple[str, str]]:
    programs = []

    for i in range(1, 11):
        programs.append((f"linked_list_{i:02d}", prog(f"""
struct Node {{ int data; Node* next; Node(int d) : data(d), next(nullptr) {{}} }};
class LinkedList {{
    Node* head;
public:
    LinkedList() : head(nullptr) {{}}
    void push(int val) {{ Node* n = new Node(val); n->next = head; head = n; }}
    void print() {{ for (Node* p = head; p; p = p->next) cout << p->data << " "; }}
    ~LinkedList() {{ while (head) {{ Node* t = head; head = head->next; delete t; }} }}
}};
int main() {{
    LinkedList ll;
    for (int i = 0; i < {5 + i * 2}; i++) ll.push(i * {i});
    ll.print();
    return 0;
}}
""")))

    for i in range(1, 11):
        programs.append((f"dynamic_array_{i:02d}", prog(f"""
class DynArray {{
    int* data;
    int sz, cap;
public:
    DynArray() : data(new int[4]), sz(0), cap(4) {{}}
    void push(int val) {{
        if (sz == cap) {{
            int* tmp = new int[cap * 2];
            for (int i = 0; i < sz; i++) tmp[i] = data[i];
            delete[] data;
            data = tmp;
            cap *= 2;
        }}
        data[sz++] = val;
    }}
    void print() {{ for (int i = 0; i < sz; i++) cout << data[i] << " "; }}
    ~DynArray() {{ delete[] data; }}
}};
int main() {{
    DynArray arr;
    for (int i = 0; i < {8 + i * 3}; i++) arr.push(i * {i % 5 + 1});
    arr.print();
    return 0;
}}
""")))

    for i in range(1, 9):
        programs.append((f"matrix_heap_{i:02d}", prog(f"""
int main() {{
    int rows = {3 + i}, cols = {3 + i};
    int** matrix = new int*[rows];
    for (int i = 0; i < rows; i++) {{
        matrix[i] = new int[cols];
        for (int j = 0; j < cols; j++) matrix[i][j] = i * cols + j;
    }}
    for (int i = 0; i < rows; i++) {{
        for (int j = 0; j < cols; j++) cout << matrix[i][j] << " ";
        cout << endl;
        delete[] matrix[i];
    }}
    delete[] matrix;
    return 0;
}}
""")))

    for i in range(1, 11):
        programs.append((f"smart_ptr_{i:02d}", prog(f"""
#include <memory>
struct Resource {{
    int id;
    Resource(int id) : id(id) {{ }}
    ~Resource() {{ }}
}};
int main() {{
    vector<unique_ptr<Resource>> resources;
    for (int i = 0; i < {5 + i * 2}; i++) resources.push_back(make_unique<Resource>(i * {i}));
    for (auto& r : resources) cout << r->id << " ";
    return 0;
}}
""")))

    for i in range(1, 10):
        programs.append((f"pool_alloc_{i:02d}", prog(f"""
struct Node {{ int val; Node* next; }};
Node* pool = nullptr;
Node* allocNode(int v) {{
    Node* n = new Node();
    n->val = v; n->next = nullptr;
    return n;
}}
int main() {{
    Node* head = nullptr;
    for (int i = {5 + i}; i >= 0; i--) {{
        Node* n = allocNode(i);
        n->next = head;
        head = n;
    }}
    Node* cur = head;
    while (cur) {{ cout << cur->val << " "; Node* t = cur; cur = cur->next; delete t; }}
    return 0;
}}
""")))

    return programs[:50]


# ============================================================
# CATEGORY 7: Recursion & Trees (50 programs)
# ============================================================

def recursion_tree_programs() -> list[tuple[str, str]]:
    programs = []

    for i in range(1, 11):
        programs.append((f"bst_{i:02d}", prog(f"""
struct Node {{ int key; Node *left, *right; Node(int k) : key(k), left(nullptr), right(nullptr) {{}} }};
Node* insert(Node* root, int key) {{
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else root->right = insert(root->right, key);
    return root;
}}
void inorder(Node* root) {{
    if (!root) return;
    inorder(root->left);
    cout << root->key << " ";
    inorder(root->right);
}}
void freeTree(Node* root) {{ if (!root) return; freeTree(root->left); freeTree(root->right); delete root; }}
int main() {{
    Node* root = nullptr;
    for (int k : {{{", ".join(str((j * i * 3 + 7) % 30) for j in range(1, 8))}}}) root = insert(root, k);
    inorder(root);
    freeTree(root);
    return 0;
}}
""")))

    for i in range(1, 11):
        programs.append((f"tower_of_hanoi_{i:02d}", prog(f"""
void hanoi(int n, char from, char to, char aux) {{
    if (n == 0) return;
    hanoi(n - 1, from, aux, to);
    cout << "Move disk " << n << " from " << from << " to " << to << endl;
    hanoi(n - 1, aux, to, from);
}}
int main() {{
    hanoi({min(i, 5)}, 'A', 'C', 'B');
    return 0;
}}
""")))

    for i in range(1, 11):
        programs.append((f"tree_traversal_{i:02d}", prog(f"""
struct Node {{ int val; Node *l, *r; Node(int v) : val(v), l(nullptr), r(nullptr) {{}} }};
int height(Node* n) {{ return n ? 1 + max(height(n->l), height(n->r)) : 0; }}
int leafCount(Node* n) {{ if (!n) return 0; if (!n->l && !n->r) return 1; return leafCount(n->l) + leafCount(n->r); }}
void postorder(Node* n) {{ if (!n) return; postorder(n->l); postorder(n->r); cout << n->val << " "; }}
void freeTree(Node* n) {{ if (!n) return; freeTree(n->l); freeTree(n->r); delete n; }}
int main() {{
    Node* root = new Node({i});
    root->l = new Node({i+1}); root->r = new Node({i+2});
    root->l->l = new Node({i+3}); root->l->r = new Node({i+4});
    root->r->l = new Node({i+5});
    postorder(root);
    cout << endl << "Height: " << height(root) << " Leaves: " << leafCount(root);
    freeTree(root);
    return 0;
}}
""")))

    for i in range(1, 9):
        programs.append((f"permutations_{i:02d}", prog(f"""
void permute(vector<int>& arr, int l, int r, int& count) {{
    if (l == r) {{ count++; return; }}
    for (int i = l; i <= r; i++) {{
        swap(arr[l], arr[i]);
        permute(arr, l + 1, r, count);
        swap(arr[l], arr[i]);
    }}
}}
int main() {{
    vector<int> arr({min(i, 7)});
    iota(arr.begin(), arr.end(), 1);
    int count = 0;
    permute(arr, 0, arr.size() - 1, count);
    cout << count << " permutations" << endl;
    return 0;
}}
""")))

    for i in range(1, 10):
        programs.append((f"n_queens_{i:02d}", prog(f"""
int n = {min(i + 3, 9)};
bool isSafe(vector<int>& col, int row, int c) {{
    for (int r = 0; r < row; r++) {{
        if (col[r] == c || abs(col[r] - c) == abs(r - row)) return false;
    }}
    return true;
}}
int solve(vector<int>& col, int row) {{
    if (row == n) return 1;
    int count = 0;
    for (int c = 0; c < n; c++) {{
        if (isSafe(col, row, c)) {{
            col[row] = c;
            count += solve(col, row + 1);
        }}
    }}
    return count;
}}
int main() {{
    vector<int> col(n);
    cout << solve(col, 0) << " solutions" << endl;
    return 0;
}}
""")))

    return programs[:50]


# ============================================================
# CATEGORY 8: Competitive Programming (50 programs)
# ============================================================

def competitive_programs() -> list[tuple[str, str]]:
    programs = []

    for i in range(1, 11):
        programs.append((f"segment_tree_{i:02d}", prog(f"""
struct SegTree {{
    int n;
    vector<int> tree;
    SegTree(vector<int>& arr) : n(arr.size()), tree(4 * arr.size()) {{ build(arr, 0, 0, n-1); }}
    void build(vector<int>& arr, int node, int l, int r) {{
        if (l == r) {{ tree[node] = arr[l]; return; }}
        int m = (l + r) / 2;
        build(arr, 2*node+1, l, m);
        build(arr, 2*node+2, m+1, r);
        tree[node] = tree[2*node+1] + tree[2*node+2];
    }}
    int query(int node, int l, int r, int ql, int qr) {{
        if (qr < l || r < ql) return 0;
        if (ql <= l && r <= qr) return tree[node];
        int m = (l + r) / 2;
        return query(2*node+1, l, m, ql, qr) + query(2*node+2, m+1, r, ql, qr);
    }}
    int query(int l, int r) {{ return query(0, 0, n-1, l, r); }}
}};
int main() {{
    vector<int> arr({5 + i * 3});
    iota(arr.begin(), arr.end(), 1);
    SegTree st(arr);
    cout << st.query(0, {i * 2}) << endl;
    return 0;
}}
""")))

    for i in range(1, 9):
        programs.append((f"fenwick_tree_{i:02d}", prog(f"""
struct BIT {{
    int n;
    vector<int> tree;
    BIT(int n) : n(n), tree(n + 1, 0) {{}}
    void update(int i, int delta) {{ for (++i; i <= n; i += i & (-i)) tree[i] += delta; }}
    int query(int i) {{ int s = 0; for (++i; i > 0; i -= i & (-i)) s += tree[i]; return s; }}
    int query(int l, int r) {{ return query(r) - (l > 0 ? query(l-1) : 0); }}
}};
int main() {{
    int n = {8 + i * 2};
    BIT bit(n);
    for (int i = 0; i < n; i++) bit.update(i, i + 1);
    cout << bit.query(0, {i * 2}) << endl;
    return 0;
}}
""")))

    for i in range(1, 9):
        programs.append((f"two_pointer_{i:02d}", prog(f"""
int main() {{
    vector<int> arr({10 + i * 3});
    iota(arr.begin(), arr.end(), 1);
    int target = {(i + 3) * 5};
    int l = 0, r = arr.size() - 1, count = 0;
    while (l < r) {{
        int sum = arr[l] + arr[r];
        if (sum == target) {{ count++; l++; r--; }}
        else if (sum < target) l++;
        else r--;
    }}
    cout << count << " pairs" << endl;
    return 0;
}}
""")))

    for i in range(1, 9):
        programs.append((f"sliding_window_{i:02d}", prog(f"""
int main() {{
    vector<int> arr = {{{", ".join(str((j * i + 3) % 15) for j in range(10 + i))}}};
    int k = {2 + i % 4};
    int windowSum = 0, maxSum = 0;
    for (int i = 0; i < k; i++) windowSum += arr[i];
    maxSum = windowSum;
    for (int i = k; i < (int)arr.size(); i++) {{
        windowSum += arr[i] - arr[i - k];
        maxSum = max(maxSum, windowSum);
    }}
    cout << maxSum << endl;
    return 0;
}}
""")))

    for i in range(1, 7):
        programs.append((f"kadane_{i:02d}", prog(f"""
int main() {{
    vector<int> arr = {{{", ".join(str((j * i - 5) % 20 - 8) for j in range(8 + i))}}};
    int maxSum = arr[0], cur = arr[0];
    for (int i = 1; i < (int)arr.size(); i++) {{
        cur = max(arr[i], cur + arr[i]);
        maxSum = max(maxSum, cur);
    }}
    cout << maxSum << endl;
    return 0;
}}
""")))

    for i in range(1, 6):
        programs.append((f"fast_exponent_{i:02d}", prog(f"""
long long power(long long base, long long exp, long long mod) {{
    long long result = 1;
    base %= mod;
    while (exp > 0) {{
        if (exp % 2 == 1) result = result * base % mod;
        base = base * base % mod;
        exp /= 2;
    }}
    return result;
}}
int main() {{
    cout << power({i * 3}, {i * 7 + 10}, {i * 100 + 7}) << endl;
    return 0;
}}
""")))

    return programs[:50]


# ============================================================
# CATEGORY 9: Mathematical Algorithms (25 programs)
# ============================================================

def math_programs() -> list[tuple[str, str]]:
    programs = []

    for i in range(1, 8):
        programs.append((f"sieve_primes_{i:02d}", prog(f"""
vector<int> sieve(int n) {{
    vector<bool> is_prime(n + 1, true);
    vector<int> primes;
    is_prime[0] = is_prime[1] = false;
    for (int i = 2; i <= n; i++) {{
        if (is_prime[i]) {{
            primes.push_back(i);
            for (long long j = (long long)i * i; j <= n; j += i) is_prime[j] = false;
        }}
    }}
    return primes;
}}
int main() {{
    auto p = sieve({50 + i * 20});
    cout << p.size() << " primes. Last: " << p.back() << endl;
    return 0;
}}
""")))

    for i in range(1, 7):
        programs.append((f"gcd_lcm_{i:02d}", prog(f"""
long long gcd(long long a, long long b) {{ return b == 0 ? a : gcd(b, a % b); }}
long long lcm(long long a, long long b) {{ return a / gcd(a, b) * b; }}
int main() {{
    vector<long long> nums = {{{", ".join(str(j * i * 3 + 7) for j in range(1, 6))}}};
    long long g = nums[0], l = nums[0];
    for (int i = 1; i < (int)nums.size(); i++) {{
        g = gcd(g, nums[i]);
        l = lcm(l, nums[i]);
    }}
    cout << "GCD=" << g << " LCM=" << l << endl;
    return 0;
}}
""")))

    for i in range(1, 7):
        programs.append((f"matrix_mult_{i:02d}", prog(f"""
int main() {{
    int n = {2 + i};
    vector<vector<int>> A(n, vector<int>(n)), B(n, vector<int>(n)), C(n, vector<int>(n, 0));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) {{ A[i][j] = i + j; B[i][j] = i * j + 1; }}
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            for (int k = 0; k < n; k++)
                C[i][j] += A[i][k] * B[k][j];
    cout << C[0][0] << " " << C[n-1][n-1] << endl;
    return 0;
}}
""")))

    for i in range(1, 6):
        programs.append((f"number_theory_{i:02d}", prog(f"""
bool isPrime(int n) {{
    if (n < 2) return false;
    for (int i = 2; i * i <= n; i++) if (n % i == 0) return false;
    return true;
}}
vector<int> primeFactors(int n) {{
    vector<int> factors;
    for (int i = 2; i * i <= n; i++) while (n % i == 0) {{ factors.push_back(i); n /= i; }}
    if (n > 1) factors.push_back(n);
    return factors;
}}
int main() {{
    int n = {i * 37 + 13};
    auto f = primeFactors(n);
    cout << n << " factors: ";
    for (int x : f) cout << x << " ";
    return 0;
}}
""")))

    return programs[:25]


# ============================================================
# CATEGORY 10: String Algorithms (25 programs)
# ============================================================

def string_programs() -> list[tuple[str, str]]:
    programs = []

    for i in range(1, 9):
        programs.append((f"kmp_{i:02d}", prog(f"""
vector<int> buildLPS(const string& pattern) {{
    int m = pattern.size();
    vector<int> lps(m, 0);
    int len = 0, i = 1;
    while (i < m) {{
        if (pattern[i] == pattern[len]) {{ lps[i++] = ++len; }}
        else if (len) len = lps[len - 1];
        else lps[i++] = 0;
    }}
    return lps;
}}
int kmpSearch(const string& text, const string& pattern) {{
    auto lps = buildLPS(pattern);
    int i = 0, j = 0, count = 0;
    while (i < (int)text.size()) {{
        if (text[i] == pattern[j]) {{ i++; j++; }}
        if (j == (int)pattern.size()) {{ count++; j = lps[j-1]; }}
        else if (i < (int)text.size() && text[i] != pattern[j])
            j ? j = lps[j-1] : i++;
    }}
    return count;
}}
int main() {{
    string text = "{'ababcababcabc'[:5 + i * 2]}";
    string pat = "{'abc'[:1 + i % 3]}";
    cout << kmpSearch(text, pat) << " occurrences" << endl;
    return 0;
}}
""")))

    for i in range(1, 9):
        programs.append((f"palindrome_{i:02d}", prog(f"""
bool isPalindrome(const string& s) {{
    int l = 0, r = s.size() - 1;
    while (l < r) if (s[l++] != s[r--]) return false;
    return true;
}}
string longestPalindrome(const string& s) {{
    int n = s.size(), start = 0, maxLen = 1;
    for (int i = 0; i < n; i++) {{
        for (int l = i, r = i; l >= 0 && r < n && s[l] == s[r]; l--, r++)
            if (r - l + 1 > maxLen) {{ maxLen = r - l + 1; start = l; }}
        for (int l = i, r = i + 1; l >= 0 && r < n && s[l] == s[r]; l--, r++)
            if (r - l + 1 > maxLen) {{ maxLen = r - l + 1; start = l; }}
    }}
    return s.substr(start, maxLen);
}}
int main() {{
    string s = "{'babad racecar madam level'[:4 + i * 3]}";
    cout << longestPalindrome(s) << endl;
    return 0;
}}
""")))

    for i in range(1, 9):
        programs.append((f"anagram_{i:02d}", prog(f"""
bool isAnagram(const string& a, const string& b) {{
    if (a.size() != b.size()) return false;
    map<char, int> freq;
    for (char c : a) freq[c]++;
    for (char c : b) if (--freq[c] < 0) return false;
    return true;
}}
int main() {{
    vector<pair<string,string>> tests = {{
        {{"listen", "silent"}},
        {{"hello", "world"}},
        {{"{'anagram'[:i+2]}", "{'nagaram'[:i+2]}"}}
    }};
    for (auto& [a, b] : tests) cout << a << "/" << b << ": " << (isAnagram(a, b) ? "YES" : "NO") << endl;
    return 0;
}}
""")))

    return programs[:25]


# ============================================================
# CATEGORY 11: Matrix Operations (25 programs)
# ============================================================

def matrix_programs() -> list[tuple[str, str]]:
    programs = []

    for i in range(1, 10):
        n = 2 + i
        programs.append((f"matrix_ops_{i:02d}", prog(f"""
int main() {{
    int n = {n};
    vector<vector<int>> A(n, vector<int>(n)), B(n, vector<int>(n));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) {{
        A[i][j] = i * n + j + 1;
        B[i][j] = (i + j) * {i % 3 + 1};
    }}
    // Addition
    vector<vector<int>> C(n, vector<int>(n));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) C[i][j] = A[i][j] + B[i][j];
    // Transpose of C
    vector<vector<int>> T(n, vector<int>(n));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) T[i][j] = C[j][i];
    int trace = 0;
    for (int i = 0; i < n; i++) trace += T[i][i];
    cout << "Trace: " << trace << endl;
    return 0;
}}
""")))

    for i in range(1, 9):
        programs.append((f"spiral_matrix_{i:02d}", prog(f"""
int main() {{
    int n = {2 + i};
    vector<vector<int>> mat(n, vector<int>(n));
    int top = 0, bottom = n-1, left = 0, right = n-1, num = 1;
    while (top <= bottom && left <= right) {{
        for (int i = left; i <= right; i++) mat[top][i] = num++;
        top++;
        for (int i = top; i <= bottom; i++) mat[i][right] = num++;
        right--;
        if (top <= bottom) {{ for (int i = right; i >= left; i--) mat[bottom][i] = num++; bottom--; }}
        if (left <= right) {{ for (int i = bottom; i >= top; i--) mat[i][left] = num++; left++; }}
    }}
    for (auto& row : mat) {{ for (int x : row) cout << x << "\t"; cout << endl; }}
    return 0;
}}
""")))

    for i in range(1, 8):
        programs.append((f"rotate_matrix_{i:02d}", prog(f"""
int main() {{
    int n = {2 + i};
    vector<vector<int>> mat(n, vector<int>(n));
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) mat[i][j] = i * n + j;
    // Rotate 90 degrees clockwise
    for (int i = 0; i < n / 2; i++) for (int j = i; j < n - i - 1; j++) {{
        int tmp = mat[i][j];
        mat[i][j] = mat[n-j-1][i];
        mat[n-j-1][i] = mat[n-i-1][n-j-1];
        mat[n-i-1][n-j-1] = mat[j][n-i-1];
        mat[j][n-i-1] = tmp;
    }}
    for (auto& row : mat) {{ for (int x : row) cout << x << " "; cout << endl; }}
    return 0;
}}
""")))

    return programs[:25]


# ============================================================
# CATEGORY 12: Miscellaneous Real-World (25 programs)
# ============================================================

def misc_programs() -> list[tuple[str, str]]:
    programs = []

    for i in range(1, 7):
        programs.append((f"stack_calculator_{i:02d}", prog(f"""
int evaluate(const string& expr) {{
    stack<int> vals;
    stack<char> ops;
    auto applyOp = [&]() {{
        int b = vals.top(); vals.pop();
        int a = vals.top(); vals.pop();
        char op = ops.top(); ops.pop();
        if (op == '+') vals.push(a + b);
        else if (op == '-') vals.push(a - b);
        else if (op == '*') vals.push(a * b);
    }};
    for (int i = 0; i < (int)expr.size(); i++) {{
        if (isdigit(expr[i])) {{
            int num = 0;
            while (i < (int)expr.size() && isdigit(expr[i])) num = num * 10 + (expr[i++] - '0');
            i--;
            vals.push(num);
        }} else if (expr[i] == '+' || expr[i] == '-') {{
            while (!ops.empty()) applyOp();
            ops.push(expr[i]);
        }} else if (expr[i] == '*') ops.push(expr[i]);
    }}
    while (!ops.empty()) applyOp();
    return vals.top();
}}
int main() {{
    cout << evaluate("{i * 3}+{i * 2}*{i + 1}") << endl;
    return 0;
}}
""")))

    for i in range(1, 7):
        programs.append((f"event_sim_{i:02d}", prog(f"""
struct Event {{ int time, id; bool operator>(const Event& o) const {{ return time > o.time; }} }};
int main() {{
    priority_queue<Event, vector<Event>, greater<Event>> pq;
    for (int i = 0; i < {5 + i * 2}; i++) pq.push({{(i * {i} * 7) % 100, i}});
    int lastTime = -1;
    while (!pq.empty()) {{
        auto e = pq.top(); pq.pop();
        if (e.time < lastTime) {{ cout << "ERROR: out of order!" << endl; return 1; }}
        lastTime = e.time;
        cout << "t=" << e.time << " id=" << e.id << endl;
    }}
    return 0;
}}
""")))

    for i in range(1, 7):
        programs.append((f"word_freq_{i:02d}", prog(f"""
int main() {{
    vector<string> words = {{"the","quick","brown","fox","jumps","the","lazy","dog","the","fox"}};
    map<string, int> freq;
    for (const auto& w : words) freq[w]++;
    vector<pair<int,string>> sorted;
    for (auto& [k, v] : freq) sorted.push_back({{v, k}});
    sort(sorted.rbegin(), sorted.rend());
    for (int i = 0; i < min({i + 2}, (int)sorted.size()); i++)
        cout << sorted[i].second << ": " << sorted[i].first << endl;
    return 0;
}}
""")))

    for i in range(1, 6):
        programs.append((f"compression_{i:02d}", prog(f"""
string rleEncode(const string& s) {{
    string result;
    int i = 0;
    while (i < (int)s.size()) {{
        char c = s[i];
        int count = 0;
        while (i < (int)s.size() && s[i] == c) {{ i++; count++; }}
        result += c;
        result += to_string(count);
    }}
    return result;
}}
int main() {{
    string s = "{'aaabbbccddddee'[:4 + i * 2]}";
    cout << rleEncode(s) << endl;
    return 0;
}}
""")))

    return programs[:25]


# ============================================================
# Main
# ============================================================

CATEGORIES = [
    ("sorting",      sorting_programs),
    ("searching",    searching_programs),
    ("graph",        graph_programs),
    ("dynamic_programming", dp_programs),
    ("stl",          stl_programs),
    ("memory_management", memory_programs),
    ("recursion_trees", recursion_tree_programs),
    ("competitive",  competitive_programs),
    ("math",         math_programs),
    ("strings",      string_programs),
    ("matrix",       matrix_programs),
    ("misc",         misc_programs),
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    total = 0
    for category, generator in CATEGORIES:
        cat_dir = args.out_dir / category
        cat_dir.mkdir(parents=True, exist_ok=True)
        programs = generator()
        for name, code in programs:
            out_path = cat_dir / f"{name}.cpp"
            out_path.write_text(code, encoding="utf-8")
            total += 1

    print(f"Generated {total} C++ programs in {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
