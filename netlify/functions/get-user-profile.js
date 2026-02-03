const { getSuggesticClient } = require('./utils/api-wrapper');

/**
 * Get user profile by user_id
 * Lightweight endpoint that just fetches profile data without scoring calculations
 * 
 * IMPORTANT: Suggestic has two different IDs:
 * 1. userId (memberId) - Works with users() query - use this for lookups
 * 2. profileId - Does NOT work with users() query
 * 
 * If you have a profileId from the coaching portal, you need to either:
 * - Look up the user by email using search-profile endpoint
 * - Or get their userId (memberId) instead
 */

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const queryParams = event.queryStringParameters || {};
        const bodyData = event.body ? JSON.parse(event.body) : {};
        
        const userId = queryParams.user_id || queryParams.userId || bodyData.user_id || bodyData.userId;

        if (!userId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'user_id parameter is required' 
                })
            };
        }

        const client = getSuggesticClient();
        
        // Try to get user by either userId or profileId
        const userNode = await client.getUserById(userId);
        
        if (!userNode) {
            throw new Error('Profile not found');
        }
        
        // Split name into firstName and lastName
        // If name is not available, try to extract from email
        let firstName = '';
        let lastName = '';
        
        if (userNode.name && userNode.name.trim()) {
            const nameParts = userNode.name.split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
        } else if (userNode.email) {
            // Extract name from email (e.g., "seth@resetrx.life" -> "Seth")
            const emailName = userNode.email.split('@')[0];
            // Capitalize first letter
            firstName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
            lastName = '';
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                data: {
                    profile: {
                        userId: userNode.databaseId || userId,
                        firstName: firstName,
                        lastName: lastName,
                        name: userNode.name || '',
                        email: userNode.email || '',
                        phone: userNode.phone || '',
                        isActive: userNode.isActive,
                        profileId: userNode.profileId || '',
                        dateOfBirth: '', // Not available in Suggestic API
                        biologicalSex: '', // Not available in Suggestic API
                        address: {
                            street: '',
                            city: '',
                            state: '',
                            postalCode: '',
                            country: ''
                        }
                    }
                }
            })
        };

    } catch (error) {
        console.error('Get user profile error:', error);
        
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
