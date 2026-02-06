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
     * @param {string} userId - Member ID (base64 format) - optional for admin queries
     * @param {Object} variables - GraphQL variables - optional
     * @returns {Promise<Object>} - Query result data
     */
    async query(query, userId = null, variables = null) {
        try {
            console.log('Suggestic API Request:', {
                endpoint: this.endpoint,
                userId: userId,
                queryPreview: query.substring(0, 200),
                hasVariables: !!variables
            });
            
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Token ${this.apiToken}`
            };
            
            // Only add sg-user header if userId is provided (for user-specific queries)
            if (userId) {
                headers['sg-user'] = userId;
            }
            
            const body = { query };
            if (variables) {
                body.variables = variables;
            }

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
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
     * Fetch nutrition/meal tracking data
     * @param {string} userId - User ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Promise<Object>} - Meal tracking compliance data
     */
    async getNutritionData(userId, startDate, endDate) {
        const query = `
            query {
                foodLogs(start: "${startDate}", end: "${endDate}") {
                    edges {
                        node {
                            id
                            date
                        }
                    }
                }
            }
        `;
        
        try {
            console.log('Fetching food logs...');
            const data = await this.query(query, userId);
            console.log('Food logs response:', JSON.stringify(data, null, 2));
            
            if (!data.foodLogs || !data.foodLogs.edges) {
                console.log('No food logs found');
                return {
                    percentageCompleted: 0,
                    mealsLogged: 0,
                    mealsExpected: 0
                };
            }
            
            const loggedMeals = data.foodLogs.edges.length;
            const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
            const expectedMeals = days * 3; // Assuming 3 meals per day
            const percentageCompleted = expectedMeals > 0 ? Math.round((loggedMeals / expectedMeals) * 100) : 0;
            
            console.log(`✓ Found ${loggedMeals} logged meals out of ${expectedMeals} expected (${percentageCompleted}%)`);
            
            return {
                percentageCompleted: Math.min(percentageCompleted, 100),
                mealsLogged: loggedMeals,
                mealsExpected: expectedMeals
            };
        } catch (error) {
            console.error('Nutrition data error:', error.message);
            return {
                percentageCompleted: 0,
                mealsLogged: 0,
                mealsExpected: 0
            };
        }
    }

    /**
     * Get user profile information
     * @param {string} userId - Member ID (base64 format)
     * @returns {Promise<Object>} - User profile data including email, name, programs, etc.
     */
    async getUserProfile(userId) {
        const query = `
            query {
                myProfile {
                    id
                    email
                    firstName
                    lastName
                    onboardingDetails {
                        currentProgram {
                            id
                            name
                        }
                    }
                }
            }
        `;

        const data = await this.query(query, userId);
        return data.myProfile || null;
    }

    /**
     * Search for a profile by email address
     * @param {string} email - User's email address
     * @returns {Promise<Object>} - Profile data including userId, programs, meal plan
     */
    async searchProfileByEmail(email) {
        const query = `
            query {
                searchProfile(email: "${email}") {
                    id
                    userId
                    programName
                    basalMetabolicRate
                    caloricDifference
                    dailyCaloricIntakeGoal
                    mealPlan {
                        id
                        day
                        date
                        meals {
                            recipe {
                                id
                                name
                            }
                            meal
                            calories
                        }
                    }
                }
            }
        `;

        // Query without userId - use admin token authority
        const data = await this.query(query);
        return data.searchProfile || null;
    }

    /**
     * Get user by profileId or userId
     * Tries users query first, then searches by converting profileId to find userId
     * @param {string} id - Either userId or profileId (UUID format)
     * @returns {Promise<Object>} - User data with both userId and profileId
     */
    async getUserById(id) {
        // First try users query (assumes it's a userId)
        try {
            const usersQuery = `
                query {
                    users(userUUIDs: "${id}") {
                        edges {
                            node {
                                databaseId
                                name
                                email
                                phone
                                isActive
                                profileId
                            }
                        }
                    }
                }
            `;
            
            const data = await this.query(usersQuery);
            if (data.users && data.users.edges && data.users.edges.length > 0) {
                return data.users.edges[0].node;
            }
        } catch (error) {
            console.log('users query failed, assuming input is profileId:', error.message);
        }
        
        // If not found, try using myProfile with base64 encoded profileId
        try {
            const profileIdBase64 = Buffer.from(`Profile:${id}`).toString('base64');
            const myProfileQuery = `
                query {
                    myProfile {
                        id
                        email
                    }
                }
            `;
            
            const data = await this.query(myProfileQuery, profileIdBase64);
            if (data.myProfile) {
                // Convert myProfile response to match users format
                return {
                    databaseId: id,  // Keep the original profileId as databaseId
                    name: '',  // myProfile doesn't have name field
                    email: data.myProfile.email,
                    phone: '',  // myProfile doesn't have phone field
                    isActive: true,  // Assume active if profile exists
                    profileId: data.myProfile.id
                };
            }
        } catch (error) {
            console.log('myProfile with profileId failed:', error.message);
        }
        
        return null;
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