const axios = require('axios');

exports.handler = async (event, context) => {
    console.log('Received redirect event:', JSON.stringify(event, null, 2));

    const { code } = event.queryStringParameters || {};
    if (!code) {
        console.log('No authorization code provided');
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No authorization code provided' })
        };
    }

    const clientId = process.env.PATREON_CLIENT_ID;
    const clientSecret = process.env.PATREON_CLIENT_SECRET;
    const redirectUri = 'https://pixlverify.netlify.app/.netlify/functions/patreon-redirect';

    try {
        const response = await axios.post('https://www.patreon.com/api/oauth2/token', {
            code,
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri
        });

        const { access_token, refresh_token } = response.data;
        console.log('Token exchange successful: [REDACTED]');

        // Redirect back to the app with tokens
        const redirectUrl = `yourapp://patreon-callback?accessToken=${encodeURIComponent(access_token)}&refreshToken=${encodeURIComponent(refresh_token)}`;
        return {
            statusCode: 302,
            headers: {
                Location: redirectUrl
            },
            body: ''
        };
    } catch (error) {
        console.error('Token exchange failed:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to exchange authorization code' })
        };
    }
};
