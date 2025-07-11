exports.handler = async (event, context) => {
    console.log('Newsletter subscription attempt - FormSubmit only');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
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
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({ error: 'Please enter a valid email address' })
            };
        }

        // Use FormSubmit for reliable email delivery
        const formData = new URLSearchParams();
        formData.append('email', email);
        formData.append('signup_type', 'newsletter');
        formData.append('tags', (tags || ['newsletter']).join(', '));
        formData.append('_subject', 'Newsletter Signup - ResetRx');
        formData.append('_captcha', 'false');
        formData.append('_template', 'table'); // Nice email formatting

        console.log('Sending to FormSubmit:', { email, tags });

        const response = await fetch('https://formsubmit.co/eva@resetrx.live', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });

        console.log('FormSubmit response status:', response.status);

        // FormSubmit returns 200 on success
        if (response.ok) {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Successfully subscribed! You\'ll receive a confirmation email shortly.' 
                })
            };
        } else {
            throw new Error(`FormSubmit returned status ${response.status}`);
        }

    } catch (error) {
        console.error('Newsletter subscription error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
                success: false, 
                error: 'Subscription failed. Please try again or contact us directly.' 
            })
        };
    }
};