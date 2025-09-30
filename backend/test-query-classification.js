// Test query classification
const testQueries = [
  "how to prepare for samsung prism program",
  "what is the eligibility criteria",
  "tell me about my worklet details", 
  "what is worklet 096",
  "samsung prism application requirements"
];

for (const query of testQueries) {
  const workletIdMatch = query.match(/\b0*(\d{1,3})\b/);
  const isWorkletQuery = query.toLowerCase().includes('worklet') && !!workletIdMatch;
  const isPersonalWorkletQuery = query.toLowerCase().includes('my worklet') || 
                                query.toLowerCase().includes('my project') ||
                                query.toLowerCase().includes('worklet details') ||
                                query.toLowerCase().includes('tell me about my worklet') ||
                                query.toLowerCase().includes('my worklet details');
  
  const isGeneralProgramQuery = query.toLowerCase().includes('eligibility') ||
                               query.toLowerCase().includes('criteria') ||
                               query.toLowerCase().includes('program overview') ||
                               query.toLowerCase().includes('samsung prism') ||
                               query.toLowerCase().includes('application') ||
                               query.toLowerCase().includes('requirements') ||
                               query.toLowerCase().includes('how to apply') ||
                               query.toLowerCase().includes('how to prepare') ||
                               query.toLowerCase().includes('preparation') ||
                               query.toLowerCase().includes('prism program') ||
                               query.toLowerCase().includes('getting ready') ||
                               (!query.toLowerCase().includes('worklet') && !isWorkletQuery);

  console.log(`\nQuery: "${query}"`);
  console.log(`  isWorkletQuery: ${isWorkletQuery}`);
  console.log(`  isPersonalWorkletQuery: ${isPersonalWorkletQuery}`);
  console.log(`  isGeneralProgramQuery: ${isGeneralProgramQuery}`);
  
  // Determine expected response type
  if (isGeneralProgramQuery) {
    console.log(`  → Should use: GENERAL PROGRAM DOCUMENTS`);
  } else if (isPersonalWorkletQuery) {
    console.log(`  → Should use: PERSONAL WORKLET DATA`);
  } else if (isWorkletQuery) {
    console.log(`  → Should use: SPECIFIC WORKLET DATA`);
  } else {
    console.log(`  → Should use: MIXED/OTHER`);
  }
}