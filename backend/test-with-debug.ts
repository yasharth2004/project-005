// Debug the preprocessing for "with" queries
import { parseAnalyticalIntent } from './src/services/analyticalQueryService';

const queries = [
  "how many worklets from srm with poor status",
  "how many worklets from vit with excellent status"
];

console.log('🔍 DEBUGGING "WITH" PREPROCESSING\n');

for (const query of queries) {
  console.log(`\nQuery: "${query}"`);
  console.log('─'.repeat(80));
  
  const result = parseAnalyticalIntent(query);
  
  console.log('\nFinal result:');
  console.log(`  Type: ${result.type}`);
  console.log(`  IsCompound: ${result.isCompound}`);
  console.log(`  Field: ${result.field}`);
  console.log(`  Values: ${JSON.stringify(result.values)}`);
  console.log(`  Constraints: ${result.constraints ? result.constraints.length : 'none'}`);
}
