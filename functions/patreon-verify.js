const axios = require('axios');

exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    if (event.httpMethod !== 'POST') {
        console.log('Method not allowed:', event.httpMethod);
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        console.log('Failed to parse body:', e.message);
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { accessToken } = body;
    if (!accessToken) {
        console.log('No access token provided');
        return { statusCode: 400, body: JSON.stringify({ error: 'No access token provided' }) };
    }

    // Retry logic for rate limits
    const retry = async (fn, retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (error.response?.status !== 429 || i === retries - 1) throw error;
                console.log(`Rate limit hit, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };

    try {
        // Step 1: Get the user's identity to fetch their user ID
        const identityResponse = await retry(() => axios.get('https://www.patreon.com/api/oauth2/v2/identity', {
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'PixL - Subscription Check'
            }
        }));
        console.log('Identity response:', JSON.stringify(identityResponse.data, null, 2));

        const userId = identityResponse.data.data.id;
        if (!userId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No user ID found' }) };
        }

        // Step 2: Check if the user is a member of your campaign
        const campaignId = '5550912'; // Your campaign ID
        let membersResponse;
        try {
            membersResponse = await retry(() => axios.get(`https://www.patreon.com/api/oauth2/v2/campaigns/${campaignId}/members?include=user&fields[member]=currently_entitled_amount_cents,patron_status`, {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'PixL - Subscription Check'
                }
            }));
        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`Campaign ${campaignId} not found or inaccessible`);
                return { statusCode: 200, body: JSON.stringify({ isSubscribed: false }) };
            }
            throw error; // Re-throw other errors
        }
        console.log('Members response:', JSON.stringify(membersResponse.data, null, 2));

        // Find the member entry for this user
        const member = membersResponse.data.data.find(m => m.relationships.user.data.id === userId);
        if (!member) {
            return { statusCode: 200, body: JSON.stringify({ isSubscribed: false }) };
        }

        const isSubscribed = member.attributes.patron_status === 'active_patron' &&
                            (member.attributes.currently_entitled_amount_cents === 99 || member.attributes.currently_entitled_amount_cents === 999);
        console.log('Is subscribed:', isSubscribed);

        return {
            statusCode: 200,
            body: JSON.stringify({ isSubscribed })
        };
    } catch (error) {
        console.error('Verification error:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return { 
            statusCode: error.response?.status || 500, 
            body: JSON.stringify({ 
                error: 'Verification failed', 
                details: error.response ? error.response.data : error.message 
            }) 
        };
    }
};
