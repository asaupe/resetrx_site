const { getKHSSClient } = require('./utils/khss-api-wrapper');

exports.handler = async (event, context) => {
    console.log('Get KHSS locations attempt');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { postalCode, patientId, orderKey, radiusMiles } = JSON.parse(event.body);

        if (!postalCode || !patientId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'postalCode and patientId are required' 
                })
            };
        }

        const client = getKHSSClient();
        const locations = await client.getLocations(
            postalCode, 
            patientId, 
            orderKey,
            radiusMiles || 50
        );

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
            },
            body: JSON.stringify({ 
                success: true, 
                data: locations
            })
        };
    } catch (error) {
        console.error('Get locations error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
