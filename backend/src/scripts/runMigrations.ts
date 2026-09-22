import { runMigrations } from '../db/migrator.ts';
import { closeDatabaseConnections } from '../db/index.ts';

async function main() {
  console.log('====================================================');
  console.log('Portfolio CMS - Database Migration Runner');
  console.log('====================================================');

  try {
    const result = await runMigrations();
    console.log('\n--- Migration Summary ---');
    console.log(`Success: ${result.success ? 'YES' : 'NO'}`);
    console.log(`Message: ${result.message}`);
    console.log(`Total Migration Files: ${result.totalMigrations}`);
    console.log(`Newly Applied: ${result.appliedCount}`);
    console.log(`Previously Applied / Skipped: ${result.skippedCount}`);

    if (result.appliedMigrations.length > 0) {
      console.log('\nApplied files:');
      result.appliedMigrations.forEach((m) => console.log(`  - ${m}`));
    }

    if (!result.success) {
      if (result.error) {
        console.error(`Error details: ${result.error}`);
      }
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error('Fatal migration error:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await closeDatabaseConnections();
  }
}

main();
