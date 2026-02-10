const { handler: syncHandler } = require('./sync-lab-results');

/**
 * Scheduled function wrapper for biomarker sync
 * Runs automatically every 6 hours via Netlify's scheduled functions
 * Schedule: Every 6 hours at minute 0 (cron: 0 STAR/6 STAR STAR STAR)
 * 
 * NOTE: Scheduled functions require a paid Netlify plan (Pro or higher)
 * For free tier, use GitHub Actions workflow (.github/workflows/sync-lab-results.yml)
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
