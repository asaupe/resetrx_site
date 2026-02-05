/**
 * Send Quest Appointment Confirmation to Klaviyo
 * 
 * Creates a Klaviyo event that triggers an email with:
 * - Appointment details (date, time, location)
 * - Confirmation number for changes/cancellations
 */

const { sendKlaviyoEvent } = require('./utils/klaviyo-client');

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const appointmentData = JSON.parse(event.body);
        
        console.log('Sending appointment confirmation to Klaviyo:', {
            email: appointmentData.patientEmail,
            confirmationNumber: appointmentData.confirmationNumber,
            date: appointmentData.appointmentDate
        });

        // Validate required fields
        if (!appointmentData.patientEmail) {
            throw new Error('patientEmail is required');
        }
        if (!appointmentData.confirmationNumber) {
            throw new Error('confirmationNumber is required');
        }

        // Format appointment date for display
        const appointmentDateTime = new Date(appointmentData.appointmentDateTime || appointmentData.appointmentDate);
        const formattedDate = appointmentDateTime.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const formattedTime = appointmentData.appointmentTime || 
            appointmentDateTime.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });

        // Send event to Klaviyo
        const result = await sendKlaviyoEvent({
            metricName: 'Quest Appointment Booked',
            email: appointmentData.patientEmail,
            firstName: appointmentData.patientFirstName,
            lastName: appointmentData.patientLastName,
            phoneNumber: appointmentData.patientPhone,
            properties: {
                // Appointment Details
                confirmation_number: appointmentData.confirmationNumber,
                appointment_date: formattedDate,
                appointment_time: formattedTime,
                appointment_datetime_iso: appointmentData.appointmentDateTime,
                
                // Location Details
                location_name: appointmentData.locationName,
                location_address: appointmentData.locationAddress,
                location_phone: appointmentData.locationPhone,
                site_code: appointmentData.siteCode,
                
                // Order Details
                order_key: appointmentData.orderKey,
                test_code: appointmentData.testCode,
                lab_account: appointmentData.labAccount,
                
                // Patient Info
                patient_id: appointmentData.patientId,
                
                // Metadata
                booking_timestamp: appointmentData.bookingTimestamp,
                environment: appointmentData.environment,
                user_id: appointmentData.userId
            }
        });
        
        console.log('Klaviyo event created successfully:', result);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Appointment confirmation sent to Klaviyo',
                data: {
                    email: appointmentData.patientEmail,
                    confirmationNumber: appointmentData.confirmationNumber,
                    klaviyoEventId: result.data?.id
                }
            })
        };

    } catch (error) {
        console.error('Error sending to Klaviyo:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                details: error.toString()
            })
        };
    }
};
