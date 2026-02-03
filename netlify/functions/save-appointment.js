/**
 * Save Quest Appointment to Suggestic Custom Attributes
 * 
 * Stores complete appointment details including:
 * - Order details (orderKey, labAccount, testCode)
 * - Appointment details (confirmationNumber, date, time)
 * - Location details (siteCode, name, address, phone)
 * - Patient snapshot (ID, DOB, gender)
 * - Metadata (booking timestamp, status)
 */

const { getSuggesticClient } = require('./utils/api-wrapper');

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
        
        console.log('Saving appointment to Suggestic:', appointmentData);

        // Validate required fields
        if (!appointmentData.userId) {
            throw new Error('userId is required');
        }
        if (!appointmentData.orderKey) {
            throw new Error('orderKey is required');
        }
        if (!appointmentData.confirmationNumber) {
            throw new Error('confirmationNumber is required');
        }

        // Initialize Suggestic client using the shared helper
        const sgClient = getSuggesticClient();

        // Prepare custom attributes - convert all appointment data to STRING type
        // Using a prefix 'quest_appointment_' to namespace these attributes
        const attributes = [
            // USER RELATION
            { name: 'quest_appointment_user_id', dataType: 'STRING', value: appointmentData.userId, category: 'Quest Appointment' },
            
            // ORDER DETAILS
            { name: 'quest_appointment_order_key', dataType: 'STRING', value: appointmentData.orderKey, category: 'Quest Appointment' },
            { name: 'quest_appointment_lab_account', dataType: 'STRING', value: appointmentData.labAccount || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_test_code', dataType: 'STRING', value: appointmentData.testCode || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_order_created_at', dataType: 'STRING', value: appointmentData.orderCreatedAt || '', category: 'Quest Appointment' },
            
            // APPOINTMENT DETAILS
            { name: 'quest_appointment_confirmation_number', dataType: 'STRING', value: appointmentData.confirmationNumber, category: 'Quest Appointment' },
            { name: 'quest_appointment_date', dataType: 'STRING', value: appointmentData.appointmentDate || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_time', dataType: 'STRING', value: appointmentData.appointmentTime || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_datetime', dataType: 'STRING', value: appointmentData.appointmentDateTime || '', category: 'Quest Appointment' },
            
            // LOCATION DETAILS
            { name: 'quest_appointment_site_code', dataType: 'STRING', value: appointmentData.siteCode || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_location_name', dataType: 'STRING', value: appointmentData.locationName || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_location_address', dataType: 'STRING', value: appointmentData.locationAddress || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_location_phone', dataType: 'STRING', value: appointmentData.locationPhone || '', category: 'Quest Appointment' },
            
            // PATIENT SNAPSHOT
            { name: 'quest_appointment_patient_id', dataType: 'STRING', value: appointmentData.patientId || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_patient_dob', dataType: 'STRING', value: appointmentData.patientDOB || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_patient_gender', dataType: 'STRING', value: appointmentData.patientGender || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_patient_phone', dataType: 'STRING', value: appointmentData.patientPhone || '', category: 'Quest Appointment' },
            { name: 'quest_appointment_patient_email', dataType: 'STRING', value: appointmentData.patientEmail || '', category: 'Quest Appointment' },
            
            // METADATA
            { name: 'quest_appointment_booking_timestamp', dataType: 'STRING', value: appointmentData.bookingTimestamp || new Date().toISOString(), category: 'Quest Appointment' },
            { name: 'quest_appointment_environment', dataType: 'STRING', value: appointmentData.environment || 'production', category: 'Quest Appointment' },
            { name: 'quest_appointment_status', dataType: 'STRING', value: appointmentData.status || 'scheduled', category: 'Quest Appointment' }
        ];

        // GraphQL mutation to save custom attributes
        const mutation = `
            mutation CreateAppointmentAttributes($attributes: [ProfileCustomAttribute!]!) {
                createProfileCustomAttributes(
                    append: true
                    attributes: $attributes
                ) {
                    success
                    errors {
                        field
                        messages
                    }
                }
            }
        `;

        const variables = {
            attributes: attributes
        };

        // Execute mutation with userId header
        const result = await sgClient.query(mutation, appointmentData.userId, variables);

        console.log('Suggestic save result:', result);

        // Check for errors
        if (result.createProfileCustomAttributes?.errors?.length > 0) {
            throw new Error(`Suggestic errors: ${JSON.stringify(result.createProfileCustomAttributes.errors)}`);
        }

        if (!result.createProfileCustomAttributes?.success) {
            throw new Error('Failed to save appointment to Suggestic');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Appointment saved successfully',
                data: {
                    attributesSaved: attributes.length,
                    confirmationNumber: appointmentData.confirmationNumber,
                    orderKey: appointmentData.orderKey
                }
            })
        };

    } catch (error) {
        console.error('Error saving appointment:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                details: error.stack
            })
        };
    }
};
