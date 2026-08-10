/**
 * Context-aware C++ completion provider for Monaco Editor.
 *
 * Provides:
 *  1. User-defined symbol extraction (variables, functions, classes, etc.)
 *  2. Library-aware completions based on #include headers
 *  3. Member/method suggestions after '.', '->', '::'
 *  4. Scope-aware filtering (only symbols visible at cursor)
 */

// ---------------------------------------------------------------------------
// Static snippet completions (moved from CppEditor.jsx)
// ---------------------------------------------------------------------------

export const SNIPPET_ITEMS = [
  {
    label: "std::vector",
    insertText: "std::vector<${1:int}> ${2:name};",
    documentation: "STL dynamic array",
    kind: "Class"
  },
  {
    label: "std::string",
    insertText: 'std::string ${1:name} = "${2:value}";',
    documentation: "Standard string",
    kind: "Class"
  },
  {
    label: "std::map",
    insertText: "std::map<${1:Key}, ${2:Value}> ${3:name};",
    documentation: "STL ordered map",
    kind: "Class"
  },
  {
    label: "fori",
    insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t$0\n}",
    documentation: "Index-based loop",
    kind: "Snippet"
  },
  {
    label: "forrange",
    insertText: "for (auto& ${1:item} : ${2:collection}) {\n\t$0\n}",
    documentation: "Range-based for loop",
    kind: "Snippet"
  },
  {
    label: "cout",
    insertText: "std::cout << ${1:value} << std::endl;",
    documentation: "Standard output",
    kind: "Function"
  },
  {
    label: "main",
    insertText: "int main() {\n\t$0\n\treturn 0;\n}",
    documentation: "Main function",
    kind: "Snippet"
  },
  {
    label: "class",
    insertText:
      "class ${1:Name} {\npublic:\n\t${1:Name}();\n\t~${1:Name}();\n\nprivate:\n\t$0\n};",
    documentation: "Class declaration",
    kind: "Snippet"
  },
  {
    label: "if",
    insertText: "if (${1:condition}) {\n\t$0\n}",
    documentation: "If statement",
    kind: "Snippet"
  },
  {
    label: "ifelse",
    insertText:
      "if (${1:condition}) {\n\t$2\n} else if (${3:condition}) {\n\t$4\n} else {\n\t$0\n}",
    documentation: "If-else ladder",
    kind: "Snippet"
  },
  {
    label: "while",
    insertText: "while (${1:condition}) {\n\t$0\n}",
    documentation: "While loop",
    kind: "Snippet"
  },
  {
    label: "dowhile",
    insertText: "do {\n\t$0\n} while (${1:condition});",
    documentation: "Do-while loop",
    kind: "Snippet"
  }
];

// ---------------------------------------------------------------------------
// Header → symbol map (common C++ standard library APIs)
// ---------------------------------------------------------------------------

const HEADER_SYMBOLS = {
  iostream: [
    { label: "std::cout", detail: "Standard output stream", kind: "Variable" },
    { label: "std::cin", detail: "Standard input stream", kind: "Variable" },
    { label: "std::cerr", detail: "Standard error stream", kind: "Variable" },
    { label: "std::clog", detail: "Standard log stream", kind: "Variable" },
    { label: "std::endl", detail: "End-of-line flush", kind: "Variable" },
    { label: "std::getline", detail: "Read line from stream", kind: "Function" }
  ],
  vector: [
    { label: "std::vector", detail: "Dynamic array container", kind: "Class" }
  ],
  string: [
    { label: "std::string", detail: "String class", kind: "Class" },
    { label: "std::to_string", detail: "Convert to string", kind: "Function" },
    { label: "std::stoi", detail: "String to int", kind: "Function" },
    { label: "std::stol", detail: "String to long", kind: "Function" },
    { label: "std::stod", detail: "String to double", kind: "Function" }
  ],
  map: [
    { label: "std::map", detail: "Ordered associative container", kind: "Class" }
  ],
  unordered_map: [
    { label: "std::unordered_map", detail: "Hash map container", kind: "Class" }
  ],
  set: [
    { label: "std::set", detail: "Ordered set container", kind: "Class" }
  ],
  unordered_set: [
    { label: "std::unordered_set", detail: "Hash set container", kind: "Class" }
  ],
  algorithm: [
    { label: "std::sort", detail: "Sort range", kind: "Function" },
    { label: "std::find", detail: "Find element in range", kind: "Function" },
    { label: "std::binary_search", detail: "Binary search on sorted range", kind: "Function" },
    { label: "std::lower_bound", detail: "Lower bound in sorted range", kind: "Function" },
    { label: "std::upper_bound", detail: "Upper bound in sorted range", kind: "Function" },
    { label: "std::min", detail: "Minimum of values", kind: "Function" },
    { label: "std::max", detail: "Maximum of values", kind: "Function" },
    { label: "std::min_element", detail: "Iterator to minimum", kind: "Function" },
    { label: "std::max_element", detail: "Iterator to maximum", kind: "Function" },
    { label: "std::reverse", detail: "Reverse range", kind: "Function" },
    { label: "std::unique", detail: "Remove consecutive duplicates", kind: "Function" },
    { label: "std::count", detail: "Count occurrences", kind: "Function" },
    { label: "std::for_each", detail: "Apply function to range", kind: "Function" },
    { label: "std::transform", detail: "Transform range", kind: "Function" },
    { label: "std::copy", detail: "Copy range", kind: "Function" },
    { label: "std::fill", detail: "Fill range with value", kind: "Function" },
    { label: "std::swap", detail: "Swap two values", kind: "Function" },
    { label: "std::next_permutation", detail: "Next permutation", kind: "Function" }
  ],
  numeric: [
    { label: "std::accumulate", detail: "Accumulate values in range", kind: "Function" },
    { label: "std::iota", detail: "Fill with incrementing values", kind: "Function" },
    { label: "std::inner_product", detail: "Inner product of ranges", kind: "Function" },
    { label: "std::partial_sum", detail: "Partial sums of range", kind: "Function" },
    { label: "std::gcd", detail: "Greatest common divisor (C++17)", kind: "Function" },
    { label: "std::lcm", detail: "Least common multiple (C++17)", kind: "Function" }
  ],
  stack: [
    { label: "std::stack", detail: "LIFO container adapter", kind: "Class" }
  ],
  queue: [
    { label: "std::queue", detail: "FIFO container adapter", kind: "Class" },
    { label: "std::priority_queue", detail: "Priority queue adapter", kind: "Class" }
  ],
  deque: [
    { label: "std::deque", detail: "Double-ended queue", kind: "Class" }
  ],
  list: [
    { label: "std::list", detail: "Doubly-linked list", kind: "Class" }
  ],
  array: [
    { label: "std::array", detail: "Fixed-size array", kind: "Class" }
  ],
  fstream: [
    { label: "std::ifstream", detail: "Input file stream", kind: "Class" },
    { label: "std::ofstream", detail: "Output file stream", kind: "Class" },
    { label: "std::fstream", detail: "File stream", kind: "Class" }
  ],
  sstream: [
    { label: "std::stringstream", detail: "String stream", kind: "Class" },
    { label: "std::istringstream", detail: "Input string stream", kind: "Class" },
    { label: "std::ostringstream", detail: "Output string stream", kind: "Class" }
  ],
  cmath: [
    { label: "abs", detail: "Absolute value", kind: "Function" },
    { label: "sqrt", detail: "Square root", kind: "Function" },
    { label: "pow", detail: "Power", kind: "Function" },
    { label: "ceil", detail: "Ceiling", kind: "Function" },
    { label: "floor", detail: "Floor", kind: "Function" },
    { label: "round", detail: "Round", kind: "Function" },
    { label: "log", detail: "Natural logarithm", kind: "Function" },
    { label: "log2", detail: "Base-2 logarithm", kind: "Function" },
    { label: "log10", detail: "Base-10 logarithm", kind: "Function" },
    { label: "sin", detail: "Sine", kind: "Function" },
    { label: "cos", detail: "Cosine", kind: "Function" },
    { label: "tan", detail: "Tangent", kind: "Function" },
    { label: "atan2", detail: "Two-argument arctangent", kind: "Function" },
    { label: "fmod", detail: "Floating-point remainder", kind: "Function" }
  ],
  cstdlib: [
    { label: "atoi", detail: "String to int (C-style)", kind: "Function" },
    { label: "atof", detail: "String to float (C-style)", kind: "Function" },
    { label: "rand", detail: "Random number", kind: "Function" },
    { label: "srand", detail: "Seed random", kind: "Function" },
    { label: "malloc", detail: "Allocate memory", kind: "Function" },
    { label: "free", detail: "Free memory", kind: "Function" },
    { label: "exit", detail: "Terminate program", kind: "Function" },
    { label: "system", detail: "Execute system command", kind: "Function" }
  ],
  memory: [
    { label: "std::unique_ptr", detail: "Unique ownership smart pointer", kind: "Class" },
    { label: "std::shared_ptr", detail: "Shared ownership smart pointer", kind: "Class" },
    { label: "std::weak_ptr", detail: "Non-owning smart pointer", kind: "Class" },
    { label: "std::make_unique", detail: "Create unique_ptr", kind: "Function" },
    { label: "std::make_shared", detail: "Create shared_ptr", kind: "Function" }
  ],
  functional: [
    { label: "std::function", detail: "Callable wrapper", kind: "Class" },
    { label: "std::bind", detail: "Bind arguments to callable", kind: "Function" },
    { label: "std::ref", detail: "Reference wrapper", kind: "Function" },
    { label: "std::cref", detail: "Const reference wrapper", kind: "Function" }
  ],
  utility: [
    { label: "std::pair", detail: "Pair of values", kind: "Class" },
    { label: "std::make_pair", detail: "Create pair", kind: "Function" },
    { label: "std::move", detail: "Move semantics cast", kind: "Function" },
    { label: "std::forward", detail: "Perfect forwarding", kind: "Function" }
  ],
  tuple: [
    { label: "std::tuple", detail: "Tuple container", kind: "Class" },
    { label: "std::make_tuple", detail: "Create tuple", kind: "Function" },
    { label: "std::get", detail: "Access tuple element", kind: "Function" },
    { label: "std::tie", detail: "Unpack tuple", kind: "Function" }
  ],
  bitset: [
    { label: "std::bitset", detail: "Fixed-size bit array", kind: "Class" }
  ],
  regex: [
    { label: "std::regex", detail: "Regular expression", kind: "Class" },
    { label: "std::smatch", detail: "String match results", kind: "Class" },
    { label: "std::regex_search", detail: "Search for regex match", kind: "Function" },
    { label: "std::regex_match", detail: "Full regex match", kind: "Function" },
    { label: "std::regex_replace", detail: "Replace regex matches", kind: "Function" }
  ],
  climits: [
    { label: "INT_MAX", detail: "Maximum int value", kind: "Constant" },
    { label: "INT_MIN", detail: "Minimum int value", kind: "Constant" },
    { label: "LONG_MAX", detail: "Maximum long value", kind: "Constant" },
    { label: "LONG_MIN", detail: "Minimum long value", kind: "Constant" },
    { label: "LLONG_MAX", detail: "Maximum long long value", kind: "Constant" },
    { label: "LLONG_MIN", detail: "Minimum long long value", kind: "Constant" }
  ],
  limits: [
    { label: "std::numeric_limits", detail: "Numeric type limits", kind: "Class" }
  ],
  cassert: [
    { label: "assert", detail: "Runtime assertion macro", kind: "Function" }
  ],
  cstring: [
    { label: "strlen", detail: "String length (C-style)", kind: "Function" },
    { label: "strcpy", detail: "Copy string (C-style)", kind: "Function" },
    { label: "strcat", detail: "Concatenate strings (C-style)", kind: "Function" },
    { label: "strcmp", detail: "Compare strings (C-style)", kind: "Function" },
    { label: "memset", detail: "Fill memory block", kind: "Function" },
    { label: "memcpy", detail: "Copy memory block", kind: "Function" }
  ],
  thread: [
    { label: "std::thread", detail: "Thread class", kind: "Class" },
    { label: "std::this_thread::sleep_for", detail: "Sleep current thread", kind: "Function" }
  ],
  mutex: [
    { label: "std::mutex", detail: "Mutual exclusion", kind: "Class" },
    { label: "std::lock_guard", detail: "Scoped lock", kind: "Class" },
    { label: "std::unique_lock", detail: "Flexible lock", kind: "Class" }
  ],
  chrono: [
    { label: "std::chrono::steady_clock", detail: "Monotonic clock", kind: "Class" },
    { label: "std::chrono::system_clock", detail: "System clock", kind: "Class" },
    { label: "std::chrono::high_resolution_clock", detail: "High-res clock", kind: "Class" },
    { label: "std::chrono::milliseconds", detail: "Milliseconds duration", kind: "Class" },
    { label: "std::chrono::seconds", detail: "Seconds duration", kind: "Class" },
    { label: "std::chrono::duration_cast", detail: "Cast between durations", kind: "Function" }
  ]
};

// ---------------------------------------------------------------------------
// Member methods for common container / class types
// ---------------------------------------------------------------------------

const TYPE_MEMBERS = {
  vector: [
    { label: "push_back", detail: "Add element to end", kind: "Method" },
    { label: "emplace_back", detail: "Construct element at end", kind: "Method" },
    { label: "pop_back", detail: "Remove last element", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "clear", detail: "Remove all elements", kind: "Method" },
    { label: "at", detail: "Access element with bounds check", kind: "Method" },
    { label: "front", detail: "First element", kind: "Method" },
    { label: "back", detail: "Last element", kind: "Method" },
    { label: "begin", detail: "Iterator to beginning", kind: "Method" },
    { label: "end", detail: "Iterator to end", kind: "Method" },
    { label: "rbegin", detail: "Reverse iterator to beginning", kind: "Method" },
    { label: "rend", detail: "Reverse iterator to end", kind: "Method" },
    { label: "resize", detail: "Change number of elements", kind: "Method" },
    { label: "reserve", detail: "Reserve capacity", kind: "Method" },
    { label: "capacity", detail: "Current capacity", kind: "Method" },
    { label: "shrink_to_fit", detail: "Reduce capacity to size", kind: "Method" },
    { label: "insert", detail: "Insert element", kind: "Method" },
    { label: "erase", detail: "Remove element(s)", kind: "Method" },
    { label: "data", detail: "Pointer to underlying array", kind: "Method" },
    { label: "swap", detail: "Swap contents", kind: "Method" }
  ],
  string: [
    { label: "length", detail: "String length", kind: "Method" },
    { label: "size", detail: "String size", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "clear", detail: "Clear string", kind: "Method" },
    { label: "substr", detail: "Get substring", kind: "Method" },
    { label: "find", detail: "Find substring", kind: "Method" },
    { label: "rfind", detail: "Find last occurrence", kind: "Method" },
    { label: "append", detail: "Append to string", kind: "Method" },
    { label: "insert", detail: "Insert into string", kind: "Method" },
    { label: "erase", detail: "Erase from string", kind: "Method" },
    { label: "replace", detail: "Replace portion", kind: "Method" },
    { label: "c_str", detail: "C-style string pointer", kind: "Method" },
    { label: "data", detail: "Pointer to data", kind: "Method" },
    { label: "compare", detail: "Compare strings", kind: "Method" },
    { label: "at", detail: "Character at position", kind: "Method" },
    { label: "front", detail: "First character", kind: "Method" },
    { label: "back", detail: "Last character", kind: "Method" },
    { label: "push_back", detail: "Append character", kind: "Method" },
    { label: "pop_back", detail: "Remove last character", kind: "Method" },
    { label: "begin", detail: "Iterator to beginning", kind: "Method" },
    { label: "end", detail: "Iterator to end", kind: "Method" },
    { label: "starts_with", detail: "Check prefix (C++20)", kind: "Method" },
    { label: "ends_with", detail: "Check suffix (C++20)", kind: "Method" }
  ],
  map: [
    { label: "insert", detail: "Insert key-value pair", kind: "Method" },
    { label: "emplace", detail: "Construct element in-place", kind: "Method" },
    { label: "find", detail: "Find element by key", kind: "Method" },
    { label: "count", detail: "Count elements with key", kind: "Method" },
    { label: "erase", detail: "Remove element", kind: "Method" },
    { label: "at", detail: "Access element with bounds check", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "clear", detail: "Remove all elements", kind: "Method" },
    { label: "begin", detail: "Iterator to beginning", kind: "Method" },
    { label: "end", detail: "Iterator to end", kind: "Method" },
    { label: "contains", detail: "Check if key exists (C++20)", kind: "Method" },
    { label: "lower_bound", detail: "Iterator to lower bound", kind: "Method" },
    { label: "upper_bound", detail: "Iterator to upper bound", kind: "Method" }
  ],
  unordered_map: [
    { label: "insert", detail: "Insert key-value pair", kind: "Method" },
    { label: "emplace", detail: "Construct element in-place", kind: "Method" },
    { label: "find", detail: "Find element by key", kind: "Method" },
    { label: "count", detail: "Count elements with key", kind: "Method" },
    { label: "erase", detail: "Remove element", kind: "Method" },
    { label: "at", detail: "Access element with bounds check", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "clear", detail: "Remove all elements", kind: "Method" },
    { label: "begin", detail: "Iterator to beginning", kind: "Method" },
    { label: "end", detail: "Iterator to end", kind: "Method" },
    { label: "contains", detail: "Check if key exists (C++20)", kind: "Method" },
    { label: "bucket_count", detail: "Number of buckets", kind: "Method" }
  ],
  set: [
    { label: "insert", detail: "Insert element", kind: "Method" },
    { label: "emplace", detail: "Construct element in-place", kind: "Method" },
    { label: "find", detail: "Find element", kind: "Method" },
    { label: "count", detail: "Count occurrences", kind: "Method" },
    { label: "erase", detail: "Remove element", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "clear", detail: "Remove all elements", kind: "Method" },
    { label: "begin", detail: "Iterator to beginning", kind: "Method" },
    { label: "end", detail: "Iterator to end", kind: "Method" },
    { label: "contains", detail: "Check if element exists (C++20)", kind: "Method" },
    { label: "lower_bound", detail: "Iterator to lower bound", kind: "Method" },
    { label: "upper_bound", detail: "Iterator to upper bound", kind: "Method" }
  ],
  unordered_set: [
    { label: "insert", detail: "Insert element", kind: "Method" },
    { label: "emplace", detail: "Construct element in-place", kind: "Method" },
    { label: "find", detail: "Find element", kind: "Method" },
    { label: "count", detail: "Count occurrences", kind: "Method" },
    { label: "erase", detail: "Remove element", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "clear", detail: "Remove all elements", kind: "Method" },
    { label: "begin", detail: "Iterator to beginning", kind: "Method" },
    { label: "end", detail: "Iterator to end", kind: "Method" },
    { label: "contains", detail: "Check if element exists (C++20)", kind: "Method" }
  ],
  stack: [
    { label: "push", detail: "Push element", kind: "Method" },
    { label: "pop", detail: "Remove top element", kind: "Method" },
    { label: "top", detail: "Access top element", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "emplace", detail: "Construct element on top", kind: "Method" }
  ],
  queue: [
    { label: "push", detail: "Push element", kind: "Method" },
    { label: "pop", detail: "Remove front element", kind: "Method" },
    { label: "front", detail: "Access front element", kind: "Method" },
    { label: "back", detail: "Access back element", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "emplace", detail: "Construct element at back", kind: "Method" }
  ],
  priority_queue: [
    { label: "push", detail: "Push element", kind: "Method" },
    { label: "pop", detail: "Remove top element", kind: "Method" },
    { label: "top", detail: "Access top element", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "emplace", detail: "Construct element", kind: "Method" }
  ],
  deque: [
    { label: "push_back", detail: "Add to back", kind: "Method" },
    { label: "push_front", detail: "Add to front", kind: "Method" },
    { label: "pop_back", detail: "Remove from back", kind: "Method" },
    { label: "pop_front", detail: "Remove from front", kind: "Method" },
    { label: "front", detail: "First element", kind: "Method" },
    { label: "back", detail: "Last element", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "clear", detail: "Remove all elements", kind: "Method" },
    { label: "at", detail: "Access element with bounds check", kind: "Method" },
    { label: "begin", detail: "Iterator to beginning", kind: "Method" },
    { label: "end", detail: "Iterator to end", kind: "Method" }
  ],
  list: [
    { label: "push_back", detail: "Add to back", kind: "Method" },
    { label: "push_front", detail: "Add to front", kind: "Method" },
    { label: "pop_back", detail: "Remove from back", kind: "Method" },
    { label: "pop_front", detail: "Remove from front", kind: "Method" },
    { label: "front", detail: "First element", kind: "Method" },
    { label: "back", detail: "Last element", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "clear", detail: "Remove all elements", kind: "Method" },
    { label: "sort", detail: "Sort elements", kind: "Method" },
    { label: "reverse", detail: "Reverse elements", kind: "Method" },
    { label: "unique", detail: "Remove consecutive duplicates", kind: "Method" },
    { label: "merge", detail: "Merge sorted lists", kind: "Method" },
    { label: "splice", detail: "Move elements from another list", kind: "Method" },
    { label: "begin", detail: "Iterator to beginning", kind: "Method" },
    { label: "end", detail: "Iterator to end", kind: "Method" }
  ],
  array: [
    { label: "at", detail: "Access element with bounds check", kind: "Method" },
    { label: "front", detail: "First element", kind: "Method" },
    { label: "back", detail: "Last element", kind: "Method" },
    { label: "size", detail: "Number of elements", kind: "Method" },
    { label: "empty", detail: "Check if empty", kind: "Method" },
    { label: "fill", detail: "Fill with value", kind: "Method" },
    { label: "data", detail: "Pointer to underlying array", kind: "Method" },
    { label: "begin", detail: "Iterator to beginning", kind: "Method" },
    { label: "end", detail: "Iterator to end", kind: "Method" }
  ],
  pair: [
    { label: "first", detail: "First element", kind: "Field" },
    { label: "second", detail: "Second element", kind: "Field" }
  ],
  unique_ptr: [
    { label: "get", detail: "Get raw pointer", kind: "Method" },
    { label: "reset", detail: "Reset ownership", kind: "Method" },
    { label: "release", detail: "Release ownership", kind: "Method" },
    { label: "swap", detail: "Swap contents", kind: "Method" }
  ],
  shared_ptr: [
    { label: "get", detail: "Get raw pointer", kind: "Method" },
    { label: "reset", detail: "Reset ownership", kind: "Method" },
    { label: "use_count", detail: "Reference count", kind: "Method" },
    { label: "unique", detail: "Check if sole owner", kind: "Method" },
    { label: "swap", detail: "Swap contents", kind: "Method" }
  ]
};

// Aliases — many types share method sets
TYPE_MEMBERS["basic_string"] = TYPE_MEMBERS["string"];

// ---------------------------------------------------------------------------
// Type name normalization map (maps common written forms to TYPE_MEMBERS keys)
// ---------------------------------------------------------------------------

const TYPE_ALIASES = {
  "std::vector": "vector",
  "vector": "vector",
  "std::string": "string",
  "string": "string",
  "std::map": "map",
  "map": "map",
  "std::unordered_map": "unordered_map",
  "unordered_map": "unordered_map",
  "std::set": "set",
  "set": "set",
  "std::unordered_set": "unordered_set",
  "unordered_set": "unordered_set",
  "std::stack": "stack",
  "stack": "stack",
  "std::queue": "queue",
  "queue": "queue",
  "std::priority_queue": "priority_queue",
  "priority_queue": "priority_queue",
  "std::deque": "deque",
  "deque": "deque",
  "std::list": "list",
  "list": "list",
  "std::array": "array",
  "array": "array",
  "std::pair": "pair",
  "pair": "pair",
  "std::unique_ptr": "unique_ptr",
  "unique_ptr": "unique_ptr",
  "std::shared_ptr": "shared_ptr",
  "shared_ptr": "shared_ptr"
};

// ---------------------------------------------------------------------------
// 1. Extract user-defined symbols
// ---------------------------------------------------------------------------

/**
 * Parse the editor text and return user-defined symbols with their scope info.
 * Each symbol: { name, kind, detail, line, scopeDepth }
 */
export function extractUserSymbols(text) {
  const lines = text.split("\n");
  const symbols = [];
  const seen = new Set();
  let scopeDepth = 0;

  // Track scope depth per line
  const lineScopes = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Count braces for scope depth (simplistic but effective)
    for (const ch of line) {
      if (ch === "{") scopeDepth++;
      if (ch === "}") scopeDepth = Math.max(0, scopeDepth - 1);
    }
    lineScopes.push(scopeDepth);

    const trimmed = line.trim();

    // Skip preprocessor directives, comments, empty lines
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }

    // --- Function declarations/definitions ---
    // Matches: type name(...) or type name(...)  {
    const funcMatch = trimmed.match(
      /^(?:(?:static|inline|virtual|explicit|constexpr|const|unsigned|signed|long|short)\s+)*(\w[\w:*&<>, ]*?)\s+(\w+)\s*\(([^)]*)\)\s*(?:const)?\s*(?:\{|;|$)/
    );
    if (funcMatch && !["if", "else", "while", "for", "switch", "return", "catch", "do"].includes(funcMatch[2])) {
      const funcName = funcMatch[2];
      const returnType = funcMatch[1].trim();
      const params = funcMatch[3].trim();
      if (!seen.has(`func:${funcName}`)) {
        seen.add(`func:${funcName}`);
        symbols.push({
          name: funcName,
          kind: "Function",
          detail: `${returnType} ${funcName}(${params})`,
          line: i + 1,
          scopeDepth: lineScopes[i]
        });
      }
      // Also extract parameter names as variables
      if (params) {
        const paramParts = params.split(",");
        for (const part of paramParts) {
          const paramMatch = part.trim().match(/(\w+)\s*(?:=[^,]*)?$/);
          if (paramMatch) {
            const paramName = paramMatch[1];
            if (!seen.has(`var:${paramName}:${i}`) && paramName.length > 1) {
              seen.add(`var:${paramName}:${i}`);
              symbols.push({
                name: paramName,
                kind: "Variable",
                detail: `parameter of ${funcName}`,
                line: i + 1,
                scopeDepth: lineScopes[i] + 1 // parameters are in function scope
              });
            }
          }
        }
      }
      continue;
    }

    // --- Class / struct declarations ---
    const classMatch = trimmed.match(/^(?:class|struct)\s+(\w+)/);
    if (classMatch) {
      const className = classMatch[1];
      if (!seen.has(`class:${className}`)) {
        seen.add(`class:${className}`);
        symbols.push({
          name: className,
          kind: "Class",
          detail: trimmed.includes("struct") ? `struct ${className}` : `class ${className}`,
          line: i + 1,
          scopeDepth: lineScopes[i]
        });
      }
      continue;
    }

    // --- Enum declarations ---
    const enumMatch = trimmed.match(/^enum\s+(?:class\s+)?(\w+)/);
    if (enumMatch) {
      const enumName = enumMatch[1];
      if (!seen.has(`enum:${enumName}`)) {
        seen.add(`enum:${enumName}`);
        symbols.push({
          name: enumName,
          kind: "Enum",
          detail: `enum ${enumName}`,
          line: i + 1,
          scopeDepth: lineScopes[i]
        });
      }
      continue;
    }

    // --- Typedef / using ---
    const typedefMatch = trimmed.match(/^(?:typedef\s+.+\s+(\w+)\s*;|using\s+(\w+)\s*=)/);
    if (typedefMatch) {
      const aliasName = typedefMatch[1] || typedefMatch[2];
      if (aliasName && !seen.has(`typedef:${aliasName}`)) {
        seen.add(`typedef:${aliasName}`);
        symbols.push({
          name: aliasName,
          kind: "Interface",
          detail: trimmed.replace(/;$/, ""),
          line: i + 1,
          scopeDepth: lineScopes[i]
        });
      }
      continue;
    }

    // --- #define macros ---
    const defineMatch = trimmed.match(/^#define\s+(\w+)/);
    if (defineMatch) {
      const macroName = defineMatch[1];
      if (!seen.has(`define:${macroName}`)) {
        seen.add(`define:${macroName}`);
        symbols.push({
          name: macroName,
          kind: "Constant",
          detail: trimmed,
          line: i + 1,
          scopeDepth: 0
        });
      }
      continue;
    }

    // --- Variable declarations ---
    // Matches common patterns like: int x, auto y = ..., std::vector<int> v, const int& ref = ...
    const varMatch = trimmed.match(
      /^(?:(?:static|const|constexpr|volatile|mutable|unsigned|signed|long|short|auto)\s+)*(?:(\w[\w:]*(?:<[^>]*>)?(?:\s*[*&])*)\s+)(\w+)\s*(?:[\[({=;,]|$)/
    );
    if (varMatch) {
      const varType = varMatch[1]?.trim();
      const varName = varMatch[2];
      // Filter out common false-positive keywords
      const keywords = new Set([
        "return", "if", "else", "while", "for", "switch", "case", "break",
        "continue", "class", "struct", "enum", "namespace", "public",
        "private", "protected", "virtual", "override", "delete", "new",
        "template", "typename", "throw", "try", "catch", "do", "goto",
        "include", "define", "ifndef", "endif", "ifdef", "pragma"
      ]);
      if (varName && !keywords.has(varName) && varName.length > 1 && !seen.has(`var:${varName}:scope${lineScopes[i]}`)) {
        seen.add(`var:${varName}:scope${lineScopes[i]}`);
        symbols.push({
          name: varName,
          kind: "Variable",
          detail: varType ? `${varType} ${varName}` : varName,
          type: varType || null,
          line: i + 1,
          scopeDepth: lineScopes[i]
        });
      }
    }
  }

  return symbols;
}

// ---------------------------------------------------------------------------
// 2. Extract included headers
// ---------------------------------------------------------------------------

export function getIncludedHeaders(text) {
  const headers = new Set();
  const regex = /#include\s*[<"]([^>"]+)[>"]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    // Normalize: remove path prefix and extension
    let header = match[1];
    // Handle paths like "bits/stdc++.h"
    if (header === "bits/stdc++.h") {
      // This header includes everything
      for (const key of Object.keys(HEADER_SYMBOLS)) {
        headers.add(key);
      }
      continue;
    }
    // Strip any path and extension
    const baseName = header.split("/").pop().replace(/\.h$/, "");
    headers.add(baseName);
  }
  return headers;
}

// ---------------------------------------------------------------------------
// 3. Resolve variable type for member suggestions
// ---------------------------------------------------------------------------

function resolveVariableType(variableName, text, cursorLine) {
  const lines = text.split("\n");
  const searchEnd = Math.min(cursorLine, lines.length);

  for (let i = searchEnd - 1; i >= 0; i--) {
    const line = lines[i].trim();

    // Match: std::vector<int> varName or vector<int> varName
    const templateMatch = line.match(
      new RegExp(`(?:std::)?(\\w+)<[^>]*>\\s*[*&]*\\s*${escapeRegex(variableName)}\\b`)
    );
    if (templateMatch) {
      return TYPE_ALIASES[templateMatch[1]] || TYPE_ALIASES[`std::${templateMatch[1]}`] || templateMatch[1];
    }

    // Match: std::string varName or string varName
    const simpleMatch = line.match(
      new RegExp(`((?:std::)?\\w+)\\s+[*&]*\\s*${escapeRegex(variableName)}\\b`)
    );
    if (simpleMatch) {
      const typeName = simpleMatch[1].trim();
      return TYPE_ALIASES[typeName] || typeName;
    }

    // Match: auto varName = someExpr; — try to infer from common patterns
    const autoMatch = line.match(
      new RegExp(`auto\\s+[&*]*\\s*${escapeRegex(variableName)}\\s*=\\s*(.+)`)
    );
    if (autoMatch) {
      const rhs = autoMatch[1].trim();
      // std::make_pair(...) → pair
      if (rhs.includes("make_pair")) return "pair";
      if (rhs.includes("make_tuple")) return "tuple";
      if (rhs.includes("make_unique")) return "unique_ptr";
      if (rhs.includes("make_shared")) return "shared_ptr";
      // "text" → string
      if (/^"/.test(rhs)) return "string";
    }
  }
  return null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// 4. Scope-aware filtering
// ---------------------------------------------------------------------------

/**
 * Given cursor line number (1-indexed), return the scope depth at cursor and
 * filter symbols to only those visible from the cursor position.
 */
function filterByScope(symbols, text, cursorLine) {
  const lines = text.split("\n");
  let scopeDepth = 0;
  const scopeStack = []; // track { depth, startLine }

  for (let i = 0; i < Math.min(cursorLine, lines.length); i++) {
    for (const ch of lines[i]) {
      if (ch === "{") {
        scopeDepth++;
        scopeStack.push({ depth: scopeDepth, startLine: i + 1 });
      }
      if (ch === "}") {
        scopeStack.pop();
        scopeDepth = Math.max(0, scopeDepth - 1);
      }
    }
  }

  const cursorScopeDepth = scopeDepth;

  return symbols.filter((sym) => {
    // Symbol must be declared before cursor
    if (sym.line > cursorLine) return false;

    // Global symbols (depth 0) are always visible
    if (sym.scopeDepth === 0) return true;

    // Functions declared at any scope are visible (simplification for C++)
    if (sym.kind === "Function" || sym.kind === "Class" || sym.kind === "Enum" || sym.kind === "Interface" || sym.kind === "Constant") {
      return true;
    }

    // Variables: visible if in same scope or a parent scope
    return sym.scopeDepth <= cursorScopeDepth;
  });
}

// ---------------------------------------------------------------------------
// 5. Detect member-access trigger context
// ---------------------------------------------------------------------------

function getMemberAccessContext(model, position) {
  const lineContent = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column
  });

  // Check for ., ->, :: before cursor
  // Pattern: variableName. or variableName-> or ClassName::
  const dotMatch = lineContent.match(/(\w+)\.\s*(\w*)$/);
  if (dotMatch) {
    return { variable: dotMatch[1], operator: ".", partial: dotMatch[2] || "" };
  }

  const arrowMatch = lineContent.match(/(\w+)->\s*(\w*)$/);
  if (arrowMatch) {
    return { variable: arrowMatch[1], operator: "->", partial: arrowMatch[2] || "" };
  }

  const scopeMatch = lineContent.match(/(\w+)::\s*(\w*)$/);
  if (scopeMatch) {
    return { variable: scopeMatch[1], operator: "::", partial: scopeMatch[2] || "" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// 6. Main completion builder
// ---------------------------------------------------------------------------

function resolveKind(monaco, kindStr) {
  const kindMap = {
    Function: monaco.languages.CompletionItemKind.Function,
    Method: monaco.languages.CompletionItemKind.Method,
    Variable: monaco.languages.CompletionItemKind.Variable,
    Class: monaco.languages.CompletionItemKind.Class,
    Snippet: monaco.languages.CompletionItemKind.Snippet,
    Enum: monaco.languages.CompletionItemKind.Enum,
    Interface: monaco.languages.CompletionItemKind.Interface,
    Constant: monaco.languages.CompletionItemKind.Constant,
    Field: monaco.languages.CompletionItemKind.Field
  };
  return kindMap[kindStr] ?? monaco.languages.CompletionItemKind.Text;
}

export function buildCompletionItems(model, position, monacoInstance) {
  const fullText = model.getValue();
  const suggestions = [];
  const addedLabels = new Set();

  function addSuggestion(item, sortPrefix = "b") {
    if (addedLabels.has(item.label)) return;
    addedLabels.add(item.label);
    suggestions.push({
      label: item.label,
      insertText: item.insertText || item.label,
      insertTextRules: item.insertText?.includes("$")
        ? monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet
        : undefined,
      kind: resolveKind(monacoInstance, item.kind),
      detail: item.detail || item.documentation || "",
      documentation: item.documentation || item.detail || "",
      sortText: `${sortPrefix}_${item.label}`
    });
  }

  // --- Check for member access context ---
  const memberCtx = getMemberAccessContext(model, position);

  if (memberCtx) {
    // Resolve variable type and suggest members
    const resolvedType = resolveVariableType(memberCtx.variable, fullText, position.lineNumber);

    if (resolvedType && TYPE_MEMBERS[resolvedType]) {
      const members = TYPE_MEMBERS[resolvedType];
      for (const member of members) {
        addSuggestion(member, "a"); // highest sort priority for member suggestions
      }
      return { suggestions };
    }

    // For :: operator, check if it's a known namespace/class (e.g., std::)
    if (memberCtx.operator === "::") {
      const nsName = memberCtx.variable;
      if (nsName === "std") {
        // Suggest all std:: symbols from included headers
        const headers = getIncludedHeaders(fullText);
        for (const header of headers) {
          const headerSyms = HEADER_SYMBOLS[header];
          if (!headerSyms) continue;
          for (const sym of headerSyms) {
            // Strip std:: prefix for :: completion
            const stripped = sym.label.replace(/^std::/, "");
            addSuggestion({ ...sym, label: stripped, insertText: stripped }, "a");
          }
        }
        return { suggestions };
      }

      // Check user-defined classes/enums
      const userSymbols = extractUserSymbols(fullText);
      const classSymbol = userSymbols.find(
        (s) => s.name === nsName && (s.kind === "Class" || s.kind === "Enum")
      );
      if (classSymbol) {
        // Return user symbols that might be members (limited without full parsing)
        return { suggestions };
      }
    }

    // If we can't resolve the type, return empty to let Monaco handle it
    if (suggestions.length === 0) {
      return { suggestions };
    }
  }

  // --- Non-member context: full suggestions ---

  // 1. User-defined symbols (highest priority)
  const allSymbols = extractUserSymbols(fullText);
  const visibleSymbols = filterByScope(allSymbols, fullText, position.lineNumber);

  for (const sym of visibleSymbols) {
    addSuggestion(
      {
        label: sym.name,
        kind: sym.kind,
        detail: sym.detail,
        documentation: sym.detail
      },
      "a"
    );
  }

  // 2. Library-aware completions from included headers
  const includedHeaders = getIncludedHeaders(fullText);
  for (const header of includedHeaders) {
    const headerSyms = HEADER_SYMBOLS[header];
    if (!headerSyms) continue;
    for (const sym of headerSyms) {
      addSuggestion(
        {
          label: sym.label,
          kind: sym.kind,
          detail: sym.detail,
          documentation: `From <${header}>`
        },
        "b"
      );
    }
  }

  // 3. Static snippets (lowest priority)
  for (const item of SNIPPET_ITEMS) {
    addSuggestion(
      {
        label: item.label,
        insertText: item.insertText,
        kind: item.kind,
        detail: item.documentation,
        documentation: item.documentation
      },
      "c"
    );
  }

  return { suggestions };
}
