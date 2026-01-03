const { getSuggesticClient } = require('./utils/api-wrapper');

/**
 * Search for a user profile by email address
 * Test endpoint for searchProfile query
 */

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const queryParams = event.queryStringParameters || {};
        const bodyData = event.body ? JSON.parse(event.body) : {};
        
        const email = queryParams.email || bodyData.email;

        if (!email) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'email parameter is required' 
                })
            };
        }

        const client = getSuggesticClient();
        const profile = await client.searchProfileByEmail(email);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                data: profile
            })
        };

    } catch (error) {
        console.error('Search profile error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
