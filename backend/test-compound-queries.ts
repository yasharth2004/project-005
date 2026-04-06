// Test file for compound multi-field queries
// Usage: npx ts-node test-compound-queries.ts

import { parseAnalyticalIntent, isAnalyticalQuery, executeAnalyticalQuery } from './src/services/analyticalQueryService';

// Test cases: compound queries combining multiple fields
const testCases = [
  // College + Status combinations
  {
    query: 'how many worklets are from SRM and have status as poor',
    description: 'College (SRM) + Status (poor)',
    expectedFields: ['college', 'status']
  },
  {
    query: 'How many worklets from VIT with excellent status',
    description: 'College (VIT) + Status (excellent)',
    expectedFields: ['college', 'status']
  },
  {
    query: 'count worklets from PSG college with good status',
    description: 'College (PSG) + Status (good)',
    expectedFields: ['college', 'status']
  },
  // College + Domain combinations
  {
    query: 'how many worklets are from SRM and have IoT domain',
    description: 'College (SRM) + Domain (IoT)',
    expectedFields: ['college', 'domain']
  },
  {
    query: 'worklets from VIT with AI domain',
    description: 'College (VIT) + Domain (AI)',
    expectedFields: ['college', 'domain']
  },
  // Domain + Status combinations
  {
    query: 'how many worklets have IoT domain and status as poor',
    description: 'Domain (IoT) + Status (poor)',
    expectedFields: ['domain', 'status']
  },
  {
    query: 'count worklets with AI domain and excellent status',
    description: 'Domain (AI) + Status (excellent)',
    expectedFields: ['domain', 'status']
  },
  // Triple combination
  {
    query: 'how many worklets from VIT college with AI domain and good status',
    description: 'College (VIT) + Domain (AI) + Status (good)',
    expectedFields: ['college', 'domain', 'status']
  },
  {
    query: 'worklets from SRM with IoT domain and poor status',
    description: 'College (SRM) + Domain (IoT) + Status (poor)',
    expectedFields: ['college', 'domain', 'status']
  },
  // College + Multi-value status
  {
    query: 'how many worklets from VIT have good and poor status',
    description: 'College (VIT) + Status (good, poor)',
    expectedFields: ['college', 'status']
  },
  // College + Multi-domain
  {
    query: 'how many worklets from PSG have IoT and AI domain',
    description: 'College (PSG) + Domain (IoT, AI)',
    expectedFields: ['college', 'domain']
  },
];

console.log('🧪 COMPOUND QUERY TESTS\n');
console.log('═'.repeat(80));

for (const testCase of testCases) {
  console.log(`\n📋 Test: ${testCase.description}`);
  console.log(`   Query: "${testCase.query}"`);

  try {
    // Check if detected as analytical
    const isAnalytical = isAnalyticalQuery(testCase.query);
    console.log(`   ✓ Is analytical: ${isAnalytical}`);

    if (isAnalytical) {
      // Parse intent
      const intent = parseAnalyticalIntent(testCase.query);
      console.log(`   ✓ Parsed type: ${intent.type}`);
      
      if (intent.isCompound) {
        console.log(`   ✓ COMPOUND QUERY DETECTED`);
        console.log(`   ✓ Number of constraints: ${intent.constraints?.length}`);
        
        if (intent.constraints) {
          for (let i = 0; i < intent.constraints.length; i++) {
            const constraint = intent.constraints[i];
            console.log(`     └─ Constraint ${i + 1}: field="${constraint.field}", values=[${constraint.values.join(', ')}]`);
          }
        }

        // Verify all expected fields are detected
        const detectedFields = intent.constraints?.map(c => c.field) || [];
        const allExpectedFound = testCase.expectedFields.every(f => detectedFields.includes(f));
        console.log(`   ${allExpectedFound ? '✅' : '❌'} All expected fields detected: ${allExpectedFound ? 'YES' : 'NO'}`);
        if (!allExpectedFound) {
          console.log(`      Expected: [${testCase.expectedFields.join(', ')}]`);
          console.log(`      Got:      [${detectedFields.join(', ')}]`);
        }
      } else {
        console.log(`   ℹ️  Single-field query (not compound)`);
        console.log(`      Field: ${intent.field}, Values: ${intent.values?.join(', ') || intent.value}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${(error as Error).message}`);
  }
}

console.log('\n' + '═'.repeat(80));
console.log('\n✅ Parsing tests completed!\n');

// ============ EXECUTION TESTS (requires MongoDB) ============
console.log('\n🔄 EXECUTION TESTS (Database queries)\n');
console.log('═'.repeat(80));

const executionTests = [
  'how many worklets are from SRM and have status as poor',
  'How many worklets from VIT with excellent status',
  'working from PSG college with IoT domain',
  'worklets from SRM with AI domain and good status',
  'count worklets from VIT having good and poor status',
];

(async () => {
  for (const query of executionTests) {
    console.log(`\n📊 Query: "${query}"`);
    try {
      const result = await executeAnalyticalQuery(query);
      if (result.isAnalytical) {
        console.log(`   ✅ Answer: ${result.answer.substring(0, 100)}...`);
        if (result.data?.count !== undefined) {
          console.log(`   📈 Count: ${result.data.count}`);
        }
        if (result.data?.constraints) {
          console.log(`   🔗 Constraints: ${result.data.constraints.length}`);
        }
      } else {
        console.log(`   ℹ️  Not detected as analytical query`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${(error as Error).message}`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('\n✅ All tests completed!\n');
  process.exit(0);
})().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
