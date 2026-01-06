const { getSuggesticClient } = require('./utils/api-wrapper');

/**
 * Get user profile by user_id
 * Lightweight endpoint that just fetches profile data without scoring calculations
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
        
        // Use the users query to get profile data
        const query = `
            query {
                users(userUUIDs: "${userId}") {
                    edges {
                        node {
                            databaseId
                            name
                            email
                            phone
                            isActive
                            profileId
                        }
                    }
                }
            }
        `;
        
        const data = await client.query(query);
        
        if (!data.users || !data.users.edges || data.users.edges.length === 0) {
            throw new Error('Profile not found');
        }
        
        const userNode = data.users.edges[0].node;
        
        // Split name into firstName and lastName
        const nameParts = (userNode.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

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
