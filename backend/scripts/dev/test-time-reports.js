const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// You'll need to replace this with a valid token from your login
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE';

const config = {
    headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
    }
};

const testEndpoints = async () => {
    console.log('Testing Time Reports Endpoints\n');
    console.log('='.repeat(60));

    try {
        // Test 1: Overview (Allocation)
        console.log('\n1. Testing /allocation (Overview)...');
        const allocBody = {
            teams: [],
            projects: [],
            categories: [],
            date_range: [
                new Date(Date.now() - 7 * 86400000).toISOString(),
                new Date().toISOString()
            ],
            archived: false
        };
        
        const allocRes = await axios.post(`${API_BASE}/reporting/allocation/?archived=false`, allocBody, config);
        console.log('   Status:', allocRes.status);
        console.log('   Projects:', allocRes.data?.body?.projects?.length || 0);
        console.log('   Users:', allocRes.data?.body?.users?.length || 0);

        // Test 2: Time Reports - Projects
        console.log('\n2. Testing /time-reports/projects...');
        const projBody = {
            teams: [],
            projects: [],
            categories: [],
            date_range: [
                new Date(Date.now() - 7 * 86400000).toISOString(),
                new Date().toISOString()
            ]
        };
        
        const projRes = await axios.post(`${API_BASE}/reporting/time-reports/projects`, projBody, config);
        console.log('   Status:', projRes.status);
        console.log('   Result count:', Array.isArray(projRes.data?.body) ? projRes.data.body.length : 0);

        // Test 3: Time Reports - Members
        console.log('\n3. Testing /time-reports/members...');
        const membBody = {
            teams: [],
            projects: [],
            categories: [],
            date_range: [
                new Date(Date.now() - 7 * 86400000).toISOString(),
                new Date().toISOString()
            ]
        };
        
        const membRes = await axios.post(`${API_BASE}/reporting/time-reports/members`, membBody, config);
        console.log('   Status:', membRes.status);
        console.log('   Result count:', Array.isArray(membRes.data?.body) ? membRes.data.body.length : 0);

        // Test 4: Estimated vs Actual
        console.log('\n4. Testing /time-reports/estimated-vs-actual...');
        const estBody = {
            teams: [],
            projects: [],
            categories: [],
            date_range: [
                new Date(Date.now() - 7 * 86400000).toISOString(),
                new Date().toISOString()
            ],
            duration: 'custom'
        };
        
        const estRes = await axios.post(`${API_BASE}/reporting/time-reports/estimated-vs-actual`, estBody, config);
        console.log('   Status:', estRes.status);
        console.log('   Result count:', Array.isArray(estRes.data?.body) ? estRes.data.body.length : 0);

        console.log('\n' + '='.repeat(60));
        console.log('✅ All endpoints responded successfully!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
};

// Note: You need to get a valid token first
console.log('⚠️  To run this test:');
console.log('1. Login to the app in the browser');
console.log('2. Open DevTools → Application → Local Storage');
console.log('3. Copy the auth token');
console.log('4. Replace AUTH_TOKEN in this file');
console.log('5. Run: node test-time-reports.js\n');

// Uncomment to run if you have a valid token
// testEndpoints();
