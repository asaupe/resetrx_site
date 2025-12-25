const { getKHSSClient } = require('./utils/khss-api-wrapper');

exports.handler = async (event, context) => {
    console.log('Set KHSS appointment attempt');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { patientId, siteCode, day, hour, min } = JSON.parse(event.body);

        if (!patientId || !siteCode || !day || hour === undefined || min === undefined) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'patientId, siteCode, day, hour, and min are required' 
                })
            };
        }

        const client = getKHSSClient();
        const confirmation = await client.setAppointment(
            patientId,
            siteCode,
            day,
            parseInt(hour),
            parseInt(min)
        );

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache' // Don't cache appointment bookings
            },
            body: JSON.stringify({ 
                success: true, 
                data: confirmation
            })
        };
    } catch (error) {
        console.error('Set appointment error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
