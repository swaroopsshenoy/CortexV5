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


#include <memory>
struct Resource {
    int id;
    Resource(int id) : id(id) { }
    ~Resource() { }
};
int main() {
    vector<unique_ptr<Resource>> resources;
    for (int i = 0; i < 9; i++) resources.push_back(make_unique<Resource>(i * 2));
    for (auto& r : resources) cout << r->id << " ";
    return 0;
}
