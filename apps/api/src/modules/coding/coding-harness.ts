import { SupportedLanguage } from './coding.types.js';

export interface HarnessConfig {
  slug: string;
  language: SupportedLanguage;
  candidateCode: string;
}

/**
 * Builds a language-specific, isolated execution harness for Judge0.
 * Wraps function-based candidate solutions (class Solution) into a complete executable program
 * that parses test inputs from stdin, invokes the candidate's solution, and outputs normalized results to stdout.
 */
export function buildExecutionHarness(slug: string, language: SupportedLanguage, candidateCode: string): string {
  // If the candidate wrote a full program with their own main function, preserve compatibility
  if (hasCustomMain(language, candidateCode)) {
    return candidateCode;
  }

  switch (slug) {
    case 'two-sum-ii-input-array-is-sorted':
    case 'two-sum-ii':
      return buildTwoSumHarness(language, candidateCode);

    case 'valid-palindrome':
      return buildPalindromeHarness(language, candidateCode);

    case 'reverse-linked-list':
      return buildReverseListHarness(language, candidateCode);

    case 'linked-list-cycle':
      return buildCycleHarness(language, candidateCode);

    case 'coin-change':
      return buildCoinChangeHarness(language, candidateCode);

    default:
      return candidateCode;
  }
}

function hasCustomMain(language: SupportedLanguage, code: string): boolean {
  if (language === 'cpp') {
    return /\bint\s+main\s*\(/.test(code);
  }
  if (language === 'python') {
    return /if\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(code);
  }
  if (language === 'java') {
    return /public\s+static\s+void\s+main\s*\(/.test(code);
  }
  return false;
}

// -----------------------------------------------------------------------------
// 1. Two Sum II — Input Array Is Sorted
// -----------------------------------------------------------------------------
function buildTwoSumHarness(language: SupportedLanguage, code: string): string {
  if (language === 'cpp') {
    return `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>

using namespace std;

${code}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    string line1, line2;
    if (!getline(cin, line1)) return 0;
    while (!line1.empty() && (line1.back() == '\\r' || line1.back() == ' ')) line1.pop_back();

    for (char &c : line1) {
        if (c == '[' || c == ']' || c == ',') c = ' ';
    }
    stringstream ss(line1);
    vector<int> numbers;
    int num;
    while (ss >> num) numbers.push_back(num);

    int target = 0;
    if (cin >> target) {
        Solution solver;
        vector<int> res = solver.twoSum(numbers, target);
        cout << "[";
        for (size_t i = 0; i < res.size(); ++i) {
            if (i > 0) cout << ",";
            cout << res[i];
        }
        cout << "]\\n";
    }
    return 0;
}
`;
  }

  if (language === 'python') {
    return `
import sys
import json
from typing import List

${code}

def main():
    raw_lines = [line.strip() for line in sys.stdin if line.strip()]
    if len(raw_lines) < 2:
        return
    numbers = json.loads(raw_lines[0])
    target = int(raw_lines[1])
    solver = Solution()
    res = solver.twoSum(numbers, target)
    print(json.dumps(res, separators=(',', ':')))

if __name__ == '__main__':
    main()
`;
  }

  // Java
  const sanitizedJava = code.replace(/public\s+class\s+Solution/g, 'class Solution');
  return `
import java.util.*;
import java.io.*;

${sanitizedJava}

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line1 = br.readLine();
        String line2 = br.readLine();
        if (line1 == null || line2 == null) return;

        line1 = line1.trim().replace("[", "").replace("]", "");
        String[] parts = line1.split("[,\\\\s]+");
        List<Integer> list = new ArrayList<>();
        for (String p : parts) {
            if (!p.trim().isEmpty()) {
                list.add(Integer.parseInt(p.trim()));
            }
        }
        int[] numbers = new int[list.size()];
        for (int i = 0; i < list.size(); i++) numbers[i] = list.get(i);

        int target = Integer.parseInt(line2.trim());
        Solution solver = new Solution();
        int[] res = solver.twoSum(numbers, target);
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < res.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(res[i]);
        }
        sb.append("]");
        System.out.println(sb.toString());
    }
}
`;
}

// -----------------------------------------------------------------------------
// 2. Valid Palindrome
// -----------------------------------------------------------------------------
function buildPalindromeHarness(language: SupportedLanguage, code: string): string {
  if (language === 'cpp') {
    return `
#include <iostream>
#include <string>
#include <cctype>

using namespace std;

${code}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    string s;
    if (getline(cin, s)) {
        while (!s.empty() && (s.back() == '\\r' || s.back() == '\\n')) s.pop_back();
        if (s.size() >= 2 && s.front() == '"' && s.back() == '"') {
            s = s.substr(1, s.size() - 2);
        }
        Solution solver;
        cout << (solver.isPalindrome(s) ? "true" : "false") << "\\n";
    }
    return 0;
}
`;
  }

  if (language === 'python') {
    return `
import sys

${code}

def main():
    raw = sys.stdin.read().rstrip('\\r\\n')
    if raw.startswith('"') and raw.endswith('"') and len(raw) >= 2:
        raw = raw[1:-1]
    solver = Solution()
    print("true" if solver.isPalindrome(raw) else "false")

if __name__ == '__main__':
    main()
`;
  }

  // Java
  const sanitizedJava = code.replace(/public\s+class\s+Solution/g, 'class Solution');
  return `
import java.util.*;
import java.io.*;

${sanitizedJava}

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String s = br.readLine();
        if (s == null) s = "";
        if (s.startsWith("\\"") && s.endsWith("\\"") && s.length() >= 2) {
            s = s.substring(1, s.length() - 1);
        }
        Solution solver = new Solution();
        System.out.println(solver.isPalindrome(s) ? "true" : "false");
    }
}
`;
}

// -----------------------------------------------------------------------------
// 3. Reverse Linked List
// -----------------------------------------------------------------------------
function buildReverseListHarness(language: SupportedLanguage, code: string): string {
  if (language === 'cpp') {
    return `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>

using namespace std;

struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

${code}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    string line;
    if (!getline(cin, line)) return 0;
    for (char &c : line) {
        if (c == '[' || c == ']' || c == ',') c = ' ';
    }
    stringstream ss(line);
    vector<int> vals;
    int v;
    while (ss >> v) vals.push_back(v);

    ListNode* head = nullptr;
    if (!vals.empty()) {
        head = new ListNode(vals[0]);
        ListNode* curr = head;
        for (size_t i = 1; i < vals.size(); ++i) {
            curr->next = new ListNode(vals[i]);
            curr = curr->next;
        }
    }

    Solution solver;
    ListNode* rev = solver.reverseList(head);

    cout << "[";
    ListNode* p = rev;
    bool first = true;
    int count = 0;
    while (p && count < 10000) {
        if (!first) cout << ",";
        cout << p->val;
        first = false;
        p = p->next;
        count++;
    }
    cout << "]\\n";
    return 0;
}
`;
  }

  if (language === 'python') {
    return `
import sys
import json
from typing import Optional

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

${code}

def main():
    line = sys.stdin.read().strip()
    if not line:
        print("[]")
        return
    vals = json.loads(line)
    head = None
    if vals:
        head = ListNode(vals[0])
        curr = head
        for v in vals[1:]:
            curr.next = ListNode(v)
            curr = curr.next

    solver = Solution()
    rev = solver.reverseList(head)

    out = []
    curr = rev
    count = 0
    while curr and count < 10000:
        out.append(curr.val)
        curr = curr.next
        count += 1
    print(json.dumps(out, separators=(',', ':')))

if __name__ == '__main__':
    main()
`;
  }

  // Java
  const sanitizedJava = code.replace(/public\s+class\s+Solution/g, 'class Solution');
  return `
import java.util.*;
import java.io.*;

class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

${sanitizedJava}

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line = br.readLine();
        if (line == null || line.trim().equals("[]") || line.trim().isEmpty()) {
            System.out.println("[]");
            return;
        }

        line = line.trim().replace("[", "").replace("]", "");
        String[] parts = line.split("[,\\\\s]+");
        List<Integer> vals = new ArrayList<>();
        for (String p : parts) {
            if (!p.trim().isEmpty()) vals.add(Integer.parseInt(p.trim()));
        }

        ListNode head = null;
        if (!vals.isEmpty()) {
            head = new ListNode(vals.get(0));
            ListNode curr = head;
            for (int i = 1; i < vals.size(); i++) {
                curr.next = new ListNode(vals.get(i));
                curr = curr.next;
            }
        }

        Solution solver = new Solution();
        ListNode rev = solver.reverseList(head);

        StringBuilder sb = new StringBuilder("[");
        ListNode curr = rev;
        boolean first = true;
        int count = 0;
        while (curr != null && count < 10000) {
            if (!first) sb.append(",");
            sb.append(curr.val);
            first = false;
            curr = curr.next;
            count++;
        }
        sb.append("]");
        System.out.println(sb.toString());
    }
}
`;
}

// -----------------------------------------------------------------------------
// 4. Linked List Cycle
// -----------------------------------------------------------------------------
function buildCycleHarness(language: SupportedLanguage, code: string): string {
  if (language === 'cpp') {
    return `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>

using namespace std;

struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x) : val(x), next(NULL) {}
};

${code}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    string line1, line2;
    if (!getline(cin, line1)) return 0;
    int pos = -1;
    if (cin >> pos) {}

    for (char &c : line1) {
        if (c == '[' || c == ']' || c == ',') c = ' ';
    }
    stringstream ss(line1);
    vector<int> vals;
    int v;
    while (ss >> v) vals.push_back(v);

    ListNode* head = nullptr;
    if (!vals.empty()) {
        head = new ListNode(vals[0]);
        ListNode* curr = head;
        ListNode* cycleNode = (pos == 0) ? head : nullptr;

        for (size_t i = 1; i < vals.size(); ++i) {
            curr->next = new ListNode(vals[i]);
            curr = curr->next;
            if ((int)i == pos) cycleNode = curr;
        }
        if (pos >= 0 && cycleNode) {
            curr->next = cycleNode;
        }
    }

    Solution solver;
    bool res = solver.hasCycle(head);
    cout << (res ? "true" : "false") << "\\n";
    return 0;
}
`;
  }

  if (language === 'python') {
    return `
import sys
import json
from typing import Optional

class ListNode:
    def __init__(self, x):
        self.val = x
        self.next = None

${code}

def main():
    lines = [l.strip() for l in sys.stdin if l.strip()]
    if not lines:
        print("false")
        return
    vals = json.loads(lines[0])
    pos = int(lines[1]) if len(lines) > 1 else -1

    head = None
    if vals:
        head = ListNode(vals[0])
        curr = head
        nodes = [head]
        for v in vals[1:]:
            curr.next = ListNode(v)
            curr = curr.next
            nodes.append(curr)
        if pos >= 0 and pos < len(nodes):
            curr.next = nodes[pos]

    solver = Solution()
    res = solver.hasCycle(head)
    print("true" if res else "false")

if __name__ == '__main__':
    main()
`;
  }

  // Java
  const sanitizedJava = code.replace(/public\s+class\s+Solution/g, 'class Solution');
  return `
import java.util.*;
import java.io.*;

class ListNode {
    int val;
    ListNode next;
    ListNode(int x) {
        val = x;
        next = null;
    }
}

${sanitizedJava}

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line1 = br.readLine();
        String line2 = br.readLine();
        if (line1 == null || line1.trim().isEmpty() || line1.trim().equals("[]")) {
            System.out.println("false");
            return;
        }

        line1 = line1.trim().replace("[", "").replace("]", "");
        String[] parts = line1.split("[,\\\\s]+");
        List<Integer> vals = new ArrayList<>();
        for (String p : parts) {
            if (!p.trim().isEmpty()) vals.add(Integer.parseInt(p.trim()));
        }

        int pos = -1;
        if (line2 != null && !line2.trim().isEmpty()) {
            pos = Integer.parseInt(line2.trim());
        }

        ListNode head = null;
        if (!vals.isEmpty()) {
            head = new ListNode(vals.get(0));
            ListNode curr = head;
            List<ListNode> nodes = new ArrayList<>();
            nodes.add(head);

            for (int i = 1; i < vals.size(); i++) {
                curr.next = new ListNode(vals.get(i));
                curr = curr.next;
                nodes.add(curr);
            }
            if (pos >= 0 && pos < nodes.size()) {
                curr.next = nodes.get(pos);
            }
        }

        Solution solver = new Solution();
        boolean res = solver.hasCycle(head);
        System.out.println(res ? "true" : "false");
    }
}
`;
}

// -----------------------------------------------------------------------------
// 5. Coin Change
// -----------------------------------------------------------------------------
function buildCoinChangeHarness(language: SupportedLanguage, code: string): string {
  if (language === 'cpp') {
    return `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>

using namespace std;

${code}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    string line1;
    if (!getline(cin, line1)) return 0;
    int amount = 0;
    if (!(cin >> amount)) return 0;

    for (char &c : line1) {
        if (c == '[' || c == ']' || c == ',') c = ' ';
    }
    stringstream ss(line1);
    vector<int> coins;
    int v;
    while (ss >> v) coins.push_back(v);

    Solution solver;
    cout << solver.coinChange(coins, amount) << "\\n";
    return 0;
}
`;
  }

  if (language === 'python') {
    return `
import sys
import json
from typing import List

${code}

def main():
    lines = [l.strip() for l in sys.stdin if l.strip()]
    if len(lines) < 2:
        return
    coins = json.loads(lines[0])
    amount = int(lines[1])
    solver = Solution()
    print(solver.coinChange(coins, amount))

if __name__ == '__main__':
    main()
`;
  }

  // Java
  const sanitizedJava = code.replace(/public\s+class\s+Solution/g, 'class Solution');
  return `
import java.util.*;
import java.io.*;

${sanitizedJava}

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line1 = br.readLine();
        String line2 = br.readLine();
        if (line1 == null || line2 == null) return;

        line1 = line1.trim().replace("[", "").replace("]", "");
        String[] parts = line1.split("[,\\\\s]+");
        List<Integer> list = new ArrayList<>();
        for (String p : parts) {
            if (!p.trim().isEmpty()) list.add(Integer.parseInt(p.trim()));
        }
        int[] coins = new int[list.size()];
        for (int i = 0; i < list.size(); i++) coins[i] = list.get(i);

        int amount = Integer.parseInt(line2.trim());
        Solution solver = new Solution();
        System.out.println(solver.coinChange(coins, amount));
    }
}
`;
}
