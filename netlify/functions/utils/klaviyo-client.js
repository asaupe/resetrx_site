/**
 * Klaviyo API Client Utility
 * Centralizes Klaviyo event tracking to avoid duplication
 */

const KLAVIYO_API_URL = 'https://a.klaviyo.com/api/events/';
const KLAVIYO_API_REVISION = '2024-10-15';

/**
 * Send an event to Klaviyo
 * @param {Object} params - Event parameters
 * @param {string} params.metricName - Name of the Klaviyo metric/event
 * @param {string} params.email - User email
 * @param {string} params.firstName - User first name (optional)
 * @param {string} params.lastName - User last name (optional)
 * @param {string} params.phoneNumber - User phone number (optional)
 * @param {Object} params.properties - Custom event properties
 * @returns {Promise<Object>} Klaviyo API response
 */
async function sendKlaviyoEvent({ metricName, email, firstName, lastName, phoneNumber, properties }) {
    // Get API key from environment
    const klaviyoApiKey = process.env.KLAVIYO_PRIVATE_KEY;
    
    if (!klaviyoApiKey) {
        throw new Error('KLAVIYO_PRIVATE_KEY environment variable is not set');
    }

    // Build profile attributes
    const profileAttributes = {
        email: email
    };
    
    if (firstName) profileAttributes.first_name = firstName;
    if (lastName) profileAttributes.last_name = lastName;
    if (phoneNumber) profileAttributes.phone_number = phoneNumber;

    // Build event payload
    const klaviyoEvent = {
        data: {
            type: "event",
            attributes: {
                profile: {
                    data: {
                        type: "profile",
                        attributes: profileAttributes
                    }
                },
                metric: {
                    data: {
                        type: "metric",
                        attributes: {
                            name: metricName
                        }
                    }
                },
                properties: properties || {},
                time: new Date().toISOString()
            }
        }
    };

    console.log(`Sending Klaviyo event: ${metricName} to ${email}`);

    // Send to Klaviyo
    const response = await fetch(KLAVIYO_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Klaviyo-API-Key ${klaviyoApiKey}`,
            'Content-Type': 'application/json',
            'revision': KLAVIYO_API_REVISION
        },
        body: JSON.stringify(klaviyoEvent)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Klaviyo API error:', response.status, errorText);
        throw new Error(`Klaviyo API error: ${response.status} - ${errorText}`);
    }

    console.log(`✅ Klaviyo event sent successfully: ${metricName}`);

    // Klaviyo may return 204 No Content on success
    let result = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        result = await response.json();
    } else {
        result = { 
            status: response.status, 
            statusText: response.statusText 
        };
    }
    
    return result;
}

module.exports = {
    sendKlaviyoEvent
};
