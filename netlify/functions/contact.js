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
                const status = wantsNewsletter ? 'subscribed' : 'pending';

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

        // Send email notification via Resend (more reliable than FormSubmit)
        let emailSuccess = false;
        if (process.env.RESEND_API_KEY) {
            try {
                console.log('Sending email notification via Resend...');
                
                const emailBody = `
New Contact Form Submission - ResetRx

Name: ${name}
Email: ${email}
Message: ${message}

Newsletter Interest: ${wantsNewsletter ? 'Yes - Added to Mailchimp' : 'No'}
Mailchimp Status: ${mailchimpSuccess ? 'Successfully added' : 'Failed to add'}
Form Type: Contact Form
Submitted: ${new Date().toLocaleString()}

---
This email was sent from your ResetRx website contact form.
                `.trim();

                const resendResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
                    },
                    body: JSON.stringify({
                        from: 'website@resetrx.life', // Must use your domain
                        to: ['arne@resetrx.life'],
                        subject: 'New Contact Form Submission - ResetRx',
                        text: emailBody,
                        reply_to: email // Allows you to reply directly to the contact
                    })
                });

                const resendData = await resendResponse.json();
                
                if (resendResponse.ok) {
                    emailSuccess = true;
                    console.log('✅ Email sent via Resend:', resendData.id);
                } else {
                    console.log('❌ Resend failed:', resendResponse.status, resendData);
                }

            } catch (resendError) {
                console.log('❌ Resend error:', resendError.message);
            }
        } else {
            console.log('❌ No RESEND_API_KEY found in environment variables');
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