const { getKHSSClient } = require('./utils/khss-api-wrapper');

exports.handler = async (event, context) => {
    console.log('KHSS Auth attempt');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const client = getKHSSClient();
        const token = await client.authenticate();

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'private, max-age=5400' // Cache for 90 minutes
            },
            body: JSON.stringify({ 
                success: true, 
                token: token,
                expiresAt: client.tokenExpiry
            })
        };
    } catch (error) {
        console.error('KHSS auth error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
