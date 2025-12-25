const { getKHSSClient } = require('./utils/khss-api-wrapper');

exports.handler = async (event, context) => {
    console.log('Create KHSS order attempt');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { patient, orderKey, tests, labAccount } = JSON.parse(event.body);

        // Validate required fields
        if (!patient || !orderKey) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'patient and orderKey are required' 
                })
            };
        }

        // Default lab account from env if not provided
        const effectiveLabAccount = labAccount || process.env.KHSS_TEST_LAB_ACCOUNT || '7401519';
        
        // Default to basic metabolic panel test if none provided
        const effectiveTests = tests || [{ testCode: '866', timestamp: new Date().toISOString() }];

        const client = getKHSSClient();
        const orderResult = await client.createOrder(
            patient,
            orderKey,
            effectiveTests,
            effectiveLabAccount
        );

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache' // Don't cache order creation
            },
            body: JSON.stringify({ 
                success: true, 
                data: orderResult
            })
        };
    } catch (error) {
        console.error('Create order error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
