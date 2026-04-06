// Test for multi-status compound query fix
import { parseAnalyticalIntent, isAnalyticalQuery } from './src/services/analyticalQueryService';

const testCases = [
  {
    query: "how many worklets from VIT have good and poor status ??",
    expectedType: 'count_filtered',
    expectedIsCompound: true,
    expectedConstraints: 2,
    expectedFields: ['college', 'status'],
    expectedStatusValues: ['good', 'poor'],
    description: "Multi-status with college - THE FIX TARGET"
  },
  {
    query: "How many worklets from SRM with good and excellent status",
    expectedType: 'count_filtered',
    expectedIsCompound: true,
    expectedConstraints: 2,
    expectedFields: ['college', 'status'],
    expectedStatusValues: ['good', 'excellent'],
    description: "Multi-status with college using 'with' separator"
  },
  {
    query: "How many worklets from VIT and PSG college",
    expectedType: 'count_filtered',
    expectedIsCompound: false, // Same field, should consolidate to multi-value
    expectedConstraints: 1,
    expectedFields: ['college'],
    expectedCollegeValues: ['vit', 'psg'],
    description: "Multi-value college (should consolidate the AND)"
  },
  {
    query: "How many have good and poor status",
    expectedType: 'count_filtered',
    expectedIsCompound: false, // Single field with multi-value
    expectedConstraints: 0, // No constraints needed for single-field multi-value
    description: "Single field multi-value (no compound)"
  }
];

let passed = 0;
let failed = 0;

console.log(`\n${'═'.repeat(100)}`);
console.log(`MULTI-STATUS COMPOUND QUERY FIX VALIDATION TEST`);
console.log(`${'═'.repeat(100)}\n`);

for (const testCase of testCases) {
  console.log(`\n📋 TEST: ${testCase.description}`);
  console.log(`➤ Query: "${testCase.query}"`);
  
  try {
    const isAnalytical = isAnalyticalQuery(testCase.query);
    if (!isAnalytical) {
      console.log(`❌ FAILED: Query not recognized as analytical`);
      failed++;
      continue;
    }

    const intent = parseAnalyticalIntent(testCase.query);
    
    let testPassed = true;
    const failures: string[] = [];

    // Check type
    if (intent.type !== testCase.expectedType) {
      failures.push(`Expected type=${testCase.expectedType}, got ${intent.type}`);
      testPassed = false;
    }

    // Check isCompound
    if (testCase.expectedIsCompound !== undefined && intent.isCompound !== testCase.expectedIsCompound) {
      failures.push(`Expected isCompound=${testCase.expectedIsCompound}, got ${intent.isCompound}`);
      testPassed = false;
    }

    // Check constraints length
    if (testCase.expectedConstraints > 0) {
      if (!intent.constraints || intent.constraints.length !== testCase.expectedConstraints) {
        failures.push(`Expected ${testCase.expectedConstraints} constraints, got ${intent.constraints?.length || 0}`);
        testPassed = false;
      } else {
        // Check constraint fields
        const constraintFields = intent.constraints.map(c => c.field);
        for (const expectedField of testCase.expectedFields) {
          if (!constraintFields.includes(expectedField)) {
            failures.push(`Expected constraint field "${expectedField}" not found`);
            testPassed = false;
          }
        }

        // Check status values if provided
        if (testCase.expectedStatusValues) {
          const statusConstraint = intent.constraints.find(c => c.field === 'status');
          if (statusConstraint) {
            const values = statusConstraint.values.map(v => v.toLowerCase());
            const expectedValues = testCase.expectedStatusValues.map(v => v.toLowerCase());
            for (const expectedValue of expectedValues) {
              if (!values.includes(expectedValue)) {
                failures.push(`Expected status value "${expectedValue}" not found in [${values.join(', ')}]`);
                testPassed = false;
              }
            }
            if (statusConstraint.values.length !== testCase.expectedStatusValues.length) {
              failures.push(`Expected ${testCase.expectedStatusValues.length} status values, got ${statusConstraint.values.length}`);
              testPassed = false;
            }
          }
        }

        // Check college values if provided
        if (testCase.expectedCollegeValues) {
          const collegeConstraint = intent.constraints.find(c => c.field === 'college');
          if (collegeConstraint) {
            const values = collegeConstraint.values.map(v => v.toLowerCase());
            for (const expectedValue of testCase.expectedCollegeValues) {
              if (!values.some(v => v.includes(expectedValue.toLowerCase()))) {
                failures.push(`Expected college value "${expectedValue}" not found in [${values.join(', ')}]`);
                testPassed = false;
              }
            }
          }
        }
      }
    }

    if (testPassed) {
      console.log(`✅ PASSED`);
      if (intent.constraints && intent.constraints.length > 0) {
        for (let i = 0; i < intent.constraints.length; i++) {
          const c = intent.constraints[i];
          console.log(`   Constraint ${i+1}: ${c.field} = [${c.values.join(', ')}]${c.multiValue ? ' (multi-value)' : ''}`);
        }
      } else {
        console.log(`   Type: ${intent.type}`);
        if (intent.multiValue) {
          console.log(`   Values: [${intent.values?.join(', ')}] (multi-value)`);
        } else {
          console.log(`   Value: ${intent.value}`);
        }
      }
      passed++;
    } else {
      console.log(`❌ FAILED:`);
      for (const failure of failures) {
        console.log(`   - ${failure}`);
      }
      failed++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${(error as Error).message}`);
    failed++;
  }
}

console.log(`\n${'═'.repeat(100)}`);
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`${'═'.repeat(100)}\n`);

process.exit(failed > 0 ? 1 : 0);
