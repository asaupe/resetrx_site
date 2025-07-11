// netlify/functions/contact.js
exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { name, email, message, wantsNewsletter } = JSON.parse(event.body);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Please enter a valid email address' })
            };
        }

        // Validate required fields
        if (!name || !email || !message) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Name, email, and message are required' })
            };
        }

        // Add to Kit with contact tag
        const tags = wantsNewsletter ? ['contact', 'newsletter'] : ['contact'];
        
        const kitResponse = await fetch(`https://api.kit.com/v3/forms/${process.env.KIT_CONTACT_FORM_ID}/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.KIT_API_KEY}`
            },
            body: JSON.stringify({
                email_address: email,
                first_name: name,
                tags: tags,
                fields: {
                    message: message
                }
            })
        });

        // Also send email via FormSubmit as backup
        const formData = new URLSearchParams();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('message', message);
        formData.append('newsletter_interest', wantsNewsletter ? 'Yes' : 'No');
        formData.append('_subject', 'New Contact - ResetRx Website');

        const emailResponse = await fetch('https://formsubmit.co/eva@resetrx.live', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
                success: true, 
                message: 'Message sent successfully!' 
            })
        };

    } catch (error) {
        console.error('Contact error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
                success: false, 
                error: 'Failed to send message' 
            })
        };
    }
};