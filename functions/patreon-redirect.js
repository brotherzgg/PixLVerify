const axios = require('axios');

exports.handler = async (event, context) => {
    // Log the incoming request for debugging
    console.log('Request method:', event.httpMethod);
    console.log('Query string parameters:', event.queryStringParameters);

    // Handle GET requests with code parameter
    if (event.httpMethod === 'GET') {
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
                redirect_uri: 'https://pixlverify.netlify.app/.netlify/functions/patreon-redirect'
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

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
    }

    // Return 405 for unsupported methods
    return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
    };
};
