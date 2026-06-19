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


struct Node { int key; Node *left, *right; Node(int k) : key(k), left(nullptr), right(nullptr) {} };
Node* insert(Node* root, int key) {
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else root->right = insert(root->right, key);
    return root;
}
void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    cout << root->key << " ";
    inorder(root->right);
}
void freeTree(Node* root) { if (!root) return; freeTree(root->left); freeTree(root->right); delete root; }
int main() {
    Node* root = nullptr;
    for (int k : {25, 13, 1, 19, 7, 25, 13}) root = insert(root, k);
    inorder(root);
    freeTree(root);
    return 0;
}
