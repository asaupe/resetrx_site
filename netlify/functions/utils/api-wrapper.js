/**
 * Suggestic GraphQL API Client
 * Reusable wrapper for all Suggestic API calls
 */

class SuggesticClient {
    constructor(apiToken, endpoint) {
        this.apiToken = apiToken;
        this.endpoint = endpoint;
    }

    /**
     * Execute a GraphQL query
     * @param {string} query - GraphQL query string
     * @param {string} userId - Member ID (base64 format)
     * @returns {Promise<Object>} - Query result data
     */
    async query(query, userId) {
        try {
            console.log('Suggestic API Request:', {
                endpoint: this.endpoint,
                userId: userId,
                queryPreview: query.substring(0, 200)
            });
            
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${this.apiToken}`,
                    'sg-user': userId
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Suggestic API HTTP error:', response.status, errorText);
                throw new Error(`Suggestic API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            
            if (result.errors) {
                console.error('GraphQL errors:', JSON.stringify(result.errors, null, 2));
                throw new Error(result.errors[0].message);
            }

            console.log('Suggestic API success, data keys:', Object.keys(result.data || {}));
            return result.data;
        } catch (error) {
            console.error('Suggestic query error:', error);
            throw error;
        }
    }

    /**
     * Fetch weight tracker data
     * @param {string} userId - User ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Promise<Object>} - Weight tracker data
     */
    async getWeightData(userId, startDate, endDate) {
        const query = `
            query {
                weightTracker(startDate: "${startDate}", endDate: "${endDate}", source: SUGGESTIC) {
                    entries {
                        date
                        createdAt
                        value
                        source
                    }
                    tendency {
                        type
                        difference
                    }
                }
            }
        `;
        
        const data = await this.query(query, userId);
        return data.weightTracker;
    }

    /**
     * Fetch sleep data
     * @param {string} userId - User ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} source - Data source (APPLE or HEALTHCONNECT)
     * @returns {Promise<Object>} - Sleep times data
     */
    async getSleepData(userId, startDate, endDate, source = 'APPLE') {
        const query = `
            query {
                sleepTimes(start: "${startDate}", end: "${endDate}", source: ${source}, first: 300) {
                    dailyGoal
                    totalTime
                    pageInfo {
                        hasNextPage
                        hasPreviousPage
                    }
                    edges {
                        node {
                            date
                            source
                            value
                            id
                        }
                    }
                }
            }
        `;
        
        const data = await this.query(query, userId);
        return data.sleepTimes;
    }

    /**
     * Fetch sleep quality scores
     * @param {string} userId - User ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} source - Data source (APPLE or HEALTHCONNECT)
     * @returns {Promise<Object>} - Sleep quality scores data
     */
    async getSleepQualityData(userId, startDate, endDate, source = 'APPLE') {
        const query = `
            query {
                sleepQualityScores(start: "${startDate}", end: "${endDate}", source: ${source}, first: 300) {
                    average
                    pageInfo {
                        hasNextPage
                        hasPreviousPage
                    }
                    edges {
                        node {
                            date
                            source
                            value
                            id
                        }
                    }
                }
            }
        `;
        
        const data = await this.query(query, userId);
        return data.sleepQualityScores;
    }

    /**
     * Fetch steps counter data
     * @param {string} userId - User ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} source - Data source (APPLE or HEALTHCONNECT)
     * @returns {Promise<Object>} - Steps counter data
     */
    async getStepsData(userId, startDate, endDate, source = 'APPLE') {
        // Convert YYYY-MM-DD to YYYYMMDD numeric format
        const formatDate = (dateStr) => parseInt(dateStr.replace(/-/g, ''));
        
        const query = `
            query {
                stepsCounter(start: ${formatDate(startDate)}, end: ${formatDate(endDate)}, source: ${source}, first: 300) {
                    dailyGoal
                    distance
                    edges {
                        node {
                            steps
                            source
                            datetime
                            id
                        }
                    }
                }
            }
        `;
        
        const data = await this.query(query, userId);
        return data.stepsCounter;
    }

    /**
     * Fetch movement/activity data from exercise tracker
     * @param {string} userId - User ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} source - Data source (APPLE or HEALTHCONNECT)
     * @returns {Promise<Object>} - Exercise tracker data
     */
    async getMovementData(userId, startDate, endDate, source = 'APPLE') {
        const query = `
            query {
                exerciseTracker(start: "${startDate}", end: "${endDate}", source: ${source}, first: 300) {
                    pageInfo {
                        hasNextPage
                        hasPreviousPage
                    }
                    edges {
                        node {
                            calories
                            datetime
                            id
                            intensity
                            type
                            durationMinutes
                        }
                    }
                }
            }
        `;
        
        const data = await this.query(query, userId);
        return data.exerciseTracker;
    }

    /**
     * Get user's device source (APPLE for iOS, HEALTHCONNECT for Android)
     * @param {string} userId - User ID
     * @returns {Promise<string>} - Source type (APPLE or HEALTHCONNECT)
     */
    async getUserSource(userId) {
        // Try to detect from recent step data
        const query = `
            query {
                stepsCounter(start: 20251201, end: 20260102, first: 1) {
                    edges {
                        node {
                            source
                        }
                    }
                }
            }
        `;
        
        try {
            const data = await this.query(query, userId);
            const source = data.stepsCounter?.edges?.[0]?.node?.source;
            
            if (source) {
                console.log('Detected user source:', source);
                return source;
            }
        } catch (error) {
            console.warn('Could not detect user source:', error.message);
        }
        
        // Default to APPLE if cannot detect
        console.log('Defaulting to APPLE source');
        return 'APPLE';
    }

    /**
     * Fetch mindfulness/stress data
     * TODO: Add actual Suggestic mindfulness query when available
     */
    async getMindfulnessData(userId, startDate, endDate) {
        // Placeholder - replace with actual Suggestic mindfulness query
        const query = `
            query {
                # TODO: Add actual mindfulness query
            }
        `;
        
        // For now, return mock data
        return {
            entries: [],
            sessions: 0,
            totalMinutes: 0
        };
    }

    /**
     * Fetch nutrition data
     * TODO: Add actual Suggestic nutrition query when available
     */
    async getNutritionData(userId, startDate, endDate) {
        // Placeholder - replace with actual Suggestic nutrition query
        const query = `
            query {
                # TODO: Add actual nutrition query
            }
        `;
        
        // For now, return mock data
        return {
            entries: [],
            mealsLogged: 0,
            compliance: 0
        };
    }
}

// Export a singleton instance
let client = null;

function getSuggesticClient() {
    if (!client) {
        const apiToken = process.env.GRAPHQL_API_TOKEN;
        const endpoint = process.env.GRAPHQL_ENDPOINT;
        
        if (!apiToken || !endpoint) {
            throw new Error('Suggestic API credentials not configured');
        }
        
        client = new SuggesticClient(apiToken, endpoint);
    }
    
    return client;
}

module.exports = { getSuggesticClient };