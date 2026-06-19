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


class DynArray {
    int* data;
    int sz, cap;
public:
    DynArray() : data(new int[4]), sz(0), cap(4) {}
    void push(int val) {
        if (sz == cap) {
            int* tmp = new int[cap * 2];
            for (int i = 0; i < sz; i++) tmp[i] = data[i];
            delete[] data;
            data = tmp;
            cap *= 2;
        }
        data[sz++] = val;
    }
    void print() { for (int i = 0; i < sz; i++) cout << data[i] << " "; }
    ~DynArray() { delete[] data; }
};
int main() {
    DynArray arr;
    for (int i = 0; i < 20; i++) arr.push(i * 5);
    arr.print();
    return 0;
}
