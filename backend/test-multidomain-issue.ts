// Test for multi-domain collection in compound queries
// Issue: "How many worklets are from SRM and have domains as IOT and Computer Vision ??"
// Expected: Both IOT and Computer Vision domains detected
// Actual (Before Fix): Only IOT detected

import { parseAnalyticalIntent, isAnalyticalQuery } from './src/services/analyticalQueryService';

console.log(`\n${'═'.repeat(100)}`);
console.log(`MULTI-DOMAIN COLLECTION TEST - Similar to Multi-Status Issue`);
console.log(`${'═'.repeat(100)}\n`);

const testCases = [
  {
    query: "How many worklets are from SRM and have domains as IOT and Computer Vision ??",
    expectedDomains: ['iot', 'computer vision'],
    description: "Multi-domain with college - THE ISSUE"
  },
  {
    query: "How many worklets from VIT with IoT and AI domain ?",
    expectedDomains: ['iot', 'ai'],
    description: "Multi-domain with college using 'with' separator"
  },
  {
    query: "How many worklets have IoT and ML and Cloud domains",
    expectedDomains: ['iot', 'ml', 'cloud'],
    description: "Triple domain without college field"
  },
  {
    query: "How many from BITS with Computer Vision and NLP domain",
    expectedDomains: ['computer vision', 'nlp'],
    description: "Multi-word domain with another domain"
  }
];

let passed = 0;
let failed = 0;

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

    // Check if compound or multi-value
    if (intent.isCompound) {
      // Compound query - find domain constraint
      const domainConstraint = intent.constraints?.find(c => c.field === 'domain');
      if (!domainConstraint) {
        failures.push(`Expected domain constraint in compound query`);
        testPassed = false;
      } else {
        const domainsLower = domainConstraint.values.map(v => v.toLowerCase());
        for (const expectedDomain of testCase.expectedDomains) {
          if (!domainsLower.some(v => v.includes(expectedDomain.toLowerCase()))) {
            failures.push(`Expected domain "${expectedDomain}" not found in [${domainsLower.join(', ')}]`);
            testPassed = false;
          }
        }
        
        if (domainConstraint.values.length !== testCase.expectedDomains.length) {
          failures.push(`Expected ${testCase.expectedDomains.length} domains, got ${domainConstraint.values.length}`);
          testPassed = false;
        }
        
        if (!domainConstraint.multiValue) {
          failures.push(`Domain constraint should have multiValue=true`);
          testPassed = false;
        }
      }
    } else {
      // Single field multi-value query
      if (!intent.multiValue) {
        failures.push(`Expected multiValue=true`);
        testPassed = false;
      }
      
      if (!intent.field?.includes('domain')) {
        failures.push(`Expected domain field, got ${intent.field}`);
        testPassed = false;
      }
      
      if (intent.values) {
        const valuesLower = intent.values.map(v => v.toLowerCase());
        for (const expectedDomain of testCase.expectedDomains) {
          if (!valuesLower.some(v => v.includes(expectedDomain.toLowerCase()))) {
            failures.push(`Expected domain "${expectedDomain}" not found in [${valuesLower.join(', ')}]`);
            testPassed = false;
          }
        }
        
        if (intent.values.length !== testCase.expectedDomains.length) {
          failures.push(`Expected ${testCase.expectedDomains.length} domains, got ${intent.values.length}`);
          testPassed = false;
        }
      } else {
        failures.push(`No values found for domain field`);
        testPassed = false;
      }
    }

    if (testPassed) {
      console.log(`✅ PASSED`);
      if (intent.isCompound && intent.constraints) {
        const domainConstraint = intent.constraints.find(c => c.field === 'domain');
        if (domainConstraint) {
          console.log(`   Domains: [${domainConstraint.values.join(', ')}] (multi-value)`);
        }
      } else if (intent.values) {
        console.log(`   Domains: [${intent.values.join(', ')}] (multi-value)`);
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
