const axios = require('axios');
const qs = require('querystring');

exports.handler = async (event, context) => {
    // Check HTTP method
    if (event.httpMethod !== 'POST') {
        console.log('Method not allowed:', event.httpMethod);
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Check API key for authentication
    const API_KEY = process.env.API_KEY;
    const providedApiKey = event.headers['x-api-key'];
    if (!providedApiKey || providedApiKey !== API_KEY) {
        console.log('Unauthorized: Invalid or missing API key');
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }) };
    }

    // Parse request body
    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        console.log('Failed to parse body:', e.message);
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { refreshToken } = body;
    if (!refreshToken) {
        console.log('No refresh token provided');
        return { statusCode: 400, body: JSON.stringify({ error: 'No refresh token provided' }) };
    }

    const clientId = process.env.PATREON_CLIENT_ID;
    const clientSecret = process.env.PATREON_CLIENT_SECRET;

    // Validate environment variables
    if (!clientId || !clientSecret) {
        console.error('Missing Patreon client ID or secret');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: Missing Patreon credentials' })
        };
    }

    try {
        const response = await axios.post('https://www.patreon.com/api/oauth2/token', qs.stringify({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token } = response.data;
        console.log('Token refresh successful: [REDACTED]');

        return {
            statusCode: 200,
            body: JSON.stringify({
                accessToken: access_token,
                refreshToken: refresh_token
            })
        };
    } catch (error) {
        console.error('Token refresh failed:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to refresh token', details: error.response ? error.response.data : error.message })
        };
    }
};
