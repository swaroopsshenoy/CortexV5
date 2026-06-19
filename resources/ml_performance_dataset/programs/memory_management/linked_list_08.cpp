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


struct Node { int data; Node* next; Node(int d) : data(d), next(nullptr) {} };
class LinkedList {
    Node* head;
public:
    LinkedList() : head(nullptr) {}
    void push(int val) { Node* n = new Node(val); n->next = head; head = n; }
    void print() { for (Node* p = head; p; p = p->next) cout << p->data << " "; }
    ~LinkedList() { while (head) { Node* t = head; head = head->next; delete t; } }
};
int main() {
    LinkedList ll;
    for (int i = 0; i < 21; i++) ll.push(i * 8);
    ll.print();
    return 0;
}
