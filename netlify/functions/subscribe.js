// netlify/functions/subscribe.js
exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { email, tags } = JSON.parse(event.body);

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Please enter a valid email address' })
            };
        }

        // Call Kit API
        const response = await fetch(`https://api.kit.com/v3/forms/${process.env.KIT_NEWSLETTER_FORM_ID}/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.KIT_API_KEY}`
            },
            body: JSON.stringify({
                email_address: email,
                tags: tags || ['newsletter']
            })
        });

        const data = await response.json();

        if (response.ok) {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Successfully subscribed!' 
                })
            };
        } else {
            return {
                statusCode: response.status,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({ 
                    success: false, 
                    error: data.message || 'Subscription failed' 
                })
            };
        }

    } catch (error) {
        console.error('Subscription error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
                success: false, 
                error: 'Internal server error' 
            })
        };
    }
};