import { verifyDatabase, REQUIRED_TABLES } from '../db/verifier.ts';
import { closeDatabaseConnections } from '../db/index.ts';

async function main() {
  console.log('====================================================');
  console.log('Portfolio CMS - Database Schema & Integrity Verifier');
  console.log('====================================================');

  try {
    const report = await verifyDatabase();

    console.log(`\nDatabase connection: ${report.databaseConnected ? 'PASS' : 'FAIL'}`);
    console.log(`Migration status: ${report.migrationStatus}`);

    console.log('\n--- Table Existence Checks ---');
    for (const table of REQUIRED_TABLES) {
      console.log(`${table}: ${report.tableResults[table]}`);
    }

    if (report.crudTestResult) {
      console.log('\n--- CRUD & Constraint Operations Test ---');
      console.log(`Basic INSERT: ${report.crudTestResult.insert}`);
      console.log(`Basic SELECT: ${report.crudTestResult.select}`);
      console.log(`Basic UPDATE: ${report.crudTestResult.update}`);
      console.log(`Basic DELETE: ${report.crudTestResult.delete}`);
      console.log(`Unique Constraints: ${report.crudTestResult.uniqueConstraint}`);
      console.log(`Foreign Key Relations: ${report.crudTestResult.foreignKey}`);
    }

    console.log('\n--- Overall Result ---');
    console.log(`Verification: ${report.summary}`);
    console.log(`Message: ${report.message}`);
    console.log('====================================================');

    if (report.summary !== 'PASS') {
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error('Fatal verification error:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await closeDatabaseConnections();
  }
}

main();
