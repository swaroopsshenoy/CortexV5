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


bool isPrime(int n) {
    if (n < 2) return false;
    for (int i = 2; i * i <= n; i++) if (n % i == 0) return false;
    return true;
}
vector<int> primeFactors(int n) {
    vector<int> factors;
    for (int i = 2; i * i <= n; i++) while (n % i == 0) { factors.push_back(i); n /= i; }
    if (n > 1) factors.push_back(n);
    return factors;
}
int main() {
    int n = 50;
    auto f = primeFactors(n);
    cout << n << " factors: ";
    for (int x : f) cout << x << " ";
    return 0;
}
