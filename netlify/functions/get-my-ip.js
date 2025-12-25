// Simple function to return the outbound IP address of this Netlify Function
const { HttpsProxyAgent } = require('https-proxy-agent');

exports.handler = async (event, context) => {
    try {
        // Setup proxy if configured
        const fetchOptions = {};
        if (process.env.FIXIE_URL) {
            console.log('Using Fixie proxy for IP check');
            fetchOptions.agent = new HttpsProxyAgent(process.env.FIXIE_URL);
        }
        
        // Call a service that returns our IP
        const response = await fetch('https://api.ipify.org?format=json', fetchOptions);
        const data = await response.json();
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                ip: data.ip,
                usingProxy: !!process.env.FIXIE_URL,
                message: 'This is the outbound IP address from this Netlify Function'
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
