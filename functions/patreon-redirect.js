const axios = require('axios');

exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

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
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'PixL - Subscription Check'
                }
            }
        );
        console.log('Token response:', JSON.stringify(response.data, null, 2));

        return {
            statusCode: 302,
            headers: {
                Location: `com.example.patreonapp://oauthredirect?access_token=${response.data.access_token}`
            },
            body: ''
        };
    } catch (error) {
        console.error('Token exchange error:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Token exchange failed', 
                details: error.response ? error.response.data : error.message 
            })
        };
    }
};
