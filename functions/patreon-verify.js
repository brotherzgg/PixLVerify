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

    try {
        const identityResponse = await axios.get('https://www.patreon.com/api/oauth2/v2/identity?include=memberships', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log('Identity response:', JSON.stringify(identityResponse.data, null, 2));

        let campaignResponse;
        try {
            campaignResponse = await axios.get('https://www.patreon.com/api/oauth2/v2/campaigns', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            console.log('Campaign response:', JSON.stringify(campaignResponse.data, null, 2));
        } catch (error) {
            console.log('Campaign fetch error:', error.response ? error.response.data : error.message);
            return { statusCode: 400, body: JSON.stringify({ error: 'Failed to fetch campaigns', details: error.response ? error.response.data : error.message }) };
        }

        const campaignData = campaignResponse.data.data;
        if (!campaignData || campaignData.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No campaigns found for this user' }) };
        }

        const campaignId = campaignData[0].id;
        console.log('Campaign ID:', campaignId);

        const pledgesResponse = await axios.get(`https://www.patreon.com/api/oauth2/v2/campaigns/${campaignId}/pledges`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log('Pledges response:', JSON.stringify(pledgesResponse.data, null, 2));

        const isSubscribed = pledgesResponse.data.data.some(pledge => {
            const amount = pledge.attributes.amount_cents / 100;
            const status = pledge.attributes.declined_since === null;
            return (amount === 0.99 || amount === 9.99) && status;
        });
        console.log('Is subscribed:', isSubscribed);

        return {
            statusCode: 200,
            body: JSON.stringify({ isSubscribed })
        };
    } catch (error) {
        console.log('Verification error:', error.response ? error.response.data : error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Verification failed', details: error.response ? error.response.data : error.message }) };
    }
};
