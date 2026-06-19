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


vector<int> sieve(int n) {
    vector<bool> is_prime(n + 1, true);
    vector<int> primes;
    is_prime[0] = is_prime[1] = false;
    for (int i = 2; i <= n; i++) {
        if (is_prime[i]) {
            primes.push_back(i);
            for (long long j = (long long)i * i; j <= n; j += i) is_prime[j] = false;
        }
    }
    return primes;
}
int main() {
    auto p = sieve(130);
    cout << p.size() << " primes. Last: " << p.back() << endl;
    return 0;
}
