// This script sets up the real-time collaboration feature by running migrations

console.log('Setting up real-time collaboration feature...');

// Function to make API calls
async function callApi(endpoint, method = 'GET', body = null) {
  try {
    const url = `http://localhost:3000/api/${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log(`Calling ${method} ${url}...`);
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API error: ${data.error || response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error(`API call failed: ${error.message}`);
    throw error;
  }
}

async function setupRealtime() {
  try {
    // Step 1: Run database migration
    console.log('Running database migration to create trip_events table...');
    const migrationResult = await callApi('db-migrations', 'POST');
    console.log('Migration result:', migrationResult);

    console.log('\nSetup completed successfully!');
    console.log('You can now use the real-time collaboration features.');
    console.log('See README-realtime.md for usage instructions.');
  } catch (error) {
    console.error('Setup failed:', error);
    console.log('\nPlease check the following:');
    console.log('1. Make sure the app server is running (npm run dev)');
    console.log('2. Make sure you have the necessary Supabase permissions');
    console.log('3. Check if the exec_sql function exists in your Supabase project');
  }
}

// Run setup
setupRealtime(); 