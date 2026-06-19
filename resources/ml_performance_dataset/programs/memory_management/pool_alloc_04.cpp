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


struct Node { int val; Node* next; };
Node* pool = nullptr;
Node* allocNode(int v) {
    Node* n = new Node();
    n->val = v; n->next = nullptr;
    return n;
}
int main() {
    Node* head = nullptr;
    for (int i = 9; i >= 0; i--) {
        Node* n = allocNode(i);
        n->next = head;
        head = n;
    }
    Node* cur = head;
    while (cur) { cout << cur->val << " "; Node* t = cur; cur = cur->next; delete t; }
    return 0;
}
