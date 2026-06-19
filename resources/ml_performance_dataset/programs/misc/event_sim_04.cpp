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


struct Event { int time, id; bool operator>(const Event& o) const { return time > o.time; } };
int main() {
    priority_queue<Event, vector<Event>, greater<Event>> pq;
    for (int i = 0; i < 13; i++) pq.push({(i * 4 * 7) % 100, i});
    int lastTime = -1;
    while (!pq.empty()) {
        auto e = pq.top(); pq.pop();
        if (e.time < lastTime) { cout << "ERROR: out of order!" << endl; return 1; }
        lastTime = e.time;
        cout << "t=" << e.time << " id=" << e.id << endl;
    }
    return 0;
}
