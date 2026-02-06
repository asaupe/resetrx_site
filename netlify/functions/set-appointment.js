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
        const { patientId, orderKey, siteCode, day, hour, min, useProduction } = JSON.parse(event.body);

        console.log('Set appointment request:', {
            patientId,
            orderKey,
            siteCode,
            day,
            hour: hour + ' (type: ' + typeof hour + ')',
            min: min + ' (type: ' + typeof min + ')',
            useProduction
        });

        if (!patientId || !orderKey || !siteCode || !day || hour === undefined || min === undefined) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'patientId, orderKey, siteCode, day, hour, and min are required' 
                })
            };
        }

        const client = getKHSSClient(useProduction);
        
        console.log('Calling KHSS setAppointment with:', {
            patientId,
            orderKey,
            siteCode,
            day,
            hourInt: parseInt(hour),
            minInt: parseInt(min)
        });
        
        const confirmation = await client.setAppointment(
            patientId,
            orderKey,
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
