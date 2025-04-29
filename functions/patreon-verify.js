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
        // Get campaigns
        const campaignResponse = await retry(() => axios.get('https://www.patreon.com/api/oauth2/v2/campaigns', {
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'PixL - Subscription Check'
            }
        }));
        console.log('Campaign response:', JSON.stringify(campaignResponse.data, null, 2));

        const campaignData = campaignResponse.data.data;
        if (!campaignData || campaignData.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No campaigns found for this user' }) };
        }

        // TODO: If you have multiple campaigns, filter by name or ID, e.g.:
        // const campaign = campaignData.find(c => c.attributes.name === 'Your Campaign Name');
        const campaignId = campaignData[0].id;
        console.log('Campaign ID:', campaignId);

        // Get members
        const membersResponse = await retry(() => axios.get(`https://www.patreon.com/api/oauth2/v2/campaigns/${campaignId}/members?fields[member]=currently_entitled_amount_cents,patron_status`, {
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'PixL - Subscription Check'
            }
        }));
        console.log('Members response:', JSON.stringify(membersResponse.data, null, 2));

        const isSubscribed = membersResponse.data.data.some(member => {
            const amount = member.attributes.currently_entitled_amount_cents;
            const status = member.attributes.patron_status === 'active_patron';
            return (amount === 99 || amount === 999) && status;
        });
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
