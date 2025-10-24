exports.handler = async (event, context) => {
    console.log('Newsletter subscription attempt - Mailchimp only');

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
        // Parse JSON request
        let email, tags;
        
        try {
            const requestBody = JSON.parse(event.body);
            email = requestBody.email;
            tags = requestBody.tags;
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({ error: 'Invalid JSON format' })
            };
        }

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

        // Check Mailchimp credentials
        if (!process.env.MAILCHIMP_API_KEY || !process.env.MAILCHIMP_LIST_ID) {
            console.error('Mailchimp credentials missing');
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Email service not configured' 
                })
            };
        }

        // Subscribe to Mailchimp
        try {
            console.log('Adding subscriber to Mailchimp...');
            
            const datacenter = process.env.MAILCHIMP_API_KEY.split('-')[1];
            const mailchimpUrl = `https://${datacenter}.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/members`;
            
            const mailchimpResponse = await fetch(mailchimpUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${Buffer.from(`anystring:${process.env.MAILCHIMP_API_KEY}`).toString('base64')}`
                },
                body: JSON.stringify({
                    email_address: email,
                    status: 'subscribed',
                    tags: (tags || ['newsletter']).map(tag => tag.toString())
                })
            });

            const mailchimpData = await mailchimpResponse.json();
            console.log('Mailchimp response:', mailchimpResponse.status, mailchimpData);
            
            if (mailchimpResponse.ok) {
                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type'
                    },
                    body: JSON.stringify({ 
                        success: true, 
                        message: 'Successfully subscribed to our newsletter!' 
                    })
                };
            } else if (mailchimpResponse.status === 400 && mailchimpData.title === 'Member Exists') {
                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type'
                    },
                    body: JSON.stringify({ 
                        success: true, 
                        message: 'You\'re already subscribed to our newsletter!' 
                    })
                };
            } else {
                throw new Error(`Mailchimp error: ${mailchimpData.detail || mailchimpData.title}`);
            }

        } catch (mailchimpError) {
            console.error('Mailchimp subscription failed:', mailchimpError);
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Failed to subscribe to newsletter. Please try again.' 
                })
            };
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
                error: 'Subscription failed. Please try again.' 
            })
        };
    }
};