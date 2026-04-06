// Quick test for the three problematic queries
import { parseAnalyticalIntent, isAnalyticalQuery } from './src/services/analyticalQueryService';

const issues = [
  {
    query: "How many worklets are from VIT and PSG college ?",
    expected: "Multi-value college (VIT, PSG)",
  },
  {
    query: "How many worklets from SRM with poor status",
    expected: "Compound: college=SRM, status=poor",
  },
  {
    query: "How many worklets from VIT with excellent status ?",
    expected: "Compound: college=VIT, status=excellent",
  },
];

console.log('🔧 TESTING PROBLEMATIC QUERIES\n' + '═'.repeat(80) + '\n');

for (const issue of issues) {
  console.log(`📋 Query: "${issue.query}"`);
  console.log(`   Expected: ${issue.expected}`);

  try {
    const isAnalytical = isAnalyticalQuery(issue.query);
    if (!isAnalytical) {
      console.log(`   ❌ NOT detected as analytical\n`);
      continue;
    }

    const intent = parseAnalyticalIntent(issue.query);
    console.log(`   Type: ${intent.type}`);
    
    if (intent.isCompound && intent.constraints) {
      console.log(`   ✓ COMPOUND QUERY with ${intent.constraints.length} constraints:`);
      for (let i = 0; i < intent.constraints.length; i++) {
        const c = intent.constraints[i];
        console.log(`     └─ ${i + 1}. ${c.field} = [${c.values.join(', ')}] ${c.multiValue ? '(multi)' : ''}`);
      }
    } else {
      console.log(`   ✓ SINGLE-FIELD QUERY`);
      console.log(`     - Field: ${intent.field}`);
      console.log(`     - Values: [${intent.values?.join(', ') || intent.value}]`);
      console.log(`     - MultiValue: ${intent.multiValue ? 'YES' : 'NO'}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${(error as Error).message}`);
  }

  console.log();
}

console.log('═'.repeat(80));
