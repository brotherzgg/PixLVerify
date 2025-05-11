const axios = require('axios');
const qs = require('querystring'); // For URL-encoded form data

exports.handler = async (event, context) => {
    console.log('Received redirect event:', JSON.stringify(event, null, 2));

    const { code, state } = event.queryStringParameters || {};

    // If code or state is missing, redirect back to the app with an error
    if (!code || !state) {
        console.log('Missing code or state parameter, redirecting to app with error');
        const redirectUrl = `com.pixl.store://oauthredirect?error=${encodeURIComponent('login_cancelled')}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
        return {
            statusCode: 302,
            headers: {
                Location: redirectUrl
            },
            body: ''
        };
    }

    const clientId = process.env.PATREON_CLIENT_ID;
    const clientSecret = process.env.PATREON_CLIENT_SECRET;
    const redirectUri = 'https://pixlverify.netlify.app/.netlify/functions/patreon-redirect';

    // Validate environment variables
    if (!clientId || !clientSecret) {
        console.error('Missing Patreon client ID or secret');
        // Redirect to app with error instead of showing error in browser
        const redirectUrl = `com.pixl.store://oauthredirect?error=${encodeURIComponent('server_config_error')}&state=${encodeURIComponent(state)}`;
        return {
            statusCode: 302,
            headers: {
                Location: redirectUrl
            },
            body: ''
        };
    }

    try {
        // Send request with URL-encoded form data to exchange code for tokens
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

        // Redirect back to the app with tokens (original functionality)
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
        // Redirect to app with error instead of showing error in browser
        const redirectUrl = `com.pixl.store://oauthredirect?error=${encodeURIComponent('token_exchange_failed')}&details=${encodeURIComponent(error.response ? JSON.stringify(error.response.data) : error.message)}&state=${encodeURIComponent(state)}`;
        return {
            statusCode: 302,
            headers: {
                Location: redirectUrl
            },
            body: ''
        };
    }
};
