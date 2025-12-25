const { getSuggesticClient } = require('./utils/api-wrapper');

exports.handler = async (event, context) => {
    console.log('Score calculation attempt');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { userId, forceRefresh } = JSON.parse(event.body);
        const effectiveUserId = userId || process.env.TEST_USER_ID;
        
        // Calculate date ranges
        const today = new Date();
        const endDate = today.toISOString().split('T')[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const startDate = weekAgo.toISOString().split('T')[0];

        console.log('Fetching data from Suggestic for user:', effectiveUserId);

        const client = getSuggesticClient();

        // Fetch all data sources in parallel
        const [weightData, sleepData, movementData, mindfulnessData, nutritionData] = 
            await Promise.all([
                client.getWeightData(effectiveUserId, startDate, endDate),
                client.getSleepData(effectiveUserId, startDate, endDate),
                client.getMovementData(effectiveUserId, startDate, endDate),
                client.getMindfulnessData(effectiveUserId, startDate, endDate),
                client.getNutritionData(effectiveUserId, startDate, endDate)
            ]);

        // Calculate individual pillar scores (0-5 scale)
        const pillars = {
            weight: calculateWeightScore(weightData),
            sleep: calculateSleepScore(sleepData),
            movement: calculateMovementScore(movementData),
            mindfulness: calculateMindfulnessScore(mindfulnessData),
            nutrition: calculateNutritionScore(nutritionData)
        };

        // Calculate overall score (average of all pillars with data)
        const validScores = Object.values(pillars).filter(score => score > 0);
        const overallScore = validScores.length > 0 
            ? validScores.reduce((a, b) => a + b, 0) / validScores.length 
            : 0;

        const scoreData = {
            overall: parseFloat(overallScore.toFixed(1)),
            pillars: {
                weight: parseFloat(pillars.weight.toFixed(1)),
                sleep: parseFloat(pillars.sleep.toFixed(1)),
                movement: parseFloat(pillars.movement.toFixed(1)),
                mindfulness: parseFloat(pillars.mindfulness.toFixed(1)),
                nutrition: parseFloat(pillars.nutrition.toFixed(1))
            },
            lastUpdated: new Date().toISOString(),
            userId: effectiveUserId
        };

        console.log('Score calculated successfully:', scoreData.overall);

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
            },
            body: JSON.stringify({ 
                success: true, 
                data: scoreData
            })
        };

    } catch (error) {
        console.error('Score calculation error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: 'Failed to calculate score',
                details: error.message
            })
        };
    }
};

// Scoring algorithms
function calculateWeightScore(weightData) {
    if (!weightData || !weightData.entries || weightData.entries.length === 0) {
        return 0;
    }

    const { tendency, entries } = weightData;
    const consistencyScore = Math.min(entries.length / 7, 1) * 2.5;
    
    let trendScore = 2.5;
    if (tendency.type === 'DOWN' || tendency.type === 'STABLE') {
        trendScore = 2.5;
    } else if (tendency.type === 'UP') {
        trendScore = 1.5;
    }
    
    return Math.min(consistencyScore + trendScore, 5);
}

function calculateSleepScore(sleepData) {
    // TODO: Implement when sleep data structure is known
    return 0;
}

function calculateMovementScore(movementData) {
    // TODO: Implement when movement data structure is known
    return 0;
}

function calculateMindfulnessScore(mindfulnessData) {
    // TODO: Implement when mindfulness data structure is known
    return 0;
}

function calculateNutritionScore(nutritionData) {
    // TODO: Implement when nutrition data structure is known
    return 0;
}