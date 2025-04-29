const axios = require('axios');

exports.handler = async (event, context) => {
    // Log the full event for debugging
    console.log('Full event:', JSON.stringify(event, null, 2));

    // Extract code from query string parameters
    const { code } = event.queryStringParameters || {};
    if (!code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No code provided' })
        };
    }

    try {
        const response = await axios.post('https://www.patreon.com/api/oauth2/token', 
            `code=${encodeURIComponent(code)}&client_id=${encodeURIComponent(process.env.PATREON_CLIENT_ID)}&client_secret=${encodeURIComponent(process.env.PATREON_CLIENT_SECRET)}&grant_type=authorization_code&redirect_uri=${encodeURIComponent('https://pixlverify.netlify.app/.netlify/functions/patreon-redirect')}`, 
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        return {
            statusCode: 302,
            headers: {
                Location: `com.example.patreonapp://oauthredirect?access_token=${response.data.access_token}`
            },
            body: ''
        };
    } catch (error) {
        console.log('Token exchange error:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Token exchange failed', details: error.response ? error.response.data : error.message })
        };
    }
};
