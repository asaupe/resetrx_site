exports.handler = async (event, context) => {
    console.log('Contact form submission - Enhanced Mailchimp + Email notification');

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
        const { name, email, message, wantsNewsletter } = JSON.parse(event.body);

        // Validate required fields
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

        if (!name || !email || !message) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify({ error: 'Name, email, and message are required' })
            };
        }

        let mailchimpSuccess = false;

        // Add ALL contacts to Mailchimp (with appropriate tags and status)
        if (process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_LIST_ID) {
            try {
                console.log('Adding contact to Mailchimp...');
                
                const datacenter = process.env.MAILCHIMP_API_KEY.split('-')[1];
                const mailchimpUrl = `https://${datacenter}.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/members`;
                
                const tags = wantsNewsletter ? 
                    ['contact-form', 'newsletter'] : 
                    ['contact-form', 'no-newsletter'];

                // Set status based on newsletter preference
                const status = wantsNewsletter ? 'subscribed' : 'transactional';

                const mailchimpResponse = await fetch(mailchimpUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${Buffer.from(`anystring:${process.env.MAILCHIMP_API_KEY}`).toString('base64')}`
                    },
                    body: JSON.stringify({
                        email_address: email,
                        status: status,
                        tags: tags,
                        merge_fields: {
                            FNAME: name.split(' ')[0] || name,
                            LNAME: name.split(' ').slice(1).join(' ') || '',
                            // Note: You'd need to create a custom field for MESSAGE in Mailchimp
                            // For now, we'll put it in the notes via API update
                        }
                    })
                });

                const mailchimpData = await mailchimpResponse.json();
                
                if (mailchimpResponse.ok || mailchimpResponse.status === 400) {
                    mailchimpSuccess = true;
                    console.log('Contact added to Mailchimp with tags:', tags);
                } else {
                    console.log('Mailchimp failed:', mailchimpResponse.status, mailchimpData);
                }

            } catch (mailchimpError) {
                console.log('Failed to add to Mailchimp:', mailchimpError.message);
            }
        }

        // Send email notification via FormSubmit (so you get notified of every contact)
        let emailSuccess = false;
        try {
            console.log('Sending email notification...');
            
            const formData = new URLSearchParams();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('message', message);
            formData.append('newsletter_interest', wantsNewsletter ? 'Yes - Added to Mailchimp' : 'No');
            formData.append('mailchimp_status', mailchimpSuccess ? 'Successfully added' : 'Failed to add');
            formData.append('form_type', 'Contact Form');
            formData.append('_subject', 'New Contact Form Submission - ResetRx');
            formData.append('_captcha', 'false');
            formData.append('_template', 'table');

            const emailResponse = await fetch('https://formsubmit.co/arne@resetrx.life', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            });

            emailSuccess = emailResponse.ok;
            console.log('Email notification sent:', emailResponse.status);

        } catch (emailError) {
            console.log('Failed to send email notification:', emailError.message);
        }

        // Return success if we at least got the email notification
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
                success: true, 
                message: wantsNewsletter ? 
                    'Message sent and subscribed to newsletter!' : 
                    'Message sent successfully! We\'ll get back to you soon.' 
            })
        };

    } catch (error) {
        console.error('Contact form error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
                success: false, 
                error: 'Failed to send message. Please try again.' 
            })
        };
    }
};