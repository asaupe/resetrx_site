const { getKHSSClient } = require('./utils/khss-api-wrapper');

exports.handler = async (event, context) => {
    console.log('Get KHSS appointments attempt');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { siteCode, fromDate, toDate, firstAvailable } = JSON.parse(event.body);

        if (!siteCode || !fromDate || !toDate) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'siteCode, fromDate, and toDate are required' 
                })
            };
        }

        const client = getKHSSClient();
        const appointments = await client.getAppointments(
            siteCode,
            new Date(fromDate),
            new Date(toDate),
            firstAvailable !== false
        );

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            },
            body: JSON.stringify({ 
                success: true, 
                data: appointments
            })
        };
    } catch (error) {
        console.error('Get appointments error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
