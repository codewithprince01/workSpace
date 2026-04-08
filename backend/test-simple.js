const axios = require('axios');
const BASE_URL = 'http://localhost:3000/api';

async function run() {
    try {
        console.log('Login Owner...');
        const owner = { email: 'owner_vis@test.com', password: 'password123' };
        const resO = await axios.post(`${BASE_URL}/auth/login`, owner);
        const ownerToken = resO.data.data.token;

        console.log('Get Teams...');
        const teamsRes = await axios.get(`${BASE_URL}/teams`, { headers: { Authorization: `Bearer ${ownerToken}` } });
        const teamId = teamsRes.data.body[0]._id;
        console.log('Team ID:', teamId);

        console.log('Login Guest...');
        const guest = { email: 'guest_vis@test.com', password: 'password123' };
        const resG = await axios.post(`${BASE_URL}/auth/login`, guest);
        const guestToken = resG.data.data.token;

        console.log('Get Projects for Guest (Team Filter)...');
        // Construct URL carefully
        const url = `${BASE_URL}/projects?team_id=${teamId}`;
        console.log('Fetching:', url);
        
        try {
            const projRes = await axios.get(url, { headers: { Authorization: `Bearer ${guestToken}` } });
            console.log('Status:', projRes.status);
            console.log('Full Data:', JSON.stringify(projRes.data, null, 2));
            // console.log('Body Projects:', JSON.stringify(projRes.data.body.projects.map(p => ({id: p.id, name: p.name}))));
        } catch (e) {
             console.error('Project Request Failed:', e.message);
             if (e.response) console.error('Data:', e.response.data);
        }

    } catch (e) {
        console.error('Setup Failed:', e.message);
    }
}
run();
