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
const { getCustomAttributeJSON, setCustomAttributeJSON } = require('./utils/custom-attributes');

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

        // Get existing appointments array (or empty array if none)
        const existingAppointments = await getCustomAttributeJSON(
            sgClient,
            appointmentData.userId,
            'quest_appointments',
            []
        );

        // Create appointment object
        const appointment = {
            // USER RELATION
            userId: appointmentData.userId,
            
            // ORDER DETAILS
            orderKey: appointmentData.orderKey,
            labAccount: appointmentData.labAccount || '',
            testCode: appointmentData.testCode || '',
            orderCreatedAt: appointmentData.orderCreatedAt || '',
            
            // APPOINTMENT DETAILS
            confirmationNumber: appointmentData.confirmationNumber,
            appointmentDate: appointmentData.appointmentDate || '',
            appointmentTime: appointmentData.appointmentTime || '',
            appointmentDateTime: appointmentData.appointmentDateTime || '',
            
            // LOCATION DETAILS
            siteCode: appointmentData.siteCode || '',
            locationName: appointmentData.locationName || '',
            locationAddress: appointmentData.locationAddress || '',
            locationPhone: appointmentData.locationPhone || '',
            
            // PATIENT SNAPSHOT
            patientId: appointmentData.patientId || '',
            patientDOB: appointmentData.patientDOB || '',
            patientGender: appointmentData.patientGender || '',
            patientPhone: appointmentData.patientPhone || '',
            patientEmail: appointmentData.patientEmail || '',
            
            // METADATA
            bookingTimestamp: appointmentData.bookingTimestamp || new Date().toISOString(),
            environment: appointmentData.environment || 'production',
            status: appointmentData.status || 'scheduled'
        };

        // Add new appointment to array
        existingAppointments.push(appointment);

        // Save updated appointments array
        const success = await setCustomAttributeJSON(
            sgClient,
            appointmentData.userId,
            'quest_appointments',
            existingAppointments,
            'Quest Appointment'
        );

        if (!success) {
            throw new Error('Failed to save appointment to Suggestic');
        }

        console.log(`✅ Appointment saved successfully (${existingAppointments.length} total appointments)`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Appointment saved successfully',
                data: {
                    totalAppointments: existingAppointments.length,
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
