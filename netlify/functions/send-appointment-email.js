/**
 * Send Quest Appointment Confirmation to Klaviyo
 * 
 * Creates a Klaviyo event that triggers an email with:
 * - Appointment details (date, time, location)
 * - Confirmation number for changes/cancellations
 * - Instructions for rescheduling via Quest portal
 */

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

        // Get Klaviyo API key from environment
        const klaviyoApiKey = process.env.KLAVIYO_PRIVATE_KEY;
        
        if (!klaviyoApiKey) {
            throw new Error('KLAVIYO_PRIVATE_KEY environment variable is not set');
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

        // Prepare Klaviyo event payload
        const klaviyoEvent = {
            data: {
                type: "event",
                attributes: {
                    profile: {
                        data: {
                            type: "profile",
                            attributes: {
                                email: appointmentData.patientEmail,
                                first_name: appointmentData.patientFirstName,
                                last_name: appointmentData.patientLastName,
                                phone_number: appointmentData.patientPhone
                            }
                        }
                    },
                    metric: {
                        data: {
                            type: "metric",
                            attributes: {
                                name: "Quest Appointment Booked"
                            }
                        }
                    },
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
                        
                        // Cancellation/Rescheduling Instructions
                        reschedule_url: "https://appointment.questdiagnostics.com/as-home",
                        reschedule_instructions: "To view, change, or cancel your appointment, visit the Quest Diagnostics appointment portal and select 'View, Change or Cancel an existing appointment'. You'll need your confirmation number.",
                        important_note: "Collection sites do not answer phones on site. Please use the online portal for any changes.",
                        
                        // Patient Info
                        patient_id: appointmentData.patientId,
                        patient_dob: appointmentData.patientDOB,
                        
                        // Metadata
                        booking_timestamp: appointmentData.bookingTimestamp,
                        environment: appointmentData.environment,
                        user_id: appointmentData.userId
                    },
                    time: new Date().toISOString()
                }
            }
        };

        console.log('Klaviyo event payload:', JSON.stringify(klaviyoEvent, null, 2));

        // Send event to Klaviyo
        const klaviyoResponse = await fetch('https://a.klaviyo.com/api/events/', {
            method: 'POST',
            headers: {
                'Authorization': `Klaviyo-API-Key ${klaviyoApiKey}`,
                'Content-Type': 'application/json',
                'revision': '2024-10-15'
            },
            body: JSON.stringify(klaviyoEvent)
        });

        console.log('Klaviyo API response status:', klaviyoResponse.status);

        if (!klaviyoResponse.ok) {
            const errorText = await klaviyoResponse.text();
            console.error('Klaviyo API error:', klaviyoResponse.status, errorText);
            throw new Error(`Klaviyo API error: ${klaviyoResponse.status} - ${errorText}`);
        }

        // Klaviyo may return 204 No Content on success (no body to parse)
        let result = null;
        const contentType = klaviyoResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            result = await klaviyoResponse.json();
        } else {
            result = { status: klaviyoResponse.status, statusText: klaviyoResponse.statusText };
        }
        
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
