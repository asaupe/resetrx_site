#!/usr/bin/env node

/**
 * Test script for biomarker sync function
 * Run with: node test-biomarker-sync.js
 * 
 * Set USE_TEST_DATA=true to use saved test data
 * Set TEST_USER_ID to override the userId (since test data doesn't have it in notes yet)
 */

require('dotenv').config();

// Override environment for testing
process.env.USE_TEST_DATA = 'true';
process.env.TEST_USER_ID = 'b78361e7-c7ba-4c93-a5c5-840a110bd317'; // Arne's userId

const { handler } = require('./netlify/functions/sync-lab-results');

async function test() {
    console.log('🧪 Testing biomarker sync function...');
    console.log('📋 Using saved test data');
    console.log('👤 Test user ID:', process.env.TEST_USER_ID);
    console.log('');
    
    const mockEvent = {
        httpMethod: 'POST',
        body: null,
        headers: {},
        queryStringParameters: {
            useTestData: 'true'
        }
    };
    
    const mockContext = {};
    
    try {
        const result = await handler(mockEvent, mockContext);
        
        console.log('\n✅ Test completed!');
        console.log('Status:', result.statusCode);
        console.log('Response:', JSON.parse(result.body));
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

test();
