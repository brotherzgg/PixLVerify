const axios = require('axios');
const qs = require('querystring'); // For URL-encoded form data

exports.handler = async (event, context) => {
    console.log('Received redirect event:', JSON.stringify(event, null, 2));

    const { code, state } = event.queryStringParameters || {};
    if (!code || !state) {
        console.log('Missing code or state parameter');
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing code or state parameter' })
        };
    }

    const clientId = process.env.PATREON_CLIENT_ID;
    const clientSecret = process.env.PATREON_CLIENT_SECRET;
    const redirectUri = 'https://pixlverify.netlify.app/.netlify/functions/patreon-redirect';

    // Validate environment variables
    if (!clientId || !clientSecret) {
        console.error('Missing Patreon client ID or secret');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: Missing Patreon credentials' })
        };
    }

    try {
        // Send request with URL-encoded form data
        const response = await axios.post('https://www.patreon.com/api/oauth2/token', qs.stringify({
            code,
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token } = response.data;
        console.log('Token exchange successful: [REDACTED]');

        // Redirect back to the app with tokens
        const redirectUrl = `com.pixl.store://oauthredirect?accessToken=${encodeURIComponent(access_token)}&refreshToken=${encodeURIComponent(refresh_token)}&state=${encodeURIComponent(state)}`;
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
            body: JSON.stringify({ error: 'Failed to exchange authorization code', details: error.response ? error.response.data : error.message })
        };
    }
};
