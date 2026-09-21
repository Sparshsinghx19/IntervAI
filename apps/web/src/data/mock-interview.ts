export interface MockQuestion {
  id: string;
  focusArea: string;
  difficulty: string;
  question: string;
}

export const mockQuestions: MockQuestion[] = [
  // Data Structures & Algorithms
  { id: 'dsa-1', focusArea: 'dsa', difficulty: 'easy', question: 'Explain the difference between an Array and a Linked List.' },
  { id: 'dsa-2', focusArea: 'dsa', difficulty: 'medium', question: 'How would you detect a cycle in a linked list? Describe the algorithm.' },
  { id: 'dsa-3', focusArea: 'dsa', difficulty: 'medium', question: 'What is a Trie data structure, and what are its common use cases?' },
  { id: 'dsa-4', focusArea: 'dsa', difficulty: 'hard', question: 'Explain the time complexity and inner workings of Quicksort versus Mergesort.' },
  { id: 'dsa-5', focusArea: 'dsa', difficulty: 'hard', question: 'How would you implement an LRU Cache?' },

  // Operating Systems
  { id: 'os-1', focusArea: 'os', difficulty: 'easy', question: 'What is the main difference between a process and a thread?' },
  { id: 'os-2', focusArea: 'os', difficulty: 'medium', question: 'Explain the concept of virtual memory and how page faults are handled.' },
  { id: 'os-3', focusArea: 'os', difficulty: 'medium', question: 'What is a deadlock? What are the four necessary conditions for a deadlock to occur?' },
  { id: 'os-4', focusArea: 'os', difficulty: 'medium', question: 'Describe how a mutex differs from a semaphore.' },
  { id: 'os-5', focusArea: 'os', difficulty: 'hard', question: 'Explain the thrashing phenomenon in operating systems and how it can be mitigated.' },

  // DBMS
  { id: 'db-1', focusArea: 'dbms', difficulty: 'easy', question: 'What is normalization and why is it important in a database?' },
  { id: 'db-2', focusArea: 'dbms', difficulty: 'medium', question: 'Explain the ACID properties of a database transaction.' },
  { id: 'db-3', focusArea: 'dbms', difficulty: 'medium', question: 'What is the difference between a clustered and a non-clustered index?' },
  { id: 'db-4', focusArea: 'dbms', difficulty: 'hard', question: 'How do you handle dirty reads and phantom reads in SQL databases?' },
  { id: 'db-5', focusArea: 'dbms', difficulty: 'hard', question: 'Explain the CAP theorem and how it applies to NoSQL databases.' },

  // Computer Networks
  { id: 'net-1', focusArea: 'networks', difficulty: 'easy', question: 'What is the difference between TCP and UDP?' },
  { id: 'net-2', focusArea: 'networks', difficulty: 'medium', question: 'Can you describe the OSI model and its seven layers?' },
  { id: 'net-3', focusArea: 'networks', difficulty: 'medium', question: 'How does the DNS resolution process work?' },
  { id: 'net-4', focusArea: 'networks', difficulty: 'hard', question: 'Explain the TCP 3-way handshake and the 4-way teardown.' },
  { id: 'net-5', focusArea: 'networks', difficulty: 'hard', question: 'How does BGP (Border Gateway Protocol) route internet traffic?' },

  // OOP
  { id: 'oop-1', focusArea: 'oop', difficulty: 'easy', question: 'What are the four main principles of Object-Oriented Programming?' },
  { id: 'oop-2', focusArea: 'oop', difficulty: 'medium', question: 'What is the difference between abstract classes and interfaces?' },
  { id: 'oop-3', focusArea: 'oop', difficulty: 'medium', question: 'Can you explain the concept of polymorphism with an example?' },
  { id: 'oop-4', focusArea: 'oop', difficulty: 'hard', question: 'How does method overloading differ from method overriding under the hood?' },
  { id: 'oop-5', focusArea: 'oop', difficulty: 'hard', question: 'Explain the Dependency Inversion Principle from SOLID.' },

  // System Design
  { id: 'sys-1', focusArea: 'system-design', difficulty: 'easy', question: 'What is the purpose of a load balancer?' },
  { id: 'sys-2', focusArea: 'system-design', difficulty: 'medium', question: 'How would you scale a read-heavy application?' },
  { id: 'sys-3', focusArea: 'system-design', difficulty: 'medium', question: 'What is horizontal versus vertical scaling?' },
  { id: 'sys-4', focusArea: 'system-design', difficulty: 'hard', question: 'How would you design a URL shortener like bit.ly?' },
  { id: 'sys-5', focusArea: 'system-design', difficulty: 'hard', question: 'Explain how you would design a rate limiter for an API.' },
];

export interface SessionConfig {
  interviewType: string;
  difficulty: string;
  focusArea: string;
  questionCount: string;
}

export function getMockQuestions(config: SessionConfig): MockQuestion[] {
  const count = parseInt(config.questionCount, 10) || 5;
  const result: MockQuestion[] = [];

  // 1. Exact focusArea + difficulty match
  const exactMatches = mockQuestions.filter(
    (q) => q.focusArea === config.focusArea && q.difficulty === config.difficulty
  );
  
  result.push(...exactMatches);

  // 2. Same focusArea with another available difficulty
  if (result.length < count) {
    const otherMatches = mockQuestions.filter(
      (q) => q.focusArea === config.focusArea && q.difficulty !== config.difficulty
    );
    for (const q of otherMatches) {
      if (result.length < count) {
        result.push(q);
      }
    }
  }

  // We explicitly DO NOT add questions from other focus areas.
  // The UI will handle the limitation.
  
  return result.slice(0, count);
}
