SUBJECT: API Endpoint and Authentication for Programmatic Member Data Access

---

Hi Suggestic Support Team,

I'm building a wellness scoring system that needs to programmatically fetch member tracking data (sleep, steps, exercise, nutrition) from your API. I can see the data in the coaching portal, but I'm having trouble accessing it via API calls from my server.

WHAT I'M TRYING TO DO:

I need to fetch daily step counts for a member using a Node.js serverless function. Here's my current code:

```javascript
const fetch = require('node-fetch');

async function getMemberSteps(memberId, startDate, endDate) {
    const query = `
        query {
            member(id: "${memberId}") {
                stepsCounter(
                    start: "${startDate}T00:00:00Z", 
                    end: "${endDate}T23:59:59Z",
                    first: 300
                ) {
                    dailyGoal
                    edges {
                        node {
                            steps
                            datetime
                        }
                    }
                }
            }
        }
    `;
    
    const response = await fetch('https://production.suggestic.com/cp/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        body: JSON.stringify({ query })
    });
    
    return await response.json();
}

// Example call:
getMemberSteps('TWVtYmVyOjJkYzAxM2E3LThhOGEtNDU1NC04MTM5LWQyYWQ3YmQ5Nzc4Ng==', '2025-12-22', '2025-12-27');
```

CURRENT PROBLEM:

When I inspect the coaching portal's network requests, I can see this exact query pattern works and returns my step data (13109 steps on Dec 22, 8665 on Dec 23, etc.). However, when I run it from my server code, I get errors or empty data.

I've tried:
- Endpoint: https://production.suggestic.com/graphql (returns empty edges)
- Endpoint: https://production.suggestic.com/cp/graphql (returns HTML error page)
- Auth: Token f05b32d43269ef15736c3da29818edf86722f7ea (no data)
- Auth: Bearer JWT token from portal (works in browser, expires in code)

QUESTIONS:

1. What is the correct API endpoint for programmatic server-to-server access?
2. What authentication credentials should I use that won't expire daily?
3. Is there an API key or service account approach for long-running server applications?
4. What is the correct GraphQL query pattern to fetch member tracking data?

ACCOUNT INFO:
- Email: arne@resetrx.life
- Member ID: TWVtYmVyOjJkYzAxM2E3LThhOGEtNDU1NC04MTM5LWQyYWQ3YmQ5Nzc4Ng==

USE CASE:

I need to fetch sleep, steps, exercise, and nutrition data daily for wellness score calculation, running automatically from a Netlify serverless function without manual intervention.

Could you please provide the correct endpoint, authentication method, and sample query that will work for programmatic access?

Thank you!

Arne Saupe
ResetRx
