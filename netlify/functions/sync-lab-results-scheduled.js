const { handler: syncHandler } = require('./sync-lab-results');

/**
 * Scheduled function wrapper for biomarker sync
 * Runs automatically every 6 hours via Netlify's scheduled functions
 * Schedule: 0 */6 * * * (every 6 hours at :00)
 */
exports.handler = async (event, context) => {
    console.log('🕐 Scheduled biomarker sync triggered at:', new Date().toISOString());
    
    // Call the main sync function
    const result = await syncHandler(event, context);
    
    console.log('✓ Scheduled sync completed');
    return result;
};

// Netlify scheduled function configuration
exports.schedule = '0 */6 * * *';
