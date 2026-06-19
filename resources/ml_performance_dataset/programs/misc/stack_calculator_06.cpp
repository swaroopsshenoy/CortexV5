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


int evaluate(const string& expr) {
    stack<int> vals;
    stack<char> ops;
    auto applyOp = [&]() {
        int b = vals.top(); vals.pop();
        int a = vals.top(); vals.pop();
        char op = ops.top(); ops.pop();
        if (op == '+') vals.push(a + b);
        else if (op == '-') vals.push(a - b);
        else if (op == '*') vals.push(a * b);
    };
    for (int i = 0; i < (int)expr.size(); i++) {
        if (isdigit(expr[i])) {
            int num = 0;
            while (i < (int)expr.size() && isdigit(expr[i])) num = num * 10 + (expr[i++] - '0');
            i--;
            vals.push(num);
        } else if (expr[i] == '+' || expr[i] == '-') {
            while (!ops.empty()) applyOp();
            ops.push(expr[i]);
        } else if (expr[i] == '*') ops.push(expr[i]);
    }
    while (!ops.empty()) applyOp();
    return vals.top();
}
int main() {
    cout << evaluate("18+12*7") << endl;
    return 0;
}
