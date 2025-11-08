const fs = require('fs');
const path = require('path');

// Parse test output
const testLog = fs.readFileSync('reports/logs/14_test.txt', 'utf-8');
const testMatch = testLog.match(/Test Suites: (\d+) failed, (\d+) passed, (\d+) total/);
const testsMatch = testLog.match(/Tests:\s+(\d+) failed, (\d+) skipped, (\d+) passed, (\d+) total/);

const coverage = {
  language: 'node',
  totalSuites: testMatch ? parseInt(testMatch[3]) : 0,
  passedSuites: testMatch ? parseInt(testMatch[2]) : 0,
  failedSuites: testMatch ? parseInt(testMatch[1]) : 0,
  totalTests: testsMatch ? parseInt(testsMatch[4]) : 0,
  passedTests: testsMatch ? parseInt(testsMatch[3]) : 0,
  failedTests: testsMatch ? parseInt(testsMatch[1]) : 0,
  skippedTests: testsMatch ? parseInt(testsMatch[2]) : 0,
  packages: [],
  failures: []
};

// Extract failures
const failureSection = testLog.match(/Summary of all failing tests([\s\S]*?)Test Suites:/);
if (failureSection) {
  const failures = failureSection[1].matchAll(/FAIL\s+([^\n]+)\n\s+●\s+([^\n]+)\n/g);
  for (const [, suite, test] of failures) {
    coverage.failures.push({
      suite: suite.trim(),
      test: test.trim(),
      message: 'See test log for details'
    });
  }
}

fs.writeFileSync('reports/artifacts/test_coverage.json', JSON.stringify(coverage, null, 2));
console.log('Coverage analysis saved to reports/artifacts/test_coverage.json');
console.log(JSON.stringify(coverage, null, 2));
