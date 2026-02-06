/**
 * Get configuration values for the frontend
 * Returns non-sensitive config like test codes, lab accounts, etc.
 */

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const useProduction = process.env.USE_PRODUCTION === 'true';
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            },
            body: JSON.stringify({
                success: true,
                data: {
                    environment: useProduction ? 'production' : 'test',
                    testCode: useProduction 
                        ? process.env.KHSS_PROD_TEST_CODE || '899'
                        : process.env.KHSS_TEST_CODE || '866',
                    labAccount: useProduction
                        ? process.env.KHSS_PROD_LAB_ACCOUNT || '73946524'
                        : process.env.KHSS_TEST_LAB_ACCOUNT || '7401519'
                }
            })
        };

    } catch (error) {
        console.error('Get config error:', error);
        
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
