import { smartRetry, SmartRetry } from 'adaptive-retry';

// Define the API response type
interface University {
  name: string;
  country: string;
  domains: string[];
  web_pages: string[];
  alpha_two_code: string;
}

// Test with real Universities API
async function testRealAPI() {
  console.log('--- Testing Real API: Universities API ---\n');

  // Example 1: Simple successful call
  console.log('1. Simple API call:');
  try {
    const result = await smartRetry<University[]>(
      async () => {
        const response = await fetch('http://universities.hipolabs.com/search?country=United+States&name=stanford');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<University[]>;
      },
      { 
        endpoint: 'universities-api',
        timeout: 10000,
      }
    );
    
    console.log(`   ✅ Success in ${result.attempts} attempt(s), ${result.totalTime}ms`);
    console.log(`   Found ${result.data.length} universities`);
    console.log(`   First result: ${result.data[0]?.name || 'N/A'}\n`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}\n`);
  }

  // Example 2: With retry logging
  console.log('2. API call with retry monitoring:');
  try {
    const result = await smartRetry<University[]>(
      async () => {
        const response = await fetch('http://universities.hipolabs.com/search?country=India&name=delhi');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<University[]>;
      },
      { 
        endpoint: 'universities-api-india',
        timeout: 10000,
        maxRetries: 3,
        onRetry: (info: { attempt: any; errorCategory: any; delay: any; }) => {
          console.log(`   ↳ Retry ${info.attempt}: ${info.errorCategory}, waiting ${info.delay}ms`);
        }
      }
    );
    
    console.log(`   ✅ Success in ${result.attempts} attempt(s), ${result.totalTime}ms`);
    console.log(`   Found ${result.data.length} universities in India\n`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}\n`);
  }

  // Example 3: Test with intentionally bad URL (to see retries)
  console.log('3. Testing retry behavior with bad endpoint:');
  try {
    const result = await smartRetry<any>(
      async () => {
        const response = await fetch('http://universities.hipolabs.com/invalid-endpoint');
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`) as any;
          error.status = response.status;
          throw error;
        }
        return response.json() as Promise<any>;
      },
      { 
        endpoint: 'bad-endpoint',
        timeout: 5000,
        maxRetries: 3,
        onRetry: (info: { attempt: any; errorCategory: any; delay: any; successProbability: number; }) => {
          console.log(`   ↳ Retry ${info.attempt}: ${info.errorCategory}, waiting ${info.delay}ms`);
          console.log(`     Success probability: ${(info.successProbability * 100).toFixed(1)}%`);
        }
      }
    );
    console.log(`   ✅ Unexpected success\n`);
  } catch (error: any) {
    console.log(`   ❌ Failed as expected: ${error.message}\n`);
  }

  // Example 4: Multiple calls to see stats
  console.log('4. Multiple calls with stats tracking:');
  const retry = new SmartRetry();
  
  const countries = ['Germany', 'France', 'Japan', 'Brazil', 'Australia'];
  
  for (const country of countries) {
    try {
      const result = await retry.execute<University[]>(
        async () => {
          const response = await fetch(`http://universities.hipolabs.com/search?country=${encodeURIComponent(country)}&limit=5`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<University[]>;
        },
        { 
          endpoint: 'universities-multi',
          timeout: 10000,
        }
      );
      console.log(`   ${country}: ${result.data.length} universities (${result.totalTime}ms)`);
    } catch (error: any) {
      console.log(`   ${country}: ❌ ${error.message}`);
    }
  }

  // Show stats
  const stats = retry.getStats('universities-multi');
  console.log(`\n   📊 Stats for 'universities-multi':`);
  console.log(`   - Avg Recovery Time: ${stats?.avgRecoveryTime}ms`);
  console.log(`   - Consecutive Failures: ${stats?.consecutiveFailures}`);
  console.log(`   - Last Success: ${stats?.lastSuccessTime ? new Date(stats.lastSuccessTime).toISOString() : 'N/A'}`);
}

// Example 5: Timeout test
async function testTimeout() {
  console.log('\n5. Testing timeout behavior:');
  
  try {
    const result = await smartRetry<University[]>(
      async () => {
        const response = await fetch('http://universities.hipolabs.com/search?country=United+States');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<University[]>;
      },
      { 
        endpoint: 'timeout-test',
        timeout: 50, // Very short timeout
        maxRetries: 2,
        onRetry: (info: { attempt: any; errorCategory: any; delay: any; }) => {
          console.log(`   ↳ Retry ${info.attempt}: ${info.errorCategory}, waiting ${info.delay}ms`);
        }
      }
    );
    console.log(`   ✅ Success (fast response): ${result.data.length} universities\n`);
  } catch (error: any) {
    console.log(`   ❌ ${error.message}\n`);
  }
}

// Run all tests
(async () => {
  await testRealAPI();
  await testTimeout();
  
  console.log('\n✅ All tests completed!');
})();