/**
 * Retrieve Quest Appointment data from Suggestic Custom Attributes
 * 
 * This demonstrates reading back the appointment data that was saved.
 * Returns all quest_appointment_* custom attributes for a user.
 */

const { getSuggesticClient } = require('./utils/api-wrapper');

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const queryParams = event.queryStringParameters || {};
        const bodyData = event.body ? JSON.parse(event.body) : {};
        
        const userId = queryParams.user_id || queryParams.userId || bodyData.user_id || bodyData.userId;

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'user_id parameter is required' 
                })
            };
        }

        console.log('Fetching appointment data for user:', userId);

        // Initialize Suggestic client
        const sgClient = getSuggesticClient();

        // Query to get user profile with custom attributes
        // Using myProfile with sg-user header since we need user-specific data
        const query = `
            query {
                myProfile {
                    id
                    email
                    customAttributes
                }
            }
        `;

        // Use userId in the sg-user header (passed to query method)
        const variables = null;

        const data = await sgClient.query(query, userId, variables);
        
        if (!data || !data.myProfile) {
            throw new Error('User profile not found');
        }

        console.log('User data retrieved:', {
            id: data.myProfile.id,
            email: data.myProfile.email,
            hasCustomAttributes: !!data.myProfile.customAttributes
        });

        // Parse custom attributes
        let customAttributes = [];
        if (data.myProfile.customAttributes) {
            try {
                customAttributes = JSON.parse(data.myProfile.customAttributes);
                console.log('Total custom attributes:', customAttributes.length);
            } catch (parseError) {
                console.error('Error parsing custom attributes:', parseError);
                customAttributes = [];
            }
        }

        // Filter for quest_appointment_* attributes
        const appointmentAttributes = customAttributes.filter(attr => 
            attr.name && attr.name.startsWith('quest_appointment_')
        );

        console.log('Quest appointment attributes found:', appointmentAttributes.length);

        // Convert attributes array to structured appointment object
        const appointment = {};
        appointmentAttributes.forEach(attr => {
            // Remove the 'quest_appointment_' prefix for cleaner keys
            const key = attr.name.replace('quest_appointment_', '');
            appointment[key] = attr.value;
        });

        // Also include timestamp if available
        if (appointmentAttributes.length > 0 && appointmentAttributes[0].timestamp) {
            appointment.savedTimestamp = appointmentAttributes[0].timestamp;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    user: {
                        id: data.myProfile.id,
                        email: data.myProfile.email
                    },
                    appointment: appointment,
                    rawAttributes: appointmentAttributes,
                    attributeCount: appointmentAttributes.length
                }
            })
        };

    } catch (error) {
        console.error('Error fetching appointment data:', error);
        
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
