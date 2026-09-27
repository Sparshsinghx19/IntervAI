export const questionGenerationService = {
  generateQuestions: (focusArea: string, difficulty: string, count: number, interviewId: string) => {
    const questions = [];
    
    const banks: Record<string, string[]> = {
      'DSA': ['Reverse a linked list', 'Find the middle of a linked list', 'Detect a cycle in a linked list', 'Merge two sorted lists', 'Remove Nth node from end of list', 'Valid Parentheses'],
      'OS': ['What is a process vs thread?', 'Explain virtual memory', 'What is a deadlock and how to prevent it?', 'Explain context switching', 'What is paging?'],
      'DBMS': ['What is ACID?', 'Explain normalization forms', 'What are clustered vs non-clustered indexes?', 'Explain SQL joins', 'What is a transaction?'],
      'CN': ['What is the OSI model?', 'Explain TCP vs UDP', 'How does DNS work?', 'What is a subnet mask?', 'Explain the TCP 3-way handshake'],
      'OOP': ['What is polymorphism?', 'Explain inheritance', 'What is encapsulation?', 'What is abstraction?', 'Explain SOLID principles'],
      'System Design': ['Design a URL shortener', 'Design a rate limiter', 'Design Twitter', 'Explain microservices vs monolith', 'What is consistent hashing?']
    };

    const defaultBank = ['What is ' + focusArea + '?', 'Explain core concepts of ' + focusArea, 'How is ' + focusArea + ' used in production?'];
    
    // Fallback if exactly matching key is not found
    const matchKey = Object.keys(banks).find(k => k.toLowerCase() === focusArea.toLowerCase());
    const baseQuestions = matchKey ? banks[matchKey] : defaultBank;
    
    for (let i = 0; i < count; i++) {
      questions.push({
        interviewId,
        questionText: `${baseQuestions[i % baseQuestions.length!]} (Difficulty: ${difficulty})`,
        orderIndex: i + 1,
      });
    }
    return questions;
  }
};
