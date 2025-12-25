/**
 * KHSS/Quest Appointment Scheduling API Client
 * Handles OAuth authentication and API calls to KHSS Salesforce endpoints
 */

const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');

class KHSSClient {
    constructor(config) {
        this.baseURL = config.baseURL;
        this.instanceURL = config.instanceURL;
        this.consumerKey = config.consumerKey;
        this.consumerSecret = config.consumerSecret;
        this.username = config.username;
        this.password = config.password;
        this.partnerId = config.partnerId;
        this.activityId = config.activityId || '1';
        this.token = null;
        this.tokenExpiry = null;
        
        // Setup proxy agent if Fixie URL is configured
        this.proxyAgent = null;
        if (process.env.FIXIE_URL) {
            console.log('Fixie proxy configured for static IP');
            this.proxyAgent = new HttpsProxyAgent(process.env.FIXIE_URL);
        }
    }

    /**
     * Authenticate with KHSS Salesforce OAuth
     * @returns {Promise<string>} - Access token
     */
    async authenticate() {
        // Return cached token if still valid
        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            console.log('Using cached token');
            return this.token;
        }

        try {
            const params = new URLSearchParams({
                grant_type: 'password',
                client_id: this.consumerKey,
                client_secret: this.consumerSecret,
                username: this.username,
                password: this.password
            });

            console.log('Authenticating with KHSS...');
            console.log('Base URL:', this.baseURL);
            if (this.proxyAgent) {
                console.log('Using Fixie proxy for static IP');
            }

            const response = await fetch(
                `https://${this.baseURL}/services/oauth2/token?${params.toString()}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    agent: this.proxyAgent
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`KHSS Auth error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('Auth successful!');
            console.log('Instance URL from response:', data.instance_url);
            console.log('Token type:', data.token_type);
            
            this.token = data.access_token;
            // Update instance URL from auth response (important!)
            if (data.instance_url) {
                const instanceUrl = data.instance_url.replace('https://', '');
                console.log('Using instance URL:', instanceUrl);
                this.instanceURL = instanceUrl;
            }
            
            // Token expires in 2 hours by default, cache for 1.5 hours
            this.tokenExpiry = Date.now() + (90 * 60 * 1000);
            
            return this.token;
        } catch (error) {
            console.error('KHSS authentication error:', error);
            throw error;
        }
    }

    /**
     * Make authenticated API call to KHSS endpoint
     * @param {string} endpoint - API endpoint path
     * @param {Object} body - Request payload
     * @returns {Promise<Object>} - API response
     */
    async apiCall(endpoint, body) {
        const token = await this.authenticate();

        console.log(`Making KHSS API call to ${endpoint}`);
        console.log('Request payload:', JSON.stringify(body, null, 2));

        try {
            const response = await fetch(
                `https://${this.instanceURL}/services/apexrest/PSCScheduling/${endpoint}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(body),
                    agent: this.proxyAgent
                }
            );

            console.log(`Response status: ${response.status}`);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('KHSS API error response:', errorText);
                
                // Try to parse error details
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.Errors && Array.isArray(errorJson.Errors)) {
                        console.error('Error details:', errorJson.Errors);
                    }
                } catch (e) {
                    // Not JSON, just log as is
                }
                
                throw new Error(`KHSS API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('KHSS API success response:', JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error(`KHSS API call error (${endpoint}):`, error);
            throw error;
        }
    }

    /**
     * Get available PSC locations based on postal code
     * @param {string} postalCode - ZIP code
     * @param {string} patientId - Patient identifier
     * @param {string} orderKey - Order key (optional)
     * @param {number} radiusMiles - Search radius in miles
     * @returns {Promise<Object>} - List of locations
     */
    async getLocations(postalCode, patientId, orderKey = null, radiusMiles = 50) {
        const payload = {
            Partner_Id: this.partnerId,
            Patient_Id: patientId,
            Order_Key: orderKey || `${this.partnerId}.${patientId}`,
            Activity_Id: this.activityId,
            Postal_Code: postalCode,
            Radius_Miles: radiusMiles.toString(),
            Is_Async: false
        };

        return await this.apiCall('Locations/v1', payload);
    }

    /**
     * Get available appointment slots for a location
     * @param {string} siteCode - Location site code
     * @param {Date} fromDate - Start date
     * @param {Date} toDate - End date
     * @param {boolean} firstAvailable - Return first available slot
     * @returns {Promise<Object>} - Available appointments
     */
    async getAppointments(siteCode, fromDate, toDate, firstAvailable = true) {
        const payload = {
            from_Date: fromDate.toISOString(),
            to_Date: toDate.toISOString(),
            site_Codes: [siteCode],
            activity_Id: this.activityId,
            first_available: firstAvailable ? 'Y' : 'N'
        };

        return await this.apiCall('Appointments/v1', payload);
    }

    /**
     * Schedule an appointment
     * @param {string} patientId - Patient identifier
     * @param {string} siteCode - Location site code
     * @param {string} day - Appointment date (YYYY-MM-DD)
     * @param {number} hour - Hour (0-23)
     * @param {number} min - Minute (0-59)
     * @returns {Promise<Object>} - Appointment confirmation
     */
    async setAppointment(patientId, siteCode, day, hour, min) {
        const payload = {
            patient_Id: patientId,
            partner_Id: this.partnerId,
            activity_Id: this.activityId,
            hour: hour.toString(),
            min: min.toString(),
            day: day,
            site_Code: siteCode
        };

        return await this.apiCall('Schedule/v1', payload);
    }

    /**
     * Create a lab order
     * @param {Object} patient - Patient information
     * @param {string} orderKey - Unique order key
     * @param {Array} tests - Array of test objects with Test_Code
     * @param {string} labAccount - Lab account number
     * @returns {Promise<Object>} - Order confirmation
     */
    async createOrder(patient, orderKey, tests, labAccount) {
        const payload = {
            Lab_Account: labAccount,
            Lab_Name: "Quest",
            Ordering_State: null,
            Is_Synchronous: true,
            Do_Not_Route_Further: false,
            Partner_Id: this.partnerId,
            Order_Key: orderKey,
            Patient: {
                Id: patient.id,
                First_Name: patient.firstName,
                Last_Name: patient.lastName,
                DOB: patient.dob, // YYYY-MM-DD
                Sex: patient.sex, // Male/Female
                Street: patient.street,
                City: patient.city,
                State: patient.state,
                Postal_Code: patient.postalCode,
                Phone: patient.phone,
                Email: patient.email
            },
            Tests: tests.map(test => ({
                Test_Code: test.testCode,
                Timestamp: test.timestamp || new Date().toISOString()
            }))
        };

        console.log('Creating order with payload:', JSON.stringify(payload, null, 2));
        
        // Orders use a different endpoint structure
        const token = await this.authenticate();
        
        const orderUrl = `https://${this.instanceURL}/services/apexrest/Order/v4/`;
        console.log('Calling Orders endpoint:', orderUrl);
        
        try {
            const response = await fetch(
                orderUrl,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload),
                    agent: this.proxyAgent
                }
            );

            console.log(`Order response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Order API error response:', errorText);
                throw new Error(`Order API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Order API success response:', JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error('Order creation error:', error);
            throw error;
        }
    }
}

// Export a singleton instance
let testClient = null;
let prodClient = null;

function getKHSSClient() {
    const useProduction = process.env.USE_PRODUCTION === 'true';
    
    if (useProduction) {
        if (!prodClient) {
            prodClient = new KHSSClient({
                baseURL: process.env.KHSS_PROD_BASE_URL,
                instanceURL: process.env.KHSS_PROD_INSTANCE_URL,
                consumerKey: process.env.KHSS_PROD_CONSUMER_KEY,
                consumerSecret: process.env.KHSS_PROD_CONSUMER_SECRET,
                username: process.env.KHSS_PROD_USERNAME,
                password: process.env.KHSS_PROD_PASSWORD,
                partnerId: process.env.KHSS_PROD_PARTNER_ID,
                activityId: process.env.KHSS_PROD_ACTIVITY_ID
            });
        }
        return prodClient;
    } else {
        if (!testClient) {
            testClient = new KHSSClient({
                baseURL: process.env.KHSS_TEST_BASE_URL,
                instanceURL: process.env.KHSS_TEST_INSTANCE_URL,
                consumerKey: process.env.KHSS_TEST_CONSUMER_KEY,
                consumerSecret: process.env.KHSS_TEST_CONSUMER_SECRET,
                username: process.env.KHSS_TEST_USERNAME,
                password: process.env.KHSS_TEST_PASSWORD,
                partnerId: process.env.KHSS_TEST_PARTNER_ID,
                activityId: process.env.KHSS_TEST_ACTIVITY_ID
            });
        }
        return testClient;
    }
}

module.exports = { getKHSSClient };
