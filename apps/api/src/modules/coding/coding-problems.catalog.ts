import { PublicCodingProblem, SupportedLanguage } from './coding.types.js';

export interface InternalCodingProblem extends Omit<PublicCodingProblem, 'hasHiddenTests'> {
  questionBankId: number;
}

export const CODING_PROBLEMS_CATALOG: Record<string, InternalCodingProblem> = {
  'two-sum-ii-input-array-is-sorted': {
    slug: 'two-sum-ii-input-array-is-sorted',
    questionBankId: 91,
    title: 'Two Sum II — Input Array Is Sorted',
    difficulty: 'MEDIUM',
    category: 'Arrays · Two Pointers',
    description: `Given a 1-indexed array of integers numbers that is already sorted in non-decreasing order, find two numbers such that they add up to a specific target number.

Let these two numbers be numbers[index1] and numbers[index2] where 1 <= index1 < index2 <= numbers.length.

Return the indices of the two numbers, index1 and index2, added by one as an integer array [index1, index2] of length 2.

The tests are generated such that there is exactly one solution. You may not use the same element twice. Your solution must use only constant extra space.`,
    constraints: [
      '2 <= numbers.length <= 3 * 10^4',
      '-1000 <= numbers[i] <= 1000',
      'numbers is sorted in non-decreasing order.',
      '-1000 <= target <= 1000',
      'The tests are generated such that there is exactly one solution.'
    ],
    examples: [
      {
        input: "[2,7,11,15]\n9",
        output: '[1,2]',
        explanation: 'The sum of 2 and 7 is 9. Therefore, index1 = 1, index2 = 2. We return [1, 2].'
      },
      {
        input: "[2,3,4]\n6",
        output: '[1,3]',
        explanation: 'The sum of 2 and 4 is 6. Therefore index1 = 1, index2 = 3. We return [1, 3].'
      },
      {
        input: "[-1,0]\n-1",
        output: '[1,2]',
        explanation: 'The sum of -1 and 0 is -1. Therefore index1 = 1, index2 = 2. We return [1, 2].'
      }
    ],
    starterCode: {
      cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& numbers, int target) {
        // Implement your solution
        return {};
    }
};`,
      python: `class Solution:
    def twoSum(self, numbers: list[int], target: int) -> list[int]:
        # Implement your solution
        return []
`,
      java: `class Solution {
    public int[] twoSum(int[] numbers, int target) {
        // Implement your solution
        return new int[]{};
    }
}
`
    }
  },

  'valid-palindrome': {
    slug: 'valid-palindrome',
    questionBankId: 31,
    title: 'Valid Palindrome',
    difficulty: 'EASY',
    category: 'Strings · Two Pointers',
    description: `A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string s, return true if it is a palindrome, or false otherwise.`,
    constraints: [
      '1 <= s.length <= 2 * 10^5',
      's consists only of printable ASCII characters.'
    ],
    examples: [
      {
        input: 'A man, a plan, a canal: Panama',
        output: 'true',
        explanation: 'After removing non-alphanumeric and lowercasing: "amanaplanacanalpanama", which is a palindrome.'
      },
      {
        input: 'race a car',
        output: 'false',
        explanation: '"raceacar" is not a palindrome.'
      },
      {
        input: ' ',
        output: 'true',
        explanation: 's is an empty string "" after removing non-alphanumeric characters. Since an empty string reads the same forward and backward, it is a palindrome.'
      }
    ],
    starterCode: {
      cpp: `class Solution {
public:
    bool isPalindrome(string s) {
        // Implement your solution
        return false;
    }
};`,
      python: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        # Implement your solution
        return False
`,
      java: `class Solution {
    public boolean isPalindrome(String s) {
        // Implement your solution
        return false;
    }
}
`
    }
  },

  'reverse-linked-list': {
    slug: 'reverse-linked-list',
    questionBankId: 34,
    title: 'Reverse Linked List',
    difficulty: 'EASY',
    category: 'Linked Lists · Pointers',
    description: `Given the head of a singly linked list, reverse the list, and return the reversed list.`,
    constraints: [
      'The number of nodes in the list is the range [0, 5000].',
      '-5000 <= Node.val <= 5000'
    ],
    examples: [
      {
        input: '[1,2,3,4,5]',
        output: '[5,4,3,2,1]',
        explanation: 'The reversed list is [5, 4, 3, 2, 1].'
      },
      {
        input: '[1,2]',
        output: '[2,1]',
        explanation: 'The reversed list is [2, 1].'
      },
      {
        input: '[]',
        output: '[]',
        explanation: 'An empty list reversed is an empty list.'
      }
    ],
    starterCode: {
      cpp: `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        // Implement your solution
        return nullptr;
    }
};`,
      python: `# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        # Implement your solution
        return None
`,
      java: `/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode reverseList(ListNode head) {
        // Implement your solution
        return null;
    }
}
`
    }
  },

  'linked-list-cycle': {
    slug: 'linked-list-cycle',
    questionBankId: 2,
    title: 'Linked List Cycle',
    difficulty: 'EASY',
    category: 'Linked Lists · Two Pointers',
    description: `Given head, the head of a singly linked list, determine if the linked list has a cycle in it.

There is a cycle in a linked list if there is some node in the list that can be reached again by continuously following the next pointer. Internally, pos is used to denote the index of the node that tail's next pointer is connected to. Note that pos is not passed as a parameter.

Return true if there is a cycle in the linked list. Otherwise, return false.`,
    constraints: [
      'The number of the nodes in the list is in the range [0, 10^4].',
      '-10^5 <= Node.val <= 10^5',
      'pos is -1 or a valid index in the linked-list.'
    ],
    examples: [
      {
        input: "[3,2,0,-4]\n1",
        output: 'true',
        explanation: 'There is a cycle in the linked list, where the tail connects to the 1st node (0-indexed).'
      },
      {
        input: "[1,2]\n0",
        output: 'true',
        explanation: 'There is a cycle in the linked list, where the tail connects to the 0th node.'
      },
      {
        input: "[1]\n-1",
        output: 'false',
        explanation: 'There is no cycle in the linked list.'
      }
    ],
    starterCode: {
      cpp: `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode(int x) : val(x), next(NULL) {}
 * };
 */
class Solution {
public:
    bool hasCycle(ListNode *head) {
        // Implement your solution
        return false;
    }
};`,
      python: `# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, x):
#         self.val = x
#         self.next = None

class Solution:
    def hasCycle(self, head: Optional[ListNode]) -> bool:
        # Implement your solution
        return False
`,
      java: `/**
 * Definition for singly-linked list.
 * class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode(int x) {
 *         val = x;
 *         next = null;
 *     }
 * }
 */
class Solution {
    public boolean hasCycle(ListNode head) {
        // Implement your solution
        return false;
    }
}
`
    }
  },

  'coin-change': {
    slug: 'coin-change',
    questionBankId: 35,
    title: 'Coin Change',
    difficulty: 'MEDIUM',
    category: 'Dynamic Programming · Optimization',
    description: `You are given an integer array coins representing coins of different denominations and an integer amount representing a total amount of money.

Return the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return -1.

You may assume that you have an infinite number of each kind of coin.`,
    constraints: [
      '1 <= coins.length <= 12',
      '1 <= coins[i] <= 2^31 - 1',
      '0 <= amount <= 10^4'
    ],
    examples: [
      {
        input: "[1,2,5]\n11",
        output: '3',
        explanation: '11 = 5 + 5 + 1 (3 coins)'
      },
      {
        input: "[2]\n3",
        output: '-1',
        explanation: 'The amount of 3 cannot be made with only 2-cent coins.'
      },
      {
        input: "[1]\n0",
        output: '0',
        explanation: 'Amount 0 requires 0 coins.'
      }
    ],
    starterCode: {
      cpp: `class Solution {
public:
    int coinChange(vector<int>& coins, int amount) {
        // Implement your solution
        return -1;
    }
};`,
      python: `class Solution:
    def coinChange(self, coins: list[int], amount: int) -> int:
        # Implement your solution
        return -1
`,
      java: `class Solution {
    public int coinChange(int[] coins, int amount) {
        // Implement your solution
        return -1;
    }
}
`
    }
  }
};

export function getCodingProblemBySlug(slug: string): InternalCodingProblem | null {
  return CODING_PROBLEMS_CATALOG[slug] || null;
}

export function findCodingProblemForQuestion(questionText: string, slug?: string | null): InternalCodingProblem | null {
  if (slug && CODING_PROBLEMS_CATALOG[slug]) {
    return CODING_PROBLEMS_CATALOG[slug];
  }

  const lower = questionText.toLowerCase();
  if (lower.includes('two sum') || (lower.includes('sorted') && lower.includes('array') && lower.includes('sum'))) {
    return CODING_PROBLEMS_CATALOG['two-sum-ii-input-array-is-sorted'];
  }
  if (lower.includes('palindrome') && !lower.includes('longest')) {
    return CODING_PROBLEMS_CATALOG['valid-palindrome'];
  }
  if (lower.includes('reverse') && lower.includes('linked list')) {
    return CODING_PROBLEMS_CATALOG['reverse-linked-list'];
  }
  if (lower.includes('cycle') && lower.includes('linked list')) {
    return CODING_PROBLEMS_CATALOG['linked-list-cycle'];
  }
  if (lower.includes('coin change')) {
    return CODING_PROBLEMS_CATALOG['coin-change'];
  }

  return null;
}

export type QuestionKind = 'THEORY' | 'CODING' | 'SYSTEM_DESIGN';

interface QuestionLike {
  type?: string | null;
  questionText?: string | null;
  codingProblemSlug?: string | null;
}

/** Catalog slug when the question is a coding problem the runner can execute, otherwise null. */
export function runnableProblemSlug(q: QuestionLike): string | null {
  return findCodingProblemForQuestion(q.questionText ?? '', q.codingProblemSlug)?.slug ?? null;
}

/**
 * The type the session, completion and evaluation rules use. A question stored
 * as CODING without a runnable catalog problem cannot be executed or submitted
 * as code, so it is answered (and counted, and evaluated) as a text question.
 */
/**
 * Public code execution can be switched off (CODE_EXECUTION_ENABLED=false), for
 * example when no isolated production runner is available. Coding questions are
 * then answered in text, through the same path as unmappable coding questions.
 */
export function codeExecutionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CODE_EXECUTION_ENABLED?.trim().toLowerCase() !== 'false';
}

export function effectiveQuestionType(q: QuestionLike): QuestionKind {
  if (q.type === 'CODING') return runnableProblemSlug(q) && codeExecutionEnabled() ? 'CODING' : 'THEORY';
  return q.type === 'SYSTEM_DESIGN' ? 'SYSTEM_DESIGN' : 'THEORY';
}

/** Type and slug to store for a new question: CODING only when a runnable problem backs it. */
export function classifyNewQuestion(q: QuestionLike): { type: QuestionKind; codingProblemSlug: string | null } {
  // Stored type does not depend on whether execution is currently switched on.
  const slug = q.type === 'CODING' ? runnableProblemSlug(q) : null;
  if (slug) return { type: 'CODING', codingProblemSlug: slug };
  return { type: q.type === 'SYSTEM_DESIGN' ? 'SYSTEM_DESIGN' : 'THEORY', codingProblemSlug: null };
}
