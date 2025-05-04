const axios = require('axios');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Initialize rate limiter (10 requests per 60 seconds per IP)
const rateLimiter = new RateLimiterMemory({
    points: 10, // 10 requests
    duration: 60, // per 60 seconds
});

exports.handler = async (event, context) => {
    // Mask sensitive data in logs
    const logEvent = {
        ...event,
        body: event.body ? '{"accessToken":"[REDACTED]"}' : event.body
    };
    console.log('Received event:', JSON.stringify(logEvent, null, 2));

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

    // Rate limiting
    try {
        await rateLimiter.consume(event.headers['x-nf-client-connection-ip'] || 'unknown-ip');
    } catch (error) {
        console.log('Rate limit exceeded for IP:', event.headers['x-nf-client-connection-ip']);
        return { statusCode: 429, body: JSON.stringify({ error: 'Too many requests' }) };
    }

    // Parse request body
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

    // Retry logic for rate limits
    const retry = async (fn, retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (error.response?.status !== 429 || i === retries - 1) {
                    console.log(`Retry failed after ${retries} attempts:`, error.message);
                    throw error;
                }
                console.log(`Rate limit hit, retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };

    try {
        // Step 1: Get the user's identity and memberships, including the campaign for each membership
        const identityResponse = await retry(() => axios.get('https://www.patreon.com/api/oauth2/v2/identity?include=memberships.campaign&fields[member]=currently_entitled_amount_cents,patron_status', {
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'PixL - Subscription Check'
            }
        }));
        console.log('Identity response:', JSON.stringify(identityResponse.data, null, 2));

        // Step 2: Check if the user is a member of your campaign
        const campaignId = process.env.PATREON_CAMPAIGN_ID || '5550912'; // Use environment variable if set
        const memberships = identityResponse.data.included || [];

        // Edge Case: No memberships found
        if (!memberships.length) {
            console.log('No memberships found for user');
            return { statusCode: 200, body: JSON.stringify({ isSubscribed: false, reason: 'No memberships' }) };
        }

        const membership = memberships.find(m => 
            m.type === 'member' && 
            m.relationships?.campaign?.data?.id === campaignId
        );

        // Edge Case: User is not a member of the specified campaign
        if (!membership) {
            console.log('User is not a member of the specified campaign');
            return { statusCode: 200, body: JSON.stringify({ isSubscribed: false, reason: `Not a member of campaign ${campaignId}` }) };
        }

        // Edge Case: Multiple memberships to the same campaign (unlikely but possible)
        const duplicateMemberships = memberships.filter(m => 
            m.type === 'member' && 
            m.relationships?.campaign?.data?.id === campaignId
        );
        if (duplicateMemberships.length > 1) {
            console.log('Warning: User has multiple memberships to the same campaign', duplicateMemberships);
        }

        // Edge Case: Unexpected patron_status
        const patronStatus = membership.attributes.patron_status;
        if (!patronStatus) {
            console.log('Unexpected: patron_status is null');
            return { statusCode: 200, body: JSON.stringify({ isSubscribed: false, reason: 'Invalid patron status' }) };
        }
        if (patronStatus === 'declined_patron') {
            console.log('User has a declined payment');
            return { statusCode: 200, body: JSON.stringify({ isSubscribed: false, reason: 'Payment declined' }) };
        }
        if (patronStatus === 'former_patron') {
            console.log('User is a former patron');
            return { statusCode: 200, body: JSON.stringify({ isSubscribed: false, reason: 'Former patron' }) };
        }
        if (patronStatus !== 'active_patron') {
            console.log(`Unexpected patron_status: ${patronStatus}`);
            return { statusCode: 200, body: JSON.stringify({ isSubscribed: false, reason: `Unexpected patron status: ${patronStatus}` }) };
        }

        // Edge Case: Flexible amount check (accept any tier >= $1)
        const amountCents = membership.attributes.currently_entitled_amount_cents;
        const minimumAmountCents = 100; // $1 minimum
        if (amountCents < minimumAmountCents) {
            console.log(`Subscription amount too low: ${amountCents} cents (minimum ${minimumAmountCents} cents)`);
            return { statusCode: 200, body: JSON.stringify({ isSubscribed: false, reason: `Subscription amount too low: $${(amountCents / 100).toFixed(2)}` }) };
        }

        const isSubscribed = patronStatus === 'active_patron' && amountCents >= minimumAmountCents;
        console.log('Is subscribed:', isSubscribed, `Amount: $${(amountCents / 100).toFixed(2)}`);

        return {
            statusCode: 200,
            body: JSON.stringify({ isSubscribed, amount: amountCents / 100 })
        };
    } catch (error) {
        // Edge Case: Handle specific error types
        if (error.response) {
            const status = error.response.status;
            if (status === 401) {
                console.error('Invalid or expired access token');
                return { 
                    statusCode: 401, 
                    body: JSON.stringify({ error: 'Invalid or expired access token', details: error.response.data }) 
                };
            }
            if (status === 403) {
                console.error('Access token missing required scopes');
                return { 
                    statusCode: 403, 
                    body: JSON.stringify({ error: 'Access token missing required scopes', details: error.response.data }) 
                };
            }
            if (status === 429) {
                console.error('Rate limit exceeded after retries');
                return { 
                    statusCode: 429, 
                    body: JSON.stringify({ error: 'Rate limit exceeded', details: error.response.data }) 
                };
            }
            if (status >= 500) {
                console.error('Patreon API server error');
                return { 
                    statusCode: 503, 
                    body: JSON.stringify({ error: 'Patreon API server error', details: error.response.data }) 
                };
            }
        }
        console.error('Verification error:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                error: 'Verification failed', 
                details: error.response ? error.response.data : error.message 
            }) 
        };
    }
};
