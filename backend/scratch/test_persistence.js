
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api/v1';
const PROJECT_ID = '69d73dec4ade6774a7ef5d0d'; // From the logs
const COLUMN_KEY = 'Wcf0yEFgesooLsqUANpa_'; // Example custom column key

async function testPersistence() {
    console.log('--- Testing Custom Column Persistence ---');
    
    try {
        // 1. Set to visible (ticked)
        console.log('Settig column to visible...');
        const res1 = await axios.put(`${API_BASE_URL}/custom-columns/project/${PROJECT_ID}/columns`, {
            id: COLUMN_KEY,
            pinned: true
        });
        console.log('Update Result:', res1.data.done);
        
        // 2. Fetch all columns and check if it's pinned
        console.log('Fetching columns...');
        const res2 = await axios.get(`${API_BASE_URL}/custom-columns/project/${PROJECT_ID}/columns`);
        const columns = res2.data.body;
        const target = columns.find(c => c.key === COLUMN_KEY || c._id === COLUMN_KEY);
        
        if (target) {
            console.log('Column Found!', target.name);
            console.log('Pinned Status in DB:', target.pinned);
            if (target.pinned === true) {
                console.log('✅ PERSISTENCE SUCCESSFUL');
            } else {
                console.log('❌ PERSISTENCE FAILED: Still false in DB');
            }
        } else {
            console.log('❌ COLUMN NOT FOUND IN LIST');
        }
        
    } catch (error) {
        console.error('Test Failed:', error.response?.data || error.message);
    }
}

testPersistence();
