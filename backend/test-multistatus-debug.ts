// Test for multi-status collection in compound queries
import { parseAnalyticalIntent, isAnalyticalQuery } from './src/services/analyticalQueryService';

const testQuery = "how many worklets from VIT have good and poor status ??";

console.log(`\n🔍 DEBUGGING MULTI-STATUS COLLECTION\n${'═'.repeat(80)}\n`);
console.log(`Query: "${testQuery}"\n`);

try {
  const isAnalytical = isAnalyticalQuery(testQuery);
  console.log(`Is analytical: ${isAnalytical}\n`);

  if (isAnalytical) {
    const intent = parseAnalyticalIntent(testQuery);
    
    console.log(`\nPARSED INTENT:`);
    console.log(`  Type: ${intent.type}`);
    console.log(`  IsCompound: ${intent.isCompound}`);
    console.log(`  Field: ${intent.field}`);
    console.log(`  Value: ${intent.value}`);
    console.log(`  Values: ${JSON.stringify(intent.values)}`);
    console.log(`  MultiValue: ${intent.multiValue}`);
    console.log(`  DbField: ${intent.dbField}`);
    
    if (intent.constraints) {
      console.log(`\n  CONSTRAINTS (${intent.constraints.length}):`);
      for (let i = 0; i < intent.constraints.length; i++) {
        const c = intent.constraints[i];
        console.log(`    ${i+1}. Field: ${c.field}`);
        console.log(`       Values: ${JSON.stringify(c.values)}`);
        console.log(`       MultiValue: ${c.multiValue}`);
      }
    }

    if (intent.isCompound && intent.constraints && intent.constraints.length > 0) {
      // Check which constraint has the status
      const statusConstraint = intent.constraints.find(c => c.field === 'status');
      if (statusConstraint) {
        console.log(`\n✓ STATUS CONSTRAINT FOUND:`);
        console.log(`  Values: ${JSON.stringify(statusConstraint.values)}`);
        console.log(`  Count: ${statusConstraint.values.length}`);
        if (statusConstraint.values.length === 2) {
          console.log(`  ✅ BOTH STATUSES DETECTED (good and poor)`);
        } else {
          console.log(`  ❌ ONLY ${statusConstraint.values.length} STATUS(ES) DETECTED`);
        }
      } else {
        console.log(`\n❌ NO STATUS CONSTRAINT FOUND`);
      }
    }
  }
} catch (error) {
  console.error(`Error: ${(error as Error).message}`);
}

console.log(`\n${'═'.repeat(80)}\n`);
