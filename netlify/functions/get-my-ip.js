// Simple function to return the outbound IP address of this Netlify Function
exports.handler = async (event, context) => {
    try {
        // Call a service that returns our IP
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                ip: data.ip,
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
