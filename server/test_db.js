const { Client } = require('pg');

const regions = [
  'ap-south-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'sa-east-1',
  'ca-central-1'
];

async function testPooler(region) {
  const connectionString = `postgresql://postgres.kmdqxqkvcjrhmjrcfrun:DemonSlayer%402003@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;
  const client = new Client({ connectionString, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    console.log(`[SUCCESS] Connected to pooler in region: ${region}`);
    await client.end();
    return connectionString;
  } catch (e) {
    if (e.message.includes('tenant/user')) {
      console.log(`[FAILED] Region ${region} exists but rejected tenant (wrong region).`);
    } else if (e.code === 'ENOTFOUND') {
      // Host doesn't exist
    } else {
      console.log(`[FAILED] Region ${region}: ${e.message}`);
    }
    return null;
  }
}

async function run() {
  console.log('Testing regions for Supabase pooler...');
  for (const region of regions) {
    const res = await testPooler(region);
    if (res) {
      console.log('\nFOUND WORKING URL:\n' + res);
      process.exit(0);
    }
  }
  console.log('Could not find the correct region.');
}

run();
