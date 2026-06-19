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


struct Node { int val; Node *l, *r; Node(int v) : val(v), l(nullptr), r(nullptr) {} };
int height(Node* n) { return n ? 1 + max(height(n->l), height(n->r)) : 0; }
int leafCount(Node* n) { if (!n) return 0; if (!n->l && !n->r) return 1; return leafCount(n->l) + leafCount(n->r); }
void postorder(Node* n) { if (!n) return; postorder(n->l); postorder(n->r); cout << n->val << " "; }
void freeTree(Node* n) { if (!n) return; freeTree(n->l); freeTree(n->r); delete n; }
int main() {
    Node* root = new Node(8);
    root->l = new Node(9); root->r = new Node(10);
    root->l->l = new Node(11); root->l->r = new Node(12);
    root->r->l = new Node(13);
    postorder(root);
    cout << endl << "Height: " << height(root) << " Leaves: " << leafCount(root);
    freeTree(root);
    return 0;
}
