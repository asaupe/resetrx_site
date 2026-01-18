const { getSuggesticClient } = require('./utils/api-wrapper');

exports.handler = async (event, context) => {
    console.log('Activity data fetch attempt');

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
        
        // Detect user's device source
        const source = await client.getUserSource(effectiveUserId);
        
        // Fetch steps and exercise data in parallel
        const [stepsData, exerciseData] = await Promise.all([
            client.getStepsData(effectiveUserId, startDate, endDate, source).catch(err => {
                console.error('Steps data error:', err);
                return null;
            }),
            client.getMovementData(effectiveUserId, startDate, endDate, source).catch(err => {
                console.error('Movement data error:', err);
                return null;
            })
        ]);

        // Transform data into daily aggregates
        const dailyData = {};
        
        // Process steps data
        if (stepsData?.edges) {
            stepsData.edges.forEach(edge => {
                const date = edge.node.datetime.split('T')[0]; // Extract YYYY-MM-DD
                if (!dailyData[date]) {
                    dailyData[date] = { date, steps: 0, exercise_minutes: 0 };
                }
                dailyData[date].steps = edge.node.steps || 0;
            });
        }
        
        // Process exercise data
        if (exerciseData?.edges) {
            exerciseData.edges.forEach(edge => {
                const date = edge.node.datetime.split('T')[0]; // Extract YYYY-MM-DD
                if (!dailyData[date]) {
                    dailyData[date] = { date, steps: 0, exercise_minutes: 0 };
                }
                dailyData[date].exercise_minutes += edge.node.durationMinutes || 0;
            });
        }

        // Convert to array and sort by date
        const activityArray = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

        return {
            statusCode: 200,
            headers: { 
                'Cache-Control': 'public, max-age=1800' // 30 min cache
            },
            body: JSON.stringify({ 
                success: true, 
                data: activityArray,
                userId: effectiveUserId
            })
        };
    } catch (error) {
        console.error('Activity fetch error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};