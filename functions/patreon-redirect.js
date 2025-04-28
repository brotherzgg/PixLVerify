const axios = require('axios');

exports.handler = async (event, context) => {
    const { code } = event.queryStringParameters || {};
    if (!code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No code provided' })
        };
    }

    try {
        const response = await axios.post('https://www.patreon.com/api/oauth2/token', {
            code,
            client_id: process.env.PATREON_CLIENT_ID,
            client_secret: process.env.PATREON_CLIENT_SECRET,
            grant_type: 'authorization_code',
            redirect_uri: 'https://myadfreeapp.netlify.app/.netlify/functions/patreon-redirect'
        });

        // Redirect back to app with access token
        return {
            statusCode: 302,
            headers: {
                Location: `com.example.patreonapp://oauthredirect?access_token=${response.data.access_token}`
            },
            body: ''
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Token exchange failed' })
        };
    }
};