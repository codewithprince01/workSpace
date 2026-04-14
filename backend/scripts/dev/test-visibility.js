const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const OWNER = { email: 'owner_vis@test.com', password: 'password123', name: 'Owner Vis' };
const GUEST = { email: 'guest_vis@test.com', password: 'password123', name: 'Guest Vis' };

async function runTest() {
  try {
    console.log('🚀 Starting Visibility Test...');

    // 1. Setup Owner
    console.log('1️⃣  Registering/Logging in Owner...');
    let ownerToken;
    try {
        await axios.post(`${BASE_URL}/auth/signup`, OWNER);
        const res = await axios.post(`${BASE_URL}/auth/login`, OWNER);
        ownerToken = res.data.data.token;
    } catch {
        const res = await axios.post(`${BASE_URL}/auth/login`, OWNER);
        ownerToken = res.data.data.token;
    }

    // 2. Create Team & Project
    console.log('2️⃣  Creating Team & Project...');
    // Default team is created on signup. Let's find it.
    const teamsRes = await axios.get(`${BASE_URL}/teams`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    const teamId = teamsRes.data.body[0]._id;
    console.log(`   Owner Team: ${teamId}`);

    const projectRes = await axios.post(`${BASE_URL}/projects`, 
        { name: 'Shared Project', team_id: teamId, color_code: '#00ff00' }, 
        { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    const projectId = projectRes.data.body.id;
    console.log(`   Project Created: ${projectId}`);

    // 3. Setup Guest
    console.log('3️⃣  Registering/Logging in Guest...');
    let guestToken;
    try {
        await axios.post(`${BASE_URL}/auth/signup`, GUEST);
        const res = await axios.post(`${BASE_URL}/auth/login`, GUEST);
        guestToken = res.data.data.token;
    } catch {
        const res = await axios.post(`${BASE_URL}/auth/login`, GUEST);
        guestToken = res.data.data.token;
    }

    // 4. Invite Guest to Project
    console.log('4️⃣  Inviting Guest...');
    const inviteRes = await axios.post(`${BASE_URL}/projects/${projectId}/invite`, 
        { email: GUEST.email, role: 'member' }, 
        { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    const apiToken = inviteRes.data.body.token; 

    // 5. Accept Invite
    console.log('5️⃣  Accepting Invite...');
    await axios.post(`${BASE_URL}/projects/invite/accept`, 
        { token: apiToken }, 
        { headers: { Authorization: `Bearer ${guestToken}` } }
    );

    // 6. Verify Guest can see TEAM
    console.log('6️⃣  Verifying Guest can see TEAM...');
    const guestTeamsRes = await axios.get(`${BASE_URL}/teams`, { headers: { Authorization: `Bearer ${guestToken}` } });
    const visibleTeams = guestTeamsRes.data.body;
    const foundTeam = visibleTeams.find(t => t._id === teamId);
    
    if (foundTeam) {
        console.log(`✅ SUCCESS: Guest sees Team ${teamId}`);
    } else {
        console.error('❌ FAILURE: Guest DOES NOT see the shared team!');
        console.log('Visible Teams:', visibleTeams.map(t => t._id));
    }

    // 7. Verify Guest can see PROJECT (using Team ID)
    console.log('7️⃣  Verifying Guest can see PROJECT...');
    try {
        const guestProjectsRes = await axios.get(`${BASE_URL}/projects?team_id=${teamId}`, { headers: { Authorization: `Bearer ${guestToken}` } });
        console.log('Project API Status:', guestProjectsRes.status);
        const body = guestProjectsRes.data.body;
        const visibleProjects = body?.projects || [];
        console.log('Visible Projects:', Array.isArray(visibleProjects) ? visibleProjects.map(p => p.id) : visibleProjects);
        
        const foundProject = visibleProjects.find(p => p.id === projectId || p._id === projectId);

        if (foundProject) {
            console.log(`✅ SUCCESS: Guest sees Project ${projectId}`);
        } else {
            console.error('❌ FAILURE: Guest DOES NOT see the shared project!');
        }
    } catch (e) {
        console.error('❌ Project API Failed:', e.response?.status, e.response?.data);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}
runTest();
