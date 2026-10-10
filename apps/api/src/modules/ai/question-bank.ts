export type Topic = 'DSA' | 'OS' | 'DBMS' | 'CN' | 'OOP' | 'System Design';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface QuestionBankEntry {
  id: number;
  topic: Topic;
  subtopic: string;
  difficulty: Difficulty;
  questionText: string;
  tags: string[];
}

export const questionBank: QuestionBankEntry[] = [
  // DSA - EASY (5)
  { id: 1, topic: 'DSA', subtopic: 'Arrays', difficulty: 'EASY', questionText: 'Explain how to find the missing number in a given integer array of 1 to 100.', tags: ['array', 'math'] },
  { id: 31, topic: 'DSA', subtopic: 'Strings', difficulty: 'EASY', questionText: 'How do you check if a string is a palindrome?', tags: ['string', 'two-pointers'] },
  { id: 32, topic: 'DSA', subtopic: 'Arrays', difficulty: 'EASY', questionText: 'Explain how to find the maximum and minimum elements in an array.', tags: ['array', 'search'] },
  { id: 33, topic: 'DSA', subtopic: 'Hashing', difficulty: 'EASY', questionText: 'What is a hash table and how does it handle collisions?', tags: ['hash-table', 'data-structures'] },
  { id: 34, topic: 'DSA', subtopic: 'Linked Lists', difficulty: 'EASY', questionText: 'How do you reverse a singly linked list?', tags: ['linked-list', 'pointers'] },
  
  // DSA - MEDIUM (5)
  { id: 2, topic: 'DSA', subtopic: 'Linked Lists', difficulty: 'MEDIUM', questionText: 'Describe an algorithm to detect a cycle in a singly linked list.', tags: ['linked-list', 'two-pointers'] },
  { id: 3, topic: 'DSA', subtopic: 'Trees', difficulty: 'MEDIUM', questionText: 'How do you find the lowest common ancestor of two nodes in a binary search tree?', tags: ['tree', 'bst'] },
  { id: 4, topic: 'DSA', subtopic: 'Graphs', difficulty: 'MEDIUM', questionText: 'Explain the difference between Breadth-First Search (BFS) and Depth-First Search (DFS). When would you use each?', tags: ['graph', 'bfs', 'dfs'] },
  { id: 35, topic: 'DSA', subtopic: 'Dynamic Programming', difficulty: 'MEDIUM', questionText: 'Explain how to solve the coin change problem using dynamic programming.', tags: ['dp', 'coin-change'] },
  { id: 36, topic: 'DSA', subtopic: 'Trees', difficulty: 'MEDIUM', questionText: 'How do you check if a binary tree is balanced?', tags: ['tree', 'recursion'] },

  // DSA - HARD (5)
  { id: 5, topic: 'DSA', subtopic: 'Dynamic Programming', difficulty: 'HARD', questionText: 'Explain the knapsack problem and how dynamic programming can be used to solve it optimally.', tags: ['dp', 'optimization'] },
  { id: 37, topic: 'DSA', subtopic: 'Graphs', difficulty: 'HARD', questionText: 'Explain Dijkstra\'s algorithm for finding the shortest path in a graph.', tags: ['graph', 'shortest-path'] },
  { id: 38, topic: 'DSA', subtopic: 'Strings', difficulty: 'HARD', questionText: 'Describe an algorithm to find the longest palindromic substring in a string.', tags: ['string', 'dp'] },
  { id: 39, topic: 'DSA', subtopic: 'Trees', difficulty: 'HARD', questionText: 'How do you serialize and deserialize a binary tree?', tags: ['tree', 'serialization'] },
  { id: 40, topic: 'DSA', subtopic: 'Heaps', difficulty: 'HARD', questionText: 'Explain how to find the median of a stream of integers.', tags: ['heap', 'stream'] },

  // OS - EASY (5)
  { id: 6, topic: 'OS', subtopic: 'Processes', difficulty: 'EASY', questionText: 'What is the difference between a process and a thread?', tags: ['process', 'thread', 'concurrency'] },
  { id: 41, topic: 'OS', subtopic: 'Memory', difficulty: 'EASY', questionText: 'What is virtual memory and why is it useful?', tags: ['memory', 'virtual'] },
  { id: 42, topic: 'OS', subtopic: 'Scheduling', difficulty: 'EASY', questionText: 'What is CPU scheduling and why is it necessary?', tags: ['cpu', 'scheduling'] },
  { id: 43, topic: 'OS', subtopic: 'Filesystems', difficulty: 'EASY', questionText: 'What is the purpose of an operating system file system?', tags: ['filesystem', 'storage'] },
  { id: 44, topic: 'OS', subtopic: 'Basics', difficulty: 'EASY', questionText: 'What is the kernel in an operating system?', tags: ['kernel', 'basics'] },

  // OS - MEDIUM (5)
  { id: 7, topic: 'OS', subtopic: 'Memory Management', difficulty: 'MEDIUM', questionText: 'Explain virtual memory and how paging works in an operating system.', tags: ['memory', 'paging'] },
  { id: 8, topic: 'OS', subtopic: 'Concurrency', difficulty: 'MEDIUM', questionText: 'What is a deadlock? Explain the four necessary conditions for a deadlock to occur.', tags: ['deadlock', 'mutex'] },
  { id: 9, topic: 'OS', subtopic: 'Scheduling', difficulty: 'MEDIUM', questionText: 'Describe the differences between preemptive and non-preemptive scheduling algorithms.', tags: ['scheduling', 'cpu'] },
  { id: 45, topic: 'OS', subtopic: 'Synchronization', difficulty: 'MEDIUM', questionText: 'What is a semaphore and how is it different from a mutex?', tags: ['semaphore', 'mutex'] },
  { id: 46, topic: 'OS', subtopic: 'Memory Management', difficulty: 'MEDIUM', questionText: 'Explain the concept of thrashing in an operating system.', tags: ['memory', 'thrashing'] },

  // OS - HARD (5)
  { id: 10, topic: 'OS', subtopic: 'File Systems', difficulty: 'HARD', questionText: 'How do modern file systems implement journaling, and what specific problems does it solve during a crash?', tags: ['file-system', 'journaling', 'reliability'] },
  { id: 47, topic: 'OS', subtopic: 'Concurrency', difficulty: 'HARD', questionText: 'Explain the priority inversion problem and how it can be solved.', tags: ['concurrency', 'priority-inversion'] },
  { id: 48, topic: 'OS', subtopic: 'Memory', difficulty: 'HARD', questionText: 'Describe how a TLB (Translation Lookaside Buffer) improves memory access time.', tags: ['memory', 'tlb'] },
  { id: 49, topic: 'OS', subtopic: 'Distributed OS', difficulty: 'HARD', questionText: 'What are the main challenges in distributed operating systems?', tags: ['distributed', 'os'] },
  { id: 50, topic: 'OS', subtopic: 'Security', difficulty: 'HARD', questionText: 'Explain how address space layout randomization (ASLR) protects an OS from buffer overflow attacks.', tags: ['security', 'aslr'] },

  // DBMS - EASY (5)
  { id: 11, topic: 'DBMS', subtopic: 'SQL Basics', difficulty: 'EASY', questionText: 'What is the difference between an INNER JOIN and a LEFT OUTER JOIN?', tags: ['sql', 'joins'] },
  { id: 51, topic: 'DBMS', subtopic: 'Keys', difficulty: 'EASY', questionText: 'What is a primary key and how does it differ from a foreign key?', tags: ['sql', 'keys'] },
  { id: 52, topic: 'DBMS', subtopic: 'SQL Basics', difficulty: 'EASY', questionText: 'What is the difference between DDL and DML in SQL?', tags: ['sql', 'ddl', 'dml'] },
  { id: 53, topic: 'DBMS', subtopic: 'Basics', difficulty: 'EASY', questionText: 'What is a Relational Database Management System (RDBMS)?', tags: ['rdbms', 'basics'] },
  { id: 54, topic: 'DBMS', subtopic: 'SQL Basics', difficulty: 'EASY', questionText: 'Explain the purpose of the GROUP BY clause in SQL.', tags: ['sql', 'group-by'] },

  // DBMS - MEDIUM (5)
  { id: 12, topic: 'DBMS', subtopic: 'Transactions', difficulty: 'MEDIUM', questionText: 'Explain the ACID properties of a database transaction.', tags: ['acid', 'transactions'] },
  { id: 13, topic: 'DBMS', subtopic: 'Normalization', difficulty: 'MEDIUM', questionText: 'What is database normalization? Explain the difference between 2NF and 3NF.', tags: ['normalization', 'schema'] },
  { id: 55, topic: 'DBMS', subtopic: 'Indexing', difficulty: 'MEDIUM', questionText: 'What is an index in a database and how does it improve query performance?', tags: ['indexing', 'performance'] },
  { id: 56, topic: 'DBMS', subtopic: 'Views', difficulty: 'MEDIUM', questionText: 'What are materialized views and when should they be used?', tags: ['views', 'materialized'] },
  { id: 57, topic: 'DBMS', subtopic: 'Transactions', difficulty: 'MEDIUM', questionText: 'Explain what a database deadlock is and how it can be prevented.', tags: ['deadlock', 'transactions'] },

  // DBMS - HARD (5)
  { id: 14, topic: 'DBMS', subtopic: 'Indexing', difficulty: 'HARD', questionText: 'How does a B-Tree index work under the hood, and why is it preferred for database indexing over a Hash map?', tags: ['indexing', 'b-tree', 'performance'] },
  { id: 15, topic: 'DBMS', subtopic: 'Concurrency', difficulty: 'HARD', questionText: 'Explain the different transaction isolation levels and the specific read phenomena they prevent.', tags: ['isolation', 'concurrency', 'locks'] },
  { id: 58, topic: 'DBMS', subtopic: 'Distributed DBs', difficulty: 'HARD', questionText: 'Explain the CAP theorem and its implications for distributed databases.', tags: ['cap-theorem', 'distributed'] },
  { id: 59, topic: 'DBMS', subtopic: 'Architecture', difficulty: 'HARD', questionText: 'How does Multi-Version Concurrency Control (MVCC) work?', tags: ['mvcc', 'concurrency'] },
  { id: 60, topic: 'DBMS', subtopic: 'Query Optimization', difficulty: 'HARD', questionText: 'Describe how a database query optimizer works to select an execution plan.', tags: ['query-optimizer', 'execution-plan'] },

  // CN - EASY (5)
  { id: 16, topic: 'CN', subtopic: 'OSI Model', difficulty: 'EASY', questionText: 'What are the 7 layers of the OSI model?', tags: ['osi', 'networking'] },
  { id: 61, topic: 'CN', subtopic: 'Basics', difficulty: 'EASY', questionText: 'What is an IP address and what is its purpose?', tags: ['ip', 'networking'] },
  { id: 62, topic: 'CN', subtopic: 'Basics', difficulty: 'EASY', questionText: 'What is the difference between a router and a switch?', tags: ['hardware', 'networking'] },
  { id: 63, topic: 'CN', subtopic: 'Protocols', difficulty: 'EASY', questionText: 'What is DNS and how does it work?', tags: ['dns', 'protocols'] },
  { id: 64, topic: 'CN', subtopic: 'Protocols', difficulty: 'EASY', questionText: 'What is DHCP (Dynamic Host Configuration Protocol)?', tags: ['dhcp', 'protocols'] },

  // CN - MEDIUM (5)
  { id: 17, topic: 'CN', subtopic: 'Protocols', difficulty: 'MEDIUM', questionText: 'Explain the difference between TCP and UDP. Provide an example use case for each.', tags: ['tcp', 'udp', 'transport'] },
  { id: 18, topic: 'CN', subtopic: 'Routing', difficulty: 'MEDIUM', questionText: 'How does the Address Resolution Protocol (ARP) work to map IP addresses to MAC addresses?', tags: ['arp', 'mac', 'ip'] },
  { id: 19, topic: 'CN', subtopic: 'HTTP', difficulty: 'MEDIUM', questionText: 'Describe the TLS handshake process when establishing a secure HTTPS connection.', tags: ['https', 'tls', 'security'] },
  { id: 65, topic: 'CN', subtopic: 'Protocols', difficulty: 'MEDIUM', questionText: 'Explain the TCP 3-way handshake process.', tags: ['tcp', 'handshake'] },
  { id: 66, topic: 'CN', subtopic: 'Addressing', difficulty: 'MEDIUM', questionText: 'What is subnetting and why is it used in IP networks?', tags: ['subnetting', 'ip'] },

  // CN - HARD (5)
  { id: 20, topic: 'CN', subtopic: 'Architecture', difficulty: 'HARD', questionText: 'How does the Border Gateway Protocol (BGP) handle routing between different autonomous systems on the internet?', tags: ['bgp', 'routing', 'internet'] },
  { id: 67, topic: 'CN', subtopic: 'Congestion Control', difficulty: 'HARD', questionText: 'Explain TCP congestion control mechanisms like slow start and congestion avoidance.', tags: ['tcp', 'congestion'] },
  { id: 68, topic: 'CN', subtopic: 'Security', difficulty: 'HARD', questionText: 'How do DDOS mitigation strategies like BGP Anycast work?', tags: ['security', 'ddos', 'bgp'] },
  { id: 69, topic: 'CN', subtopic: 'Protocols', difficulty: 'HARD', questionText: 'Describe how HTTP/3 differs from HTTP/2 and the role of QUIC.', tags: ['http3', 'quic'] },
  { id: 70, topic: 'CN', subtopic: 'Architecture', difficulty: 'HARD', questionText: 'What is Network Address Translation (NAT) traversal and how does STUN/TURN facilitate it?', tags: ['nat', 'webrtc'] },

  // OOP - EASY (5)
  { id: 21, topic: 'OOP', subtopic: 'Core Concepts', difficulty: 'EASY', questionText: 'What are the four fundamental principles of Object-Oriented Programming?', tags: ['oop', 'principles'] },
  { id: 71, topic: 'OOP', subtopic: 'Core Concepts', difficulty: 'EASY', questionText: 'What is a class and what is an object?', tags: ['oop', 'basics'] },
  { id: 72, topic: 'OOP', subtopic: 'Core Concepts', difficulty: 'EASY', questionText: 'What is method overloading?', tags: ['overloading', 'polymorphism'] },
  { id: 73, topic: 'OOP', subtopic: 'Core Concepts', difficulty: 'EASY', questionText: 'Explain the concept of encapsulation.', tags: ['encapsulation', 'principles'] },
  { id: 74, topic: 'OOP', subtopic: 'Core Concepts', difficulty: 'EASY', questionText: 'What is a constructor in OOP?', tags: ['constructor', 'basics'] },

  // OOP - MEDIUM (5)
  { id: 22, topic: 'OOP', subtopic: 'Inheritance vs Composition', difficulty: 'MEDIUM', questionText: 'Explain the principle of "favor composition over inheritance" and why it leads to better software design.', tags: ['design', 'composition'] },
  { id: 23, topic: 'OOP', subtopic: 'Polymorphism', difficulty: 'MEDIUM', questionText: 'What is the difference between compile-time polymorphism and runtime polymorphism?', tags: ['polymorphism', 'overloading', 'overriding'] },
  { id: 24, topic: 'OOP', subtopic: 'Interfaces', difficulty: 'MEDIUM', questionText: 'Explain the difference between an interface and an abstract class. When would you use one over the other?', tags: ['interface', 'abstract-class'] },
  { id: 75, topic: 'OOP', subtopic: 'SOLID', difficulty: 'MEDIUM', questionText: 'Explain the Single Responsibility Principle.', tags: ['solid', 'design'] },
  { id: 76, topic: 'OOP', subtopic: 'Design Patterns', difficulty: 'MEDIUM', questionText: 'What is the Factory design pattern and when should it be used?', tags: ['design-patterns', 'factory'] },

  // OOP - HARD (5)
  { id: 25, topic: 'OOP', subtopic: 'Design Patterns', difficulty: 'HARD', questionText: 'Describe the Singleton design pattern. What are the common pitfalls and thread-safety issues associated with it?', tags: ['singleton', 'design-patterns'] },
  { id: 77, topic: 'OOP', subtopic: 'SOLID', difficulty: 'HARD', questionText: 'Explain the Liskov Substitution Principle and provide an example of violating it.', tags: ['solid', 'lsp'] },
  { id: 78, topic: 'OOP', subtopic: 'SOLID', difficulty: 'HARD', questionText: 'What is the Dependency Inversion Principle?', tags: ['solid', 'dip'] },
  { id: 79, topic: 'OOP', subtopic: 'Design Patterns', difficulty: 'HARD', questionText: 'Describe the Observer pattern and how it implements event-driven architectures.', tags: ['design-patterns', 'observer'] },
  { id: 80, topic: 'OOP', subtopic: 'Memory Management', difficulty: 'HARD', questionText: 'How does garbage collection impact object-oriented applications, and what are weak references?', tags: ['memory', 'garbage-collection'] },

  // System Design - EASY (5)
  { id: 26, topic: 'System Design', subtopic: 'Scalability', difficulty: 'EASY', questionText: 'What is the difference between vertical scaling and horizontal scaling?', tags: ['scaling', 'architecture'] },
  { id: 81, topic: 'System Design', subtopic: 'Basics', difficulty: 'EASY', questionText: 'What is a load balancer?', tags: ['load-balancer', 'basics'] },
  { id: 82, topic: 'System Design', subtopic: 'Basics', difficulty: 'EASY', questionText: 'What is the difference between a monolithic and microservices architecture?', tags: ['architecture', 'microservices'] },
  { id: 83, topic: 'System Design', subtopic: 'Basics', difficulty: 'EASY', questionText: 'What is a CDN (Content Delivery Network)?', tags: ['cdn', 'performance'] },
  { id: 84, topic: 'System Design', subtopic: 'Databases', difficulty: 'EASY', questionText: 'What is the difference between SQL and NoSQL databases?', tags: ['databases', 'sql', 'nosql'] },

  // System Design - MEDIUM (5)
  { id: 27, topic: 'System Design', subtopic: 'Load Balancing', difficulty: 'MEDIUM', questionText: 'How does a load balancer work, and what are some common load balancing algorithms?', tags: ['load-balancer', 'algorithms'] },
  { id: 28, topic: 'System Design', subtopic: 'Caching', difficulty: 'MEDIUM', questionText: 'Explain the differences between Write-Through, Write-Around, and Write-Back caching strategies.', tags: ['cache', 'performance'] },
  { id: 85, topic: 'System Design', subtopic: 'Databases', difficulty: 'MEDIUM', questionText: 'What is database replication and how does it improve system reliability?', tags: ['databases', 'replication'] },
  { id: 86, topic: 'System Design', subtopic: 'Communication', difficulty: 'MEDIUM', questionText: 'Explain the difference between REST and gRPC.', tags: ['api', 'rest', 'grpc'] },
  { id: 87, topic: 'System Design', subtopic: 'Message Queues', difficulty: 'MEDIUM', questionText: 'Why would you use a message queue like RabbitMQ or Kafka in a system design?', tags: ['message-queue', 'asynchronous'] },

  // System Design - HARD (5)
  { id: 29, topic: 'System Design', subtopic: 'Databases', difficulty: 'HARD', questionText: 'How does database sharding work, and what are the main challenges in maintaining a sharded database architecture?', tags: ['sharding', 'distributed-systems'] },
  { id: 30, topic: 'System Design', subtopic: 'Microservices', difficulty: 'HARD', questionText: 'Explain the saga pattern for managing distributed transactions across multiple microservices.', tags: ['microservices', 'saga', 'transactions'] },
  { id: 88, topic: 'System Design', subtopic: 'Scalability', difficulty: 'HARD', questionText: 'What is consistent hashing and how does it solve rehashing issues in distributed caches?', tags: ['hashing', 'caching'] },
  { id: 89, topic: 'System Design', subtopic: 'Architecture', difficulty: 'HARD', questionText: 'How would you design a rate limiter for a highly distributed API?', tags: ['rate-limiter', 'system-design'] },
  { id: 90, topic: 'System Design', subtopic: 'Architecture', difficulty: 'HARD', questionText: 'Design a system like Twitter: how do you optimize the feed generation for users with millions of followers?', tags: ['architecture', 'twitter', 'optimization'] }
];
