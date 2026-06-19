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


int main() {
    priority_queue<int> maxHeap;
    priority_queue<int, vector<int>, greater<int>> minHeap;
    for (int j = 0; j < 12; j++) {
        maxHeap.push(j * 2 % 50);
        minHeap.push(j * 2 % 50);
    }
    cout << "Max: " << maxHeap.top() << " Min: " << minHeap.top() << endl;
    return 0;
}
