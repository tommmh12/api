import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

async function testChatApi() {
    try {
        // 1. Login to get token
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@nexus.com',
            password: 'Nexus@2025'
        });

        const token = loginRes.data.data.accessToken;
        console.log('✅ Login successful. Token obtained.');

        // 2. Get Conversations
        console.log('2. Fetching conversations...');
        try {
            const convRes = await axios.get(`${API_URL}/chat/conversations`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Conversations fetched successfully:', convRes.data.data.length);
        } catch (err) {
            console.error('❌ Error fetching conversations:', err.response?.data || err.message);
        }

        // 3. Get Groups
        console.log('3. Fetching groups...');
        try {
            const groupRes = await axios.get(`${API_URL}/chat/groups`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Groups fetched successfully:', groupRes.data.data.length);
        } catch (err) {
            console.error('❌ Error fetching groups:', err.response?.data || err.message);
        }

    } catch (error) {
        console.error('❌ Critical Test Error:', error.response?.data || error.message);
    }
}

testChatApi();
