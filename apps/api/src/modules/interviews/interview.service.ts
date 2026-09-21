export const interviewService = {
  createInterview: (data: { title: string; type: string; difficulty: string }) => {
    // Generate a simple ID
    const id = Math.random().toString(36).substring(2, 9);
    
    // Create the in-memory interview object
    const interview = {
      id,
      title: data.title,
      type: data.type,
      difficulty: data.difficulty,
    };
    
    return interview;
  }
};
