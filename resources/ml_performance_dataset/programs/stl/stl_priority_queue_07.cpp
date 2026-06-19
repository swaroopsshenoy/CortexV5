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
    for (int j = 0; j < 22; j++) {
        maxHeap.push(j * 7 % 50);
        minHeap.push(j * 7 % 50);
    }
    cout << "Max: " << maxHeap.top() << " Min: " << minHeap.top() << endl;
    return 0;
}
