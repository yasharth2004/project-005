import { executeAnalyticalQuery } from './src/services/analyticalQueryService';
import mongoose from 'mongoose';

async function main() {
  try {
    await mongoose.connect('mongodb://localhost:27017/samsung-prism');
    console.log('✅ MongoDB connected\n');

    const tests = [
      'How many worklets have good and bad status?',
      'How many worklets have good/bad status?',
      'Count worklets with good, bad, average status',
      'How many worklets have poor and average status?',
      'Total worklets that are good or bad'
    ];

    for (const q of tests) {
      console.log('\n' + '='.repeat(70));
      console.log('❓ Query:', q);
      console.log('='.repeat(70));
      try {
        const result = await executeAnalyticalQuery(q);
        console.log('✅ Is Analytical:', result.isAnalytical);
        if (result.isAnalytical) {
          console.log('📊 Answer:', result.answer);
          if (result.data?.count !== undefined) {
            console.log(`\n📈 Total Count: ${result.data.count}`);
          }
          if (result.data?.values) {
            console.log(`📈 Values Detected: ${JSON.stringify(result.data.values)}`);
          }
        }
      } catch (e: any) {
        console.log('❌ Error:', e.message);
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
