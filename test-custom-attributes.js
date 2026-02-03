/**
 * Test script to verify Quest appointment custom attributes are saved
 */

require('dotenv').config();
const SuggesticClient = require('./netlify/functions/utils/api-wrapper');

async function testCustomAttributes() {
    const userId = '226100aa-b12c-4856-9a90-387267b415e9';
    
    console.log('Testing custom attributes for user:', userId);
    
    // Initialize Suggestic client
    const apiToken = process.env.SUGGESTIC_API_TOKEN;
    const endpoint = process.env.SUGGESTIC_GRAPHQL_ENDPOINT || 'https://production.suggestic.com/graphql';
    
    if (!apiToken) {
        throw new Error('SUGGESTIC_API_TOKEN environment variable is not set');
    }
    
    const sgClient = new SuggesticClient(apiToken, endpoint);
    
    // Query for custom attributes
    const query = `
        query {
            myProfile {
                id
                customAttributes
            }
        }
    `;
    
    try {
        const result = await sgClient.query(query, userId);
        console.log('\nRaw result:', JSON.stringify(result, null, 2));
        
        if (result.myProfile && result.myProfile.customAttributes) {
            const attrs = JSON.parse(result.myProfile.customAttributes);
            console.log('\nParsed custom attributes:', JSON.stringify(attrs, null, 2));
            
            // Filter for Quest appointment attributes
            const questAttrs = attrs.filter(attr => attr.name && attr.name.startsWith('quest_appointment_'));
            
            if (questAttrs.length > 0) {
                console.log(`\n✅ Found ${questAttrs.length} Quest appointment attributes:`);
                questAttrs.forEach(attr => {
                    console.log(`  - ${attr.name}: ${attr.value}`);
                });
            } else {
                console.log('\n❌ No Quest appointment attributes found');
            }
        } else {
            console.log('\n❌ No custom attributes found for this user');
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response);
        }
    }
}

testCustomAttributes().catch(console.error);
