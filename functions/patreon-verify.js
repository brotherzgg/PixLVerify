const axios = require('axios');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { accessToken } = JSON.parse(event.body || '{}');
    if (!accessToken) {
        return { statusCode: 400, body: JSON.stringify({ error: 'No access token provided' }) };
    }

    try {
        const identityResponse = await axios.get('https://www.patreon.com/api/oauth2/v2/identity?include=memberships', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const emailVerified = identityResponse.data.data.attributes.is_email_verified;

        if (!emailVerified) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Please verify your Patreon email' }) };
        }

        const campaignResponse = await axios.get('https://www.patreon.com/api/oauth2/v2/campaigns', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const campaignId = campaignResponse.data.data[0].id;

        const pledgesResponse = await axios.get(`https://www.patreon.com/api/oauth2/v2/campaigns/${campaignId}/pledges`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const isSubscribed = pledgesResponse.data.data.some(pledge => {
            const amount = pledge.attributes.amount_cents / 100;
            const status = pledge.attributes.declined_since === null;
            return (amount === 0.99 || amount === 9.99) && status;
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ isSubscribed })
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Verification failed' }) };
    }
};