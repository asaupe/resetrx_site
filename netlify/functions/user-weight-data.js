const { getSuggesticClient } = require('./utils/api-wrapper');

exports.handler = async (event, context) => {
    console.log('Weight data fetch attempt');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        let { userId, startDate, endDate } = JSON.parse(event.body);
        const effectiveUserId = userId || process.env.TEST_USER_ID;
        
        // Default to last 7 days if dates not provided
        if (!endDate) {
            const today = new Date();
            endDate = today.toISOString().split('T')[0];
        }
        if (!startDate) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            startDate = weekAgo.toISOString().split('T')[0];
        }
        
        const client = getSuggesticClient();
        const weightData = await client.getWeightData(
            effectiveUserId, 
            startDate, 
            endDate
        );

        return {
            statusCode: 200,
            headers: { 
                'Cache-Control': 'public, max-age=1800' // 30 min cache
            },
            body: JSON.stringify({ 
                success: true, 
                data: weightData,
                userId: effectiveUserId
            })
        };
    } catch (error) {
        console.error('Weight fetch error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};