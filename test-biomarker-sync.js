#!/usr/bin/env node

/**
 * Test script for biomarker sync function
 * Run with: node test-biomarker-sync.js
 */

require('dotenv').config();
const { handler } = require('./netlify/functions/sync-lab-results');

async function test() {
    console.log('🧪 Testing biomarker sync function...\n');
    
    const mockEvent = {
        httpMethod: 'POST',
        body: null,
        headers: {}
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
