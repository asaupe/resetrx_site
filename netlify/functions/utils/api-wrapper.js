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
     * @param {string} userId - User ID for sg-user header
     * @returns {Promise<Object>} - Query result data
     */
    async query(query, userId) {
        try {
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
                throw new Error(`Suggestic API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            
            if (result.errors) {
                console.error('GraphQL errors:', result.errors);
                throw new Error(result.errors[0].message);
            }

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
     * @returns {Promise<Object>} - Sleep times data
     */
    async getSleepData(userId, startDate, endDate) {
        const query = `
            query {
                sleepTimes(start: "${startDate}", end: "${endDate}") {
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
     * @returns {Promise<Object>} - Sleep quality scores data
     */
    async getSleepQualityData(userId, startDate, endDate) {
        const query = `
            query {
                sleepQualityScores(start: "${startDate}", end: "${endDate}") {
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
     * @returns {Promise<Object>} - Steps counter data
     */
    async getStepsData(userId, startDate, endDate) {
        // Convert YYYY-MM-DD to YYYYMMDD format required by stepsCounter
        const formatDate = (dateStr) => dateStr.replace(/-/g, '');
        
        const query = `
            query {
                stepsCounter(start: "${formatDate(startDate)}", end: "${formatDate(endDate)}") {
                    dailyGoal
                    distance
                    steps
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
     * @returns {Promise<Object>} - Exercise tracker data
     */
    async getMovementData(userId, startDate, endDate) {
        const query = `
            query {
                exerciseTracker(start: "${startDate}", end: "${endDate}") {
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