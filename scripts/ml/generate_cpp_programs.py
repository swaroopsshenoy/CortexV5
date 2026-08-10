#!/usr/bin/env python3
"""
Generate a JSONL dataset of unoptimized vs optimized C++ programs.
Used for fine-tuning LLMs on code optimization tasks.
"""

import json
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "resources" / "ml_performance_dataset" / "dataset.jsonl"

HEADER = '#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <string>\n#include <cmath>\n#include <climits>\n#include <map>\n#include <set>\n#include <queue>\n#include <stack>\nusing namespace std;\n\n'

def prog(body: str) -> str:
    return HEADER + body

# ============================================================
# Algorithmic Optimizations
# ============================================================

def algorithmic_programs():
    programs = []
    
    # 1. Two Pointers (Two Sum on sorted array)
    for i in range(1, 10):
        n = 10 + i * 5
        unopt = prog(f"""
void twoSum(const vector<int>& arr, int target) {{
    int n = arr.size();
    for (int i = 0; i < n; i++) {{
        for (int j = i + 1; j < n; j++) {{
            if (arr[i] + arr[j] == target) {{
                cout << i << " " << j << endl;
                return;
            }}
        }}
    }}
}}
int main() {{
    vector<int> arr({n});
    for(int i=0; i<{n}; i++) arr[i] = i * 2;
    twoSum(arr, {n});
    return 0;
}}
""")
        opt = prog(f"""
void twoSum(const vector<int>& arr, int target) {{
    int left = 0, right = arr.size() - 1;
    while (left < right) {{
        int sum = arr[left] + arr[right];
        if (sum == target) {{
            cout << left << " " << right << endl;
            return;
        }} else if (sum < target) {{
            left++;
        }} else {{
            right--;
        }}
    }}
}}
int main() {{
    vector<int> arr({n});
    for(int i=0; i<{n}; i++) arr[i] = i * 2;
    twoSum(arr, {n});
    return 0;
}}
""")
        programs.append({"name": f"two_pointers_{i:02d}", "category": "algorithmic", "subcategory": "two_pointers", "unoptimized": unopt, "optimized": opt})

    # 1b. Two Pointers (Container with Most Water / maxWater)
    for i in range(1, 10):
        n = 5 + i
        arr_vals = ", ".join(str((idx * 3 + 2) % 10 + 1) for idx in range(n))
        unopt = prog(f"""
int maxWater(vector<int> &arr) {{
    int n = arr.size();
    int res = 0;
    for (int i = 0; i < n; i++) {{
        for (int j = i + 1; j < n; j++) {{
            int amount = min(arr[i], arr[j]) * (j - i);
            res = max(amount, res);
        }}
    }}
    return res;
}}
int main() {{
    vector<int> arr = {{{arr_vals}}};
    cout << maxWater(arr);
    return 0;
}}
""")
        opt = prog(f"""
int maxWater(vector<int> &arr) {{
    int left = 0, right = arr.size() - 1;
    int res = 0;
    while (left < right) {{
        int height = min(arr[left], arr[right]);
        int amount = height * (right - left);
        res = max(res, amount);
        if (arr[left] < arr[right]) {{
            left++;
        }} else {{
            right--;
        }}
    }}
    return res;
}}
int main() {{
    vector<int> arr = {{{arr_vals}}};
    cout << maxWater(arr);
    return 0;
}}
""")
        programs.append({"name": f"max_water_{i:02d}", "category": "algorithmic", "subcategory": "two_pointers", "unoptimized": unopt, "optimized": opt})

    # 2. Greedy (Activity Selection)
    for i in range(1, 10):
        unopt = prog("""
struct Activity { int start, finish; };
int maxActivities(vector<Activity>& arr) {
    int n = arr.size();
    int maxCount = 0;
    for (int i = 0; i < (1 << n); i++) {
        int count = 0;
        int lastFinish = -1;
        bool valid = true;
        for (int j = 0; j < n; j++) {
            if (i & (1 << j)) {
                if (arr[j].start < lastFinish) { valid = false; break; }
                lastFinish = arr[j].finish;
                count++;
            }
        }
        if (valid && count > maxCount) maxCount = count;
    }
    return maxCount;
}
int main() {
    vector<Activity> arr = {{1, 2}, {3, 4}, {0, 6}, {5, 7}, {8, 9}, {5, 9}};
    cout << maxActivities(arr) << endl;
    return 0;
}
""")
        opt = prog("""
struct Activity { int start, finish; };
bool compareActivity(Activity s1, Activity s2) { return (s1.finish < s2.finish); }
int maxActivities(vector<Activity>& arr) {
    sort(arr.begin(), arr.end(), compareActivity);
    int n = arr.size();
    int count = 1;
    int i = 0;
    for (int j = 1; j < n; j++) {
        if (arr[j].start >= arr[i].finish) {
            count++;
            i = j;
        }
    }
    return count;
}
int main() {
    vector<Activity> arr = {{1, 2}, {3, 4}, {0, 6}, {5, 7}, {8, 9}, {5, 9}};
    cout << maxActivities(arr) << endl;
    return 0;
}
""")
        programs.append({"name": f"greedy_activity_{i:02d}", "category": "algorithmic", "subcategory": "greedy", "unoptimized": unopt, "optimized": opt})

    # 3. Knapsack
    for i in range(1, 10):
        unopt = prog("""
int knapsackRec(int W, const vector<int>& wt, const vector<int>& val, int n) {
    if (n == 0 || W == 0) return 0;
    if (wt[n - 1] > W) return knapsackRec(W, wt, val, n - 1);
    else return max(val[n - 1] + knapsackRec(W - wt[n - 1], wt, val, n - 1),
                    knapsackRec(W, wt, val, n - 1));
}
int main() {
    vector<int> val = {60, 100, 120};
    vector<int> wt = {10, 20, 30};
    int W = 50;
    cout << knapsackRec(W, wt, val, val.size()) << endl;
    return 0;
}
""")
        opt = prog("""
int knapsackDP(int W, const vector<int>& wt, const vector<int>& val, int n) {
    vector<vector<int>> dp(n + 1, vector<int>(W + 1, 0));
    for (int i = 1; i <= n; i++) {
        for (int w = 0; w <= W; w++) {
            if (wt[i - 1] <= w) dp[i][w] = max(val[i - 1] + dp[i - 1][w - wt[i - 1]], dp[i - 1][w]);
            else dp[i][w] = dp[i - 1][w];
        }
    }
    return dp[n][W];
}
int main() {
    vector<int> val = {60, 100, 120};
    vector<int> wt = {10, 20, 30};
    int W = 50;
    cout << knapsackDP(W, wt, val, val.size()) << endl;
    return 0;
}
""")
        programs.append({"name": f"knapsack_{i:02d}", "category": "algorithmic", "subcategory": "knapsack", "unoptimized": unopt, "optimized": opt})

    # 4. Dijkstra's
    for i in range(1, 10):
        unopt = prog("""
int minDistance(const vector<int>& dist, const vector<bool>& sptSet, int V) {
    int min = INT_MAX, min_index;
    for (int v = 0; v < V; v++)
        if (sptSet[v] == false && dist[v] <= min)
            min = dist[v], min_index = v;
    return min_index;
}
void dijkstra(const vector<vector<int>>& graph, int src) {
    int V = graph.size();
    vector<int> dist(V, INT_MAX);
    vector<bool> sptSet(V, false);
    dist[src] = 0;
    for (int count = 0; count < V - 1; count++) {
        int u = minDistance(dist, sptSet, V);
        sptSet[u] = true;
        for (int v = 0; v < V; v++)
            if (!sptSet[v] && graph[u][v] && dist[u] != INT_MAX && dist[u] + graph[u][v] < dist[v])
                dist[v] = dist[u] + graph[u][v];
    }
    for (int i = 0; i < V; i++) cout << i << " \t\t " << dist[i] << endl;
}
int main() {
    vector<vector<int>> graph = {{0, 4, 0, 0, 0}, {4, 0, 8, 0, 0}, {0, 8, 0, 7, 0}, {0, 0, 7, 0, 9}, {0, 0, 0, 9, 0}};
    dijkstra(graph, 0);
    return 0;
}
""")
        opt = prog("""
void dijkstraOpt(const vector<vector<pair<int, int>>>& adj, int src) {
    int V = adj.size();
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
    vector<int> dist(V, INT_MAX);
    pq.push(make_pair(0, src));
    dist[src] = 0;
    while (!pq.empty()) {
        int u = pq.top().second;
        pq.pop();
        for (auto x : adj[u]) {
            int v = x.first;
            int weight = x.second;
            if (dist[v] > dist[u] + weight) {
                dist[v] = dist[u] + weight;
                pq.push(make_pair(dist[v], v));
            }
        }
    }
    for (int i = 0; i < V; ++i) cout << i << " \t\t " << dist[i] << endl;
}
int main() {
    int V = 5;
    vector<vector<pair<int, int>>> adj(V);
    adj[0].push_back({1, 4}); adj[1].push_back({0, 4});
    adj[1].push_back({2, 8}); adj[2].push_back({1, 8});
    adj[2].push_back({3, 7}); adj[3].push_back({2, 7});
    adj[3].push_back({4, 9}); adj[4].push_back({3, 9});
    dijkstraOpt(adj, 0);
    return 0;
}
""")
        programs.append({"name": f"dijkstra_{i:02d}", "category": "algorithmic", "subcategory": "dijkstra", "unoptimized": unopt, "optimized": opt})

    # 5. Peak Finding
    for i in range(1, 10):
        unopt = prog("""
int findPeak(vector<int>& arr) {
    int n = arr.size();
    if (n == 1) return 0;
    if (arr[0] >= arr[1]) return 0;
    if (arr[n - 1] >= arr[n - 2]) return n - 1;
    for (int i = 1; i < n - 1; i++) {
        if (arr[i] >= arr[i - 1] && arr[i] >= arr[i + 1]) return i;
    }
    return 0;
}
int main() {
    vector<int> arr = {1, 3, 20, 4, 1, 0};
    cout << findPeak(arr) << endl;
    return 0;
}
""")
        opt = prog("""
int findPeakUtil(vector<int>& arr, int low, int high, int n) {
    int mid = low + (high - low) / 2;
    if ((mid == 0 || arr[mid - 1] <= arr[mid]) && (mid == n - 1 || arr[mid + 1] <= arr[mid])) return mid;
    else if (mid > 0 && arr[mid - 1] > arr[mid]) return findPeakUtil(arr, low, (mid - 1), n);
    else return findPeakUtil(arr, (mid + 1), high, n);
}
int findPeak(vector<int>& arr) {
    return findPeakUtil(arr, 0, arr.size() - 1, arr.size());
}
int main() {
    vector<int> arr = {1, 3, 20, 4, 1, 0};
    cout << findPeak(arr) << endl;
    return 0;
}
""")
        programs.append({"name": f"peak_finding_{i:02d}", "category": "algorithmic", "subcategory": "peak_finding", "unoptimized": unopt, "optimized": opt})

    # 6. Sliding Window
    for i in range(1, 10):
        n = 10 + i * 5
        k = 2 + (i % 4)
        unopt = prog(f"""
int maxSubarraySum(const vector<int>& arr, int k) {{
    int n = arr.size();
    int max_sum = INT_MIN;
    for (int i = 0; i <= n - k; i++) {{
        int current_sum = 0;
        for (int j = 0; j < k; j++) {{
            current_sum += arr[i + j];
        }}
        max_sum = max(max_sum, current_sum);
    }}
    return max_sum;
}}
int main() {{
    vector<int> arr({n});
    for(int i=0; i<{n}; i++) arr[i] = i * 3 - (i % 2) * 5;
    cout << maxSubarraySum(arr, {k}) << endl;
    return 0;
}}
""")
        opt = prog(f"""
int maxSubarraySum(const vector<int>& arr, int k) {{
    int n = arr.size();
    if (n < k) return 0;
    int window_sum = 0;
    for (int i = 0; i < k; i++) window_sum += arr[i];
    int max_sum = window_sum;
    for (int i = k; i < n; i++) {{
        window_sum += arr[i] - arr[i - k];
        max_sum = max(max_sum, window_sum);
    }}
    return max_sum;
}}
int main() {{
    vector<int> arr({n});
    for(int i=0; i<{n}; i++) arr[i] = i * 3 - (i % 2) * 5;
    cout << maxSubarraySum(arr, {k}) << endl;
    return 0;
}}
""")
        programs.append({"name": f"sliding_window_{i:02d}", "category": "algorithmic", "subcategory": "sliding_window", "unoptimized": unopt, "optimized": opt})

    # 7. Binary Search on Answer
    for i in range(1, 10):
        n = 5 + i
        m = 2 + (i % 3)
        unopt = prog(f"""
bool isPossible(const vector<int>& arr, int n, int m, int curr_min) {{
    int studentsRequired = 1;
    int curr_sum = 0;
    for (int i = 0; i < n; i++) {{
        if (arr[i] > curr_min) return false;
        if (curr_sum + arr[i] > curr_min) {{
            studentsRequired++;
            curr_sum = arr[i];
            if (studentsRequired > m) return false;
        }} else {{
            curr_sum += arr[i];
        }}
    }}
    return true;
}}
int findPages(const vector<int>& arr, int n, int m) {{
    long long sum = 0;
    int maxVal = 0;
    for (int i = 0; i < n; i++) {{
        sum += arr[i];
        maxVal = max(maxVal, arr[i]);
    }}
    for (int pages = maxVal; pages <= sum; pages++) {{
        if (isPossible(arr, n, m, pages)) return pages;
    }}
    return -1;
}}
int main() {{
    vector<int> arr({n});
    for(int i=0; i<{n}; i++) arr[i] = (i + 1) * 10 + {i};
    cout << findPages(arr, {n}, {m}) << endl;
    return 0;
}}
""")
        opt = prog(f"""
bool isPossible(const vector<int>& arr, int n, int m, int curr_min) {{
    int studentsRequired = 1;
    int curr_sum = 0;
    for (int i = 0; i < n; i++) {{
        if (arr[i] > curr_min) return false;
        if (curr_sum + arr[i] > curr_min) {{
            studentsRequired++;
            curr_sum = arr[i];
            if (studentsRequired > m) return false;
        }} else {{
            curr_sum += arr[i];
        }}
    }}
    return true;
}}
int findPages(const vector<int>& arr, int n, int m) {{
    long long sum = 0;
    int maxVal = 0;
    for (int i = 0; i < n; i++) {{
        sum += arr[i];
        maxVal = max(maxVal, arr[i]);
    }}
    int start = maxVal, end = sum, ans = -1;
    while (start <= end) {{
        int mid = start + (end - start) / 2;
        if (isPossible(arr, n, m, mid)) {{
            ans = mid;
            end = mid - 1;
        }} else {{
            start = mid + 1;
        }}
    }}
    return ans;
}}
int main() {{
    vector<int> arr({n});
    for(int i=0; i<{n}; i++) arr[i] = (i + 1) * 10 + {i};
    cout << findPages(arr, {n}, {m}) << endl;
    return 0;
}}
""")
        programs.append({"name": f"binary_search_ans_{i:02d}", "category": "algorithmic", "subcategory": "binary_search_ans", "unoptimized": unopt, "optimized": opt})

    # 8. Dynamic Programming - LIS
    for i in range(1, 10):
        n = 8 + i
        unopt = prog(f"""
int lis(const vector<int>& arr) {{
    int n = arr.size();
    vector<int> dp(n, 1);
    int max_lis = 0;
    for (int i = 1; i < n; i++) {{
        for (int j = 0; j < i; j++) {{
            if (arr[i] > arr[j] && dp[i] < dp[j] + 1) {{
                dp[i] = dp[j] + 1;
            }}
        }}
    }}
    for (int i = 0; i < n; i++) max_lis = max(max_lis, dp[i]);
    return max_lis;
}}
int main() {{
    vector<int> arr({n});
    for(int i=0; i<{n}; i++) arr[i] = (i * 7 + 11) % 13 + {i};
    cout << lis(arr) << endl;
    return 0;
}}
""")
        opt = prog(f"""
int lis(const vector<int>& arr) {{
    int n = arr.size();
    if (n == 0) return 0;
    vector<int> tails;
    for (int x : arr) {{
        auto it = lower_bound(tails.begin(), tails.end(), x);
        if (it == tails.end()) tails.push_back(x);
        else *it = x;
    }}
    return tails.size();
}}
int main() {{
    vector<int> arr({n});
    for(int i=0; i<{n}; i++) arr[i] = (i * 7 + 11) % 13 + {i};
    cout << lis(arr) << endl;
    return 0;
}}
""")
        programs.append({"name": f"lis_{i:02d}", "category": "algorithmic", "subcategory": "lis", "unoptimized": unopt, "optimized": opt})

    # 9. Segment Tree
    for i in range(1, 10):
        n = 8 + i
        unopt = prog(f"""
void update(vector<int>& arr, int idx, int val) {{
    arr[idx] = val;
}}
int query(const vector<int>& arr, int l, int r) {{
    int sum = 0;
    for (int i = l; i <= r; i++) sum += arr[i];
    return sum;
}}
int main() {{
    vector<int> arr({n});
    for(int i=0; i<{n}; i++) arr[i] = i * 2;
    update(arr, 2, 10 + {i});
    cout << query(arr, 1, 5) << endl;
    return 0;
}}
""")
        opt = prog(f"""
class SegTree {{
    vector<int> tree; int n;
    void build(const vector<int>& arr, int node, int start, int end) {{
        if (start == end) {{ tree[node] = arr[start]; return; }}
        int mid = start + (end - start) / 2;
        build(arr, 2 * node, start, mid);
        build(arr, 2 * node + 1, mid + 1, end);
        tree[node] = tree[2 * node] + tree[2 * node + 1];
    }}
    void updateVal(int node, int start, int end, int idx, int val) {{
        if (start == end) {{ tree[node] = val; return; }}
        int mid = start + (end - start) / 2;
        if (idx <= mid) updateVal(2 * node, start, mid, idx, val);
        else updateVal(2 * node + 1, mid + 1, end, idx, val);
        tree[node] = tree[2 * node] + tree[2 * node + 1];
    }}
    int queryRange(int node, int start, int end, int l, int r) {{
        if (r < start || end < l) return 0;
        if (l <= start && end <= r) return tree[node];
        int mid = start + (end - start) / 2;
        return queryRange(2 * node, start, mid, l, r) + queryRange(2 * node + 1, mid + 1, end, l, r);
    }}
public:
    SegTree(const vector<int>& arr) {{
        n = arr.size();
        tree.resize(4 * n, 0);
        build(arr, 1, 0, n - 1);
    }}
    void update(int idx, int val) {{ updateVal(1, 0, n - 1, idx, val); }}
    int query(int l, int r) {{ return queryRange(1, 0, n - 1, l, r); }}
}};
int main() {{
    vector<int> arr({n});
    for(int i=0; i<{n}; i++) arr[i] = i * 2;
    SegTree st(arr);
    st.update(2, 10 + {i});
    cout << st.query(1, 5) << endl;
    return 0;
}}
""")
        programs.append({"name": f"segment_tree_{i:02d}", "category": "algorithmic", "subcategory": "segment_tree", "unoptimized": unopt, "optimized": opt})

    # 10. Fenwick Tree
    for i in range(1, 10):
        n = 8 + i
        unopt = prog(f"""
void update(vector<int>& arr, int idx, int val) {{
    arr[idx] += val;
}}
int query(const vector<int>& arr, int idx) {{
    int sum = 0;
    for (int i = 0; i <= idx; i++) sum += arr[i];
    return sum;
}}
int main() {{
    vector<int> arr({n}, 0);
    for(int i=0; i<{n}; i++) update(arr, i, i + 1);
    cout << query(arr, 5) << endl;
    return 0;
}}
""")
        opt = prog(f"""
class Fenwick {{
    vector<int> tree;
public:
    Fenwick(int n) {{ tree.resize(n + 1, 0); }}
    void update(int idx, int val) {{
        idx++;
        while (idx < (int)tree.size()) {{
            tree[idx] += val;
            idx += idx & -idx;
        }}
    }}
    int query(int idx) {{
        idx++;
        int sum = 0;
        while (idx > 0) {{
            sum += tree[idx];
            idx -= idx & -idx;
        }}
        return sum;
    }}
}};
int main() {{
    Fenwick fen({n});
    for(int i=0; i<{n}; i++) fen.update(i, i + 1);
    cout << fen.query(5) << endl;
    return 0;
}}
""")
        programs.append({"name": f"fenwick_{i:02d}", "category": "algorithmic", "subcategory": "fenwick", "unoptimized": unopt, "optimized": opt})

    # 11. DSU (Disjoint Set Union)
    for i in range(1, 10):
        n = 10 + i
        unopt = prog(f"""
int findParent(const vector<int>& parent, int i) {{
    int curr = i;
    while (parent[curr] != curr) curr = parent[curr];
    return curr;
}}
bool isConnected(const vector<int>& parent, int i, int j) {{
    return findParent(parent, i) == findParent(parent, j);
}}
int main() {{
    vector<int> parent({n});
    for(int i=0; i<{n}; i++) parent[i] = i;
    parent[1] = 0; parent[2] = 1;
    cout << isConnected(parent, 2, 0) << endl;
    return 0;
}}
""")
        opt = prog(f"""
class DSU {{
    vector<int> parent, rank;
public:
    DSU(int n) {{
        parent.resize(n);
        rank.resize(n, 0);
        for (int i = 0; i < n; i++) parent[i] = i;
    }}
    int find(int i) {{
        if (parent[i] != i) parent[i] = find(parent[i]);
        return parent[i];
    }}
    void union_sets(int i, int j) {{
        int root_i = find(i);
        int root_j = find(j);
        if (root_i != root_j) {{
            if (rank[root_i] < rank[root_j]) swap(root_i, root_j);
            parent[root_j] = root_i;
            if (rank[root_i] == rank[root_j]) rank[root_i]++;
        }}
    }}
    bool isConnected(int i, int j) {{
        return find(i) == find(j);
    }}
}};
int main() {{
    DSU dsu({n});
    dsu.union_sets(0, 1); dsu.union_sets(1, 2);
    cout << dsu.isConnected(2, 0) << endl;
    return 0;
}}
""")
        programs.append({"name": f"dsu_{i:02d}", "category": "algorithmic", "subcategory": "dsu", "unoptimized": unopt, "optimized": opt})

    # 12. KMP (Knuth-Morris-Pratt)
    for i in range(1, 10):
        unopt = prog(f"""
int naiveSearch(const string& txt, const string& pat) {{
    int N = txt.length();
    int M = pat.length();
    for (int i = 0; i <= N - M; i++) {{
        int j;
        for (j = 0; j < M; j++) {{
            if (txt[i + j] != pat[j]) break;
        }}
        if (j == M) return i;
    }}
    return -1;
}}
int main() {{
    string txt = "ABABDABACDABABCABAB{i}";
    string pat = "ABABC";
    cout << naiveSearch(txt, pat) << endl;
    return 0;
}}
""")
        opt = prog(f"""
vector<int> computeLPS(const string& pat) {{
    int M = pat.length();
    vector<int> lps(M, 0);
    int len = 0;
    int i = 1;
    while (i < M) {{
        if (pat[i] == pat[len]) {{
            len++;
            lps[i] = len;
            i++;
        }} else {{
            if (len != 0) {{
                len = lps[len - 1];
            }} else {{
                lps[i] = 0;
                i++;
            }}
        }}
    }}
    return lps;
}}
int KMPSearch(const string& txt, const string& pat) {{
    int N = txt.length();
    int M = pat.length();
    vector<int> lps = computeLPS(pat);
    int i = 0, j = 0;
    while (i < N) {{
        if (pat[j] == txt[i]) {{
            j++; i++;
        }}
        if (j == M) return i - j;
        else if (i < N && pat[j] != txt[i]) {{
            if (j != 0) j = lps[j - 1];
            else i++;
        }}
    }}
    return -1;
}}
int main() {{
    string txt = "ABABDABACDABABCABAB{i}";
    string pat = "ABABC";
    cout << KMPSearch(txt, pat) << endl;
    return 0;
}}
""")
        programs.append({"name": f"kmp_{i:02d}", "category": "algorithmic", "subcategory": "kmp", "unoptimized": unopt, "optimized": opt})

    return programs

# ============================================================
# Compiler & Constant Optimizations
# ============================================================

def compile_time_optimizations():
    programs = []

    # 1. Constant Folding & Compile Time Evaluation
    for i in range(1, 10):
        unopt = prog(f"""
int main() {{
    int seconds = 60;
    int minutes = 60;
    int hours = 24;
    int days = 365;
    int total_seconds = seconds * minutes * hours * days * {i};
    cout << total_seconds << endl;
    return 0;
}}
""")
        opt = prog(f"""
int main() {{
    int total_seconds = 31536000 * {i};
    cout << total_seconds << endl;
    return 0;
}}
""")
        programs.append({"name": f"constant_folding_{i:02d}", "category": "compiler", "subcategory": "constant_folding", "unoptimized": unopt, "optimized": opt})

    # 2. Variable & Copy Propagation
    for i in range(1, 10):
        unopt = prog(f"""
int main() {{
    int a = 10;
    int b = a;
    int c = b * 5;
    int d = c + 2;
    cout << d << endl;
    return 0;
}}
""")
        opt = prog(f"""
int main() {{
    int d = 52;
    cout << d << endl;
    return 0;
}}
""")
        programs.append({"name": f"variable_propagation_{i:02d}", "category": "compiler", "subcategory": "variable_propagation", "unoptimized": unopt, "optimized": opt})

    return programs

# ============================================================
# Code Elimination Optimizations
# ============================================================

def elimination_optimizations():
    programs = []

    # 1. Common Sub Expression Elimination
    for i in range(1, 10):
        unopt = prog(f"""
void calculate(int x, int y, int z) {{
    int res1 = (x * y * z) + 10;
    int res2 = (x * y * z) * 20;
    int res3 = (x * y * z) - 5;
    cout << res1 << res2 << res3 << endl;
}}
int main() {{
    calculate({i}, {i+1}, {i+2});
    return 0;
}}
""")
        opt = prog(f"""
void calculate(int x, int y, int z) {{
    int t = x * y * z;
    int res1 = t + 10;
    int res2 = t * 20;
    int res3 = t - 5;
    cout << res1 << res2 << res3 << endl;
}}
int main() {{
    calculate({i}, {i+1}, {i+2});
    return 0;
}}
""")
        programs.append({"name": f"cse_{i:02d}", "category": "elimination", "subcategory": "cse", "unoptimized": unopt, "optimized": opt})

    # 2. Dead Code & Unreachable Code Elimination
    for i in range(1, 10):
        unopt = prog(f"""
int compute() {{
    int a = 10;
    int b = 20;
    int c = a + b; // Dead code
    return 5;
    int d = 100; // Unreachable code
    cout << d << endl;
}}
int main() {{
    cout << compute() << endl;
    return 0;
}}
""")
        opt = prog(f"""
int compute() {{
    return 5;
}}
int main() {{
    cout << compute() << endl;
    return 0;
}}
""")
        programs.append({"name": f"dead_code_{i:02d}", "category": "elimination", "subcategory": "dead_code", "unoptimized": unopt, "optimized": opt})

    return programs

# ============================================================
# Function & Loop Optimizations
# ============================================================

def function_and_loop_optimizations():
    programs = []

    # 1. Function Inlining & Cloning
    for i in range(1, 10):
        unopt = prog(f"""
int add(int a, int b) {{
    return a + b;
}}
int main() {{
    int sum = 0;
    for (int i = 0; i < 1000; i++) {{
        sum = add(sum, i);
    }}
    cout << sum << endl;
    return 0;
}}
""")
        opt = prog(f"""
int main() {{
    int sum = 0;
    for (int i = 0; i < 1000; i++) {{
        sum = sum + i;
    }}
    cout << sum << endl;
    return 0;
}}
""")
        programs.append({"name": f"function_inlining_{i:02d}", "category": "function", "subcategory": "inlining", "unoptimized": unopt, "optimized": opt})

    # 2. Code Motion (Loop Invariant Code Motion)
    for i in range(1, 10):
        unopt = prog(f"""
void compute(vector<int>& arr, int x, int y) {{
    int n = arr.size();
    for (int i = 0; i < n; i++) {{
        arr[i] = arr[i] + (x * y * 100);
    }}
}}
int main() {{
    vector<int> arr(100, 0);
    compute(arr, 5, 2);
    return 0;
}}
""")
        opt = prog(f"""
void compute(vector<int>& arr, int x, int y) {{
    int n = arr.size();
    int invariant = x * y * 100;
    for (int i = 0; i < n; i++) {{
        arr[i] = arr[i] + invariant;
    }}
}}
int main() {{
    vector<int> arr(100, 0);
    compute(arr, 5, 2);
    return 0;
}}
""")
        programs.append({"name": f"code_motion_{i:02d}", "category": "loop", "subcategory": "code_motion", "unoptimized": unopt, "optimized": opt})

    # 3. Loop Jamming (Fusion)
    for i in range(1, 10):
        unopt = prog(f"""
int main() {{
    vector<int> a(100), b(100);
    for (int i = 0; i < 100; i++) {{
        a[i] = i * 2;
    }}
    for (int i = 0; i < 100; i++) {{
        b[i] = i * 3;
    }}
    return 0;
}}
""")
        opt = prog(f"""
int main() {{
    vector<int> a(100), b(100);
    for (int i = 0; i < 100; i++) {{
        a[i] = i * 2;
        b[i] = i * 3;
    }}
    return 0;
}}
""")
        programs.append({"name": f"loop_jamming_{i:02d}", "category": "loop", "subcategory": "loop_jamming", "unoptimized": unopt, "optimized": opt})

    # 4. Loop Unrolling
    for i in range(1, 10):
        unopt = prog(f"""
int main() {{
    int sum = 0;
    for (int i = 0; i < 100; i++) {{
        sum += i;
    }}
    cout << sum << endl;
    return 0;
}}
""")
        opt = prog(f"""
int main() {{
    int sum = 0;
    for (int i = 0; i < 100; i += 4) {{
        sum += i;
        sum += i + 1;
        sum += i + 2;
        sum += i + 3;
    }}
    cout << sum << endl;
    return 0;
}}
""")
        programs.append({"name": f"loop_unrolling_{i:02d}", "category": "loop", "subcategory": "loop_unrolling", "unoptimized": unopt, "optimized": opt})

    # 5. Induction Variable & Strength Reduction
    for i in range(1, 10):
        unopt = prog(f"""
int main() {{
    vector<int> arr(100);
    for (int i = 0; i < 100; i++) {{
        arr[i] = i * 14;
    }}
    return 0;
}}
""")
        opt = prog(f"""
int main() {{
    vector<int> arr(100);
    int val = 0;
    for (int i = 0; i < 100; i++) {{
        arr[i] = val;
        val += 14;
    }}
    return 0;
}}
""")
        programs.append({"name": f"strength_reduction_{i:02d}", "category": "loop", "subcategory": "strength_reduction", "unoptimized": unopt, "optimized": opt})

    return programs

# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    programs = []
    programs.extend(algorithmic_programs())
    programs.extend(compile_time_optimizations())
    programs.extend(elimination_optimizations())
    programs.extend(function_and_loop_optimizations())

    args.out.parent.mkdir(parents=True, exist_ok=True)
    
    with args.out.open("w", encoding="utf-8") as f:
        for p in programs:
            f.write(json.dumps(p) + "\n")
            
    print(f"Generated {len(programs)} paired optimization samples in {args.out}")

if __name__ == "__main__":
    main()
