/**
 * Send Lab Results Notification to Klaviyo
 * 
 * Creates a Klaviyo event when Quest lab results are received.
 * Includes alert information for out-of-range biomarkers but NOT actual values.
 */

const { sendKlaviyoEvent } = require('./utils/klaviyo-client');

/**
 * Send lab results notification event to Klaviyo
 * @param {Object} params - Notification parameters
 * @param {string} params.email - Patient email
 * @param {string} params.firstName - Patient first name
 * @param {string} params.lastName - Patient last name
 * @param {string} params.orderKey - Quest order key
 * @param {number} params.totalBiomarkers - Total number of biomarkers tested
 * @param {number} params.abnormalCount - Number of out-of-range biomarkers
 * @param {string} params.collectionDate - Date samples were collected
 * @param {string} params.resultDate - Date results were received
 * @param {boolean} params.hasAbnormalResults - Whether any results are abnormal
 * @param {string} params.userId - Suggestic user ID
 * @returns {Promise<Object>} Klaviyo API response
 */
async function sendLabResultsNotification({
    email,
    firstName,
    lastName,
    orderKey,
    totalBiomarkers,
    abnormalCount,
    collectionDate,
    resultDate,
    hasAbnormalResults,
    userId
}) {
    // Determine result status for messaging
    const resultStatus = hasAbnormalResults ? 'action_needed' : 'all_normal';

    // Format dates
    const formattedCollectionDate = new Date(collectionDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const formattedResultDate = new Date(resultDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Send event to Klaviyo
    return await sendKlaviyoEvent({
        metricName: 'Quest Lab Results Received',
        email: email,
        firstName: firstName,
        lastName: lastName,
        properties: {
            // Result Summary (counts only, no specifics)
            result_status: resultStatus,
            has_abnormal_results: hasAbnormalResults,
            total_biomarkers_tested: totalBiomarkers,
            abnormal_count: abnormalCount,
            normal_count: totalBiomarkers - abnormalCount,
            
            // Order Details
            order_key: orderKey,
            collection_date: formattedCollectionDate,
            collection_date_iso: collectionDate,
            result_date: formattedResultDate,
            result_date_iso: resultDate,
            
            // Metadata
            user_id: userId,
            notification_sent_at: new Date().toISOString()
        }
    });
}

// Export for use in sync-lab-results.js
module.exports = { sendLabResultsNotification };

// Also export as Netlify function handler if called directly
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = JSON.parse(event.body);
        
        // Validate required fields
        const required = ['email', 'orderKey', 'totalBiomarkers', 'abnormalCount'];
        for (const field of required) {
            if (params[field] === undefined) {
                throw new Error(`${field} is required`);
            }
        }
        
        const result = await sendLabResultsNotification(params);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Lab results notification sent',
                klaviyoResponse: result
            })
        };
        
    } catch (error) {
        console.error('Error sending lab results notification:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
