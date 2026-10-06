import { execSync } from 'child_process';

interface SuiteResult {
  name: string;
  command: string;
  passed: boolean;
  output: string;
  durationMs: number;
}

const testSuites = [
  { name: 'Step 2: Database Schema Integrity', command: 'npm run test:db' },
  { name: 'Step 3: JWT Authentication & Authz', command: 'npm run test:auth' },
  { name: 'Step 4-6: CMS & Admin Foundation', command: 'npm run test:admin' },
  { name: 'Step 7: About & Skills CMS', command: 'npm run test:about-skills' },
  { name: 'Step 8: Projects Showcase CMS', command: 'npm run test:projects' },
  { name: 'Step 9: Blogs & Publishing CMS', command: 'npm run test:blogs' },
  { name: 'Step 10: Experience Timeline CMS', command: 'npm run test:experience' },
  { name: 'Step 11: Testimonials Reviews CMS', command: 'npm run test:testimonials' },
  { name: 'Step 12: Services Offerings CMS', command: 'npm run test:services' },
  { name: 'Step 13: Media & Storage CMS', command: 'npm run test:media' },
  { name: 'Step 14: Contact Messages CMS', command: 'npm run test:messages' },
  { name: 'Step 15: Public Client & Home Showcase', command: 'npm run test:public' },
  { name: 'Step 16: Dedicated Public Pages', command: 'npm run test:public-pages' },
  { name: 'Step 17: Production Deployment Readiness', command: 'npm run test:deployment' },
  { name: 'Step 18: Live API & Production Endpoints', command: 'npm run test:live' },
  { name: 'Step 19: Pool Consistency & Isolation', command: 'npm run test:consistency' },
];

console.log('================================================================');
console.log('Portfolio CMS - Full Core Project Audit & Test Runner');
console.log('================================================================\n');

const results: SuiteResult[] = [];

for (const suite of testSuites) {
  const start = Date.now();
  process.stdout.write(`Running: ${suite.name.padEnd(45)} `);
  try {
    const output = execSync(suite.command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    const durationMs = Date.now() - start;
    results.push({ name: suite.name, command: suite.command, passed: true, output, durationMs });
    console.log(`✓ PASS (${(durationMs / 1000).toFixed(2)}s)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const output = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + (err.message || '');
    results.push({ name: suite.name, command: suite.command, passed: false, output, durationMs });
    console.log(`✗ FAIL (${(durationMs / 1000).toFixed(2)}s)`);
  }
}

console.log('\n================================================================');
console.log('Summary of Test Suites:');
console.log('================================================================');

let allPassed = true;
for (const r of results) {
  console.log(`[${r.passed ? '✓ PASS' : '✗ FAIL'}] ${r.name}`);
  if (!r.passed) {
    allPassed = false;
    console.error(`\nFailure Details for ${r.name}:\n${r.output}\n`);
  }
}

const passCount = results.filter((r) => r.passed).length;
console.log(`\nTotal Test Suites: ${passCount}/${results.length} Passed`);
console.log('================================================================\n');

if (!allPassed) {
  process.exit(1);
}
