import { parseAnalyticalIntent } from './src/services/analyticalQueryService';

const testQueries = [
  "how many worklets from VIT have good and poor status ??",
  "how many worklets have excellent and average status",
  "how many worklets from VIT with good and poor and average status",
  "how many worklets from SRM with poor status"
];

console.log('\n[TEST] TESTING MULTI-VALUE COLLECTION FIX\n');
console.log('='.repeat(80));

for (const query of testQueries) {
  console.log(`\nQuery: "${query}"`);
  try {
    const parsed = parseAnalyticalIntent(query);
    console.log(`  Type: ${parsed.type}`);
    console.log(`  Field: ${parsed.field}`);
    
    if (parsed.constraints && parsed.constraints.length > 0) {
      console.log(`  Constraints: ${parsed.constraints.length}`);
      for (let i = 0; i < parsed.constraints.length; i++) {
        const c = parsed.constraints[i];
        console.log(`    [${i}] ${c.field}: [${c.values.join(', ')}] (multiValue: ${c.multiValue})`);
      }
    } else if (parsed.values && parsed.values.length > 0) {
      console.log(`  Values: [${parsed.values.join(', ')}]`);
      console.log(`  MultiValue: ${parsed.multiValue}`);
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
}

console.log('\n' + '='.repeat(80));
