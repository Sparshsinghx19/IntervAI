export type Option = {
  id: string;
  label: string;
  description?: string;
};

export const interviewTypes: Option[] = [
  { id: 'technical', label: 'Technical', description: 'Coding algorithms and problem-solving' },
  { id: 'behavioral', label: 'Behavioral', description: 'Past experiences and soft skills' },
  { id: 'hr', label: 'HR', description: 'Culture fit and general background' },
];

export const difficulties: Option[] = [
  { id: 'easy', label: 'Easy', description: 'Fundamentals and core concepts' },
  { id: 'medium', label: 'Medium', description: 'Standard interview difficulty' },
  { id: 'hard', label: 'Hard', description: 'Complex edge cases and optimization' },
];

export const focusAreas: Option[] = [
  { id: 'dsa', label: 'Data Structures & Algorithms' },
  { id: 'os', label: 'Operating Systems' },
  { id: 'dbms', label: 'DBMS' },
  { id: 'networks', label: 'Computer Networks' },
  { id: 'oop', label: 'OOP' },
  { id: 'system-design', label: 'System Design' },
];

export const questionCounts: Option[] = [
  { id: '5', label: '5 Questions' },
  { id: '10', label: '10 Questions' },
  { id: '15', label: '15 Questions' },
];
