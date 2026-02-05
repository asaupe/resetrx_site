const { getKHSSClient } = require('./utils/khss-api-wrapper');
const { getSuggesticClient } = require('./utils/api-wrapper');
const { isInCustomAttributeArray, addToCustomAttributeArray } = require('./utils/custom-attributes');
const { sendLabResultsNotification } = require('./send-lab-results-notification');
const fs = require('fs');
const path = require('path');

/**
 * Sync lab results from KHSS to Suggestic biomarkers
 * Can be called manually or via scheduled cron
 * Set USE_TEST_DATA=true to use saved test data instead of calling KHSS
 */
exports.handler = async (event, context) => {
    console.log('Starting lab results sync...');

    try {
        const sgClient = getSuggesticClient();

        // Check if we should use test data (for development/debugging)
        const useTestData = process.env.USE_TEST_DATA === 'true' || 
                           (event.queryStringParameters && event.queryStringParameters.useTestData === 'true');

        let resultsResponse;
        
        if (useTestData) {
            console.log('📋 Using saved test data from file...');
            const testDataPath = path.join(__dirname, '../../test-data/khss-results-sample.json');
            const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
            resultsResponse = testData;
            console.log('Loaded test data with', testData.data?.length || 0, 'patients');
        } else {
            console.log('🔄 Fetching live results from KHSS...');
            const khssClient = getKHSSClient(false); // Use test environment
            resultsResponse = await khssClient.getResults();
        }
        
        if (!resultsResponse.hasResults) {
            console.log('No new results available from KHSS');
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: true,
                    message: 'No new results to sync',
                    syncedCount: 0
                })
            };
        }

        const patients = resultsResponse.data;
        let syncedCount = 0;
        const syncResults = [];

        // Process each patient's results
        for (const patient of patients) {
            try {
                // Extract Suggestic user ID from order notes (check both patient and order notes)
                let userId = extractSuggesticUserId(patient.Notes);
                
                // If not found in patient notes, will check each order's notes below
                if (!userId) {
                    console.log('No Suggestic user ID in patient notes, will check order notes or custom attributes');
                }
                
                // For testing with old data that doesn't have userId in notes
                const testUserId = process.env.TEST_USER_ID;
                
                for (const order of patient.Orders || []) {
                    const orderKey = order.Order_Key;
                    
                    // Try to get userId from order notes if not found at patient level
                    if (!userId) {
                        userId = extractSuggesticUserId(order.Notes);
                    }
                    
                    // If still not found, look up by order key in custom attributes
                    if (!userId) {
                        console.log(`Looking up user by order key: ${orderKey}`);
                        userId = await findUserByOrderKey(sgClient, orderKey);
                    }
                    
                    // Fall back to test user ID for development
                    if (!userId && testUserId) {
                        userId = testUserId;
                        console.log(`Using test user ID: ${testUserId}`);
                    }
                    
                    if (!userId) {
                        console.error('No user ID found for order:', orderKey);
                        continue;
                    }
                    
                    // Check if this order has already been synced for this user
                    const alreadySynced = await isOrderAlreadySynced(sgClient, userId, orderKey);
                    if (alreadySynced) {
                        console.log(`⏭️  Order ${orderKey} already synced for user ${userId}, skipping`);
                        syncResults.push({
                            userId,
                            orderKey,
                            status: 'already_synced'
                        });
                        continue;
                    }
                    
                    const biomarkers = parseBiomarkersFromKHSS(order.Results || []);
                    
                    if (biomarkers.length === 0) {
                        console.log(`No biomarkers found for order ${orderKey}`);
                        continue;
                    }

                    // Collect comprehensive order metadata
                    const orderMetadata = {
                        orderKey: orderKey,
                        orderNotes: order.Notes || [],
                        patientNotes: patient.Notes || [],
                        pdfReports: order.PDFs || [],
                        resultCount: biomarkers.length,
                        syncedAt: new Date().toISOString()
                    };

                    // Store biomarkers in Suggestic
                    await storeBiomarkersInSuggestic(
                        sgClient,
                        userId,
                        orderKey,
                        biomarkers,
                        orderMetadata
                    );
                    
                    // Mark order as synced to prevent duplicates
                    await markOrderAsSynced(sgClient, userId, orderKey);
                    
                    // Send Klaviyo notification about lab results
                    try {
                        await sendKlaviyoLabResultsNotification(
                            sgClient,
                            userId,
                            orderKey,
                            biomarkers,
                            order
                        );
                    } catch (klaviyoError) {
                        console.warn('Failed to send Klaviyo notification (non-critical):', klaviyoError.message);
                        // Don't fail the sync if Klaviyo notification fails
                    }

                    syncedCount++;
                    syncResults.push({
                        userId,
                        orderKey,
                        biomarkerCount: biomarkers.length,
                        status: 'synced'
                    });

                    console.log(`✓ Synced ${biomarkers.length} biomarkers for user ${userId}`);
                }
            } catch (error) {
                console.error(`Error syncing patient ${patient.Patient_Id}:`, error);
                syncResults.push({
                    userId: patient.Patient_Id,
                    status: 'error',
                    error: error.message
                });
            }
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: true,
                message: `Synced results for ${syncedCount} orders`,
                syncedCount,
                details: syncResults
            })
        };

    } catch (error) {
        console.error('Lab results sync error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: false,
                error: error.message 
            })
        };
    }
};

/**
 * Parse KHSS result data into structured biomarkers
 */
function parseBiomarkersFromKHSS(results) {
    const biomarkers = [];
    
    // Map of Quest test codes to Suggestic biomarker IDs
    // Reference: Quest Diagnostics test codes for ResetRx key biomarkers
    const biomarkerMap = {
        // Test data biomarkers (for development)
        'T4, FREE': 'QmlvbWFya2VyOjIyMDA=',  // T4, FREE biomarker created in Suggestic
        
        // Inflammation - hs-CRP (High-sensitivity C-Reactive Protein)
        '4420': 'crp_hs',          // hs-CRP
        '10124': 'crp_hs',         // Cardio CRP (alternate code)
        
        // Blood Sugar - HbA1c (Hemoglobin A1c)
        '496': 'hba1c',            // HbA1c (Glycosylated Hemoglobin)
        '7788': 'hba1c',           // HbA1c (alternate code)
        '4548': 'hba1c',           // HbA1c IFCC
        
        // Lipid Panel - Cholesterol
        '303': 'cholesterol_total',  // Total Cholesterol
        '7600': 'cholesterol_total', // Cholesterol (alternate)
        '304': 'cholesterol_ldl',    // LDL Cholesterol (Direct)
        '13457': 'cholesterol_ldl',  // LDL Cholesterol (Calculated)
        '305': 'cholesterol_hdl',    // HDL Cholesterol
        '7596': 'cholesterol_hdl',   // HDL (alternate)
        '306': 'triglycerides',      // Triglycerides
        '7573': 'triglycerides',     // Triglycerides (alternate)
        
        // Additional Common Biomarkers
        '866': 'glucose',            // Glucose (fasting)
        '1759': 'glucose',           // Glucose (random)
        '7573': 'tsh',               // Thyroid Stimulating Hormone
        '899': 'vitamin_d',          // Vitamin D, 25-Hydroxy
        '571': 'vitamin_b12',        // Vitamin B12
        '457': 'ferritin',           // Ferritin
        '7444': 'cortisol',          // Cortisol
        
        // Lipid Panel Complete (Test Code 7600)
        // When full lipid panel is ordered, it includes all the above cholesterol markers
    };

    for (const result of results) {
        // Extract result notes if any
        const resultNotes = result.Notes || [];
        
        // Result_Data is a single object, not an array
        const resultData = result.Result_Data;
        if (!resultData) continue;
        
        const testCode = resultData.Test_Name || resultData.Parent_Result;
        const biomarkerId = biomarkerMap[testCode];
        
        if (biomarkerId && resultData.Value) {
            biomarkers.push({
                // Core biomarker data
                id: biomarkerId,
                name: resultData.Test_Name || testCode,
                value: parseFloat(resultData.Value),
                unit: resultData.Units || '',
                
                // Reference and status
                referenceRange: resultData.Reference_Range || '',
                abnormalFlag: resultData.Abnormal_Flag || '',
                observationStatus: resultData.Observation_Result_Status || '',
                orderStatus: resultData.Order_Status || '',
                
                // Dates - ALL available date fields
                collectionDateTime: resultData.Collection_Date_Time || null,
                resultDateTime: resultData.Result_Date_Time || null,
                analysisDateTime: resultData.Date_Time_of_Analysis || null,
                observationDateTime: resultData.Date_Time_Observation || null,
                messageDateTime: resultData.Message_Date_Time || null,
                
                // Metadata
                valueType: resultData.Value_Type || '',
                sendingFacility: resultData.Sending_Facility || '',
                verifiedBy: resultData.Verify_By || '',
                sequenceNumber: resultData.Sequence_Number || null,
                parentResult: resultData.Parent_Result || '',
                externalKey: resultData.External_Key || '',
                reflex: resultData.Reflex || '',
                subName: resultData.Sub_Name || '',
                
                // Notes
                notes: resultNotes,
                
                // Full raw data for reference
                rawData: resultData
            });
        }
    }

    return biomarkers;
}

/**
 * Fetch all biomarker units from Suggestic and build a dynamic mapping
 * Cache this for the duration of the sync operation
 */
let cachedUnitMap = null;

async function getBiomarkerUnitMap(sgClient) {
    // Return cached map if available
    if (cachedUnitMap) {
        return cachedUnitMap;
    }
    
    console.log('🔄 Fetching biomarker units from Suggestic...');
    
    const unitMap = {};
    
    try {
        // Query first batch (max 100)
        const query1 = `
            query {
                biomarkerUnits(first: 100) {
                    pageInfo { hasNextPage endCursor }
                    edges {
                        node {
                            id
                            name
                            alias
                        }
                    }
                }
            }
        `;
        
        const result1 = await sgClient.query(query1);
        let allUnits = [...result1.biomarkerUnits.edges];
        
        // Get second batch if needed (Suggestic limits to 100 per query)
        if (result1.biomarkerUnits.pageInfo.hasNextPage) {
            const query2 = `
                query {
                    biomarkerUnits(first: 100, after: "${result1.biomarkerUnits.pageInfo.endCursor}") {
                        edges {
                            node {
                                id
                                name
                                alias
                            }
                        }
                    }
                }
            `;
            
            const result2 = await sgClient.query(query2);
            allUnits = [...allUnits, ...result2.biomarkerUnits.edges];
        }
        
        // Build map: unit name -> unit ID
        // Include both primary name and aliases
        // Store in lowercase for case-insensitive lookup
        for (const edge of allUnits) {
            const unit = edge.node;
            
            // Add primary name (lowercase for case-insensitive matching)
            unitMap[unit.name.toLowerCase()] = unit.id;
            
            // Add aliases (comma-separated)
            if (unit.alias) {
                const aliases = unit.alias.split(',').map(a => a.trim());
                for (const alias of aliases) {
                    if (alias) {
                        unitMap[alias.toLowerCase()] = unit.id;
                    }
                }
            }
        }
        
        console.log(`✓ Loaded ${allUnits.length} biomarker units (${Object.keys(unitMap).length} mappings including aliases)`);
        
        // Cache for this execution
        cachedUnitMap = unitMap;
        
        return unitMap;
    } catch (error) {
        console.error('Error fetching biomarker units:', error);
        // Return empty map on error - biomarkers without units will be skipped
        return {};
    }
}

/**
 * Store biomarkers in Suggestic using their biomarker API
 * Suggestic's API is limited, so we store core data in biomarkers
 * and extended metadata as custom profile properties
 */
async function storeBiomarkersInSuggestic(sgClient, userId, orderKey, biomarkers, orderMetadata) {
    // Use the most important date: collection date (when blood was drawn)
    const primaryDate = biomarkers[0]?.collectionDateTime || biomarkers[0]?.resultDateTime || new Date().toISOString();
    
    const reportTitle = `Quest Lab Results - ${orderKey}`;
    
    // Step 1: Check if lab test report already exists for this order
    console.log(`🔍 Checking for existing lab test report for order ${orderKey}...`);
    
    const checkReportQuery = `
        query {
            labTestReports(first: 50) {
                edges {
                    node {
                        id
                        testName
                        testDate
                    }
                }
            }
        }
    `;
    
    let labTestReportId = null;
    
    try {
        const existingReports = await sgClient.query(checkReportQuery, userId);
        
        // Look for existing report with matching testName (which includes order key)
        const existingReport = existingReports.labTestReports?.edges?.find(edge => 
            edge.node.testName === reportTitle
        );
        
        if (existingReport) {
            labTestReportId = existingReport.node.id;
            console.log(`✓ Found existing lab test report: ${labTestReportId}`);
        }
    } catch (error) {
        console.warn('Error checking for existing reports:', error.message);
    }
    
    // Step 2: Create lab test report only if it doesn't exist
    if (!labTestReportId) {
        console.log(`📋 Creating new lab test report for order ${orderKey}...`);
        
        // Check if any biomarkers are abnormal
        const hasAbnormalResults = biomarkers.some(b => 
            b.abnormalFlag && b.abnormalFlag !== '' && b.abnormalFlag.toLowerCase() !== 'no'
        );
        
        // Build alert text if there are abnormal results
        let alertText = null;
        if (hasAbnormalResults) {
            const abnormalBiomarkers = biomarkers.filter(b => 
                b.abnormalFlag && b.abnormalFlag !== '' && b.abnormalFlag.toLowerCase() !== 'no'
            );
            alertText = `${abnormalBiomarkers.length} abnormal result(s): ${abnormalBiomarkers.map(b => b.name).join(', ')}`;
        }
        
        const createReportMutation = `
            mutation CreateLabTestReport(
                $testName: String!, 
                $testDate: DateTime!, 
                $labName: String!, 
                $title: String!,
                $status: LabTestReportStatus,
                $alert: Boolean,
                $alertText: String
            ) {
                createLabTestReport(
                    testName: $testName
                    testDate: $testDate
                    labName: $labName
                    title: $title
                    status: $status
                    alert: $alert
                    alertText: $alertText
                ) {
                    success
                    message
                }
            }
        `;
        
        const reportVariables = {
            testName: reportTitle,
            testDate: primaryDate,
            labName: "Quest Diagnostics",
            title: reportTitle,
            status: "RESULTS_READY",  // We have results from Quest
            alert: hasAbnormalResults,
            alertText: alertText
        };
        
        try {
            const reportResult = await sgClient.query(createReportMutation, userId, reportVariables);
            
            if (!reportResult.createLabTestReport?.success) {
                throw new Error(`Failed to create lab test report: ${reportResult.createLabTestReport?.message}`);
            }
            
            console.log(`✓ Lab test report created successfully`);
            
            // Query to get the ID of the just-created report
            const getReportQuery = `
                query {
                    labTestReports(first: 1) {
                        edges {
                            node {
                                id
                                testName
                                testDate
                            }
                        }
                    }
                }
            `;
            
            const reportsResult = await sgClient.query(getReportQuery, userId);
            
            if (reportsResult.labTestReports?.edges?.length > 0) {
                labTestReportId = reportsResult.labTestReports.edges[0].node.id;
                console.log(`✓ Retrieved lab test report ID: ${labTestReportId}`);
            } else {
                throw new Error('Could not retrieve lab test report ID');
            }
            
        } catch (error) {
            console.error('Error creating lab test report:', error);
            throw error;
        }
    }
    
    // Step 3: Get dynamic unit mapping from Suggestic
    const unitMap = await getBiomarkerUnitMap(sgClient);
    
    // Step 4: Prepare biomarker inputs - ONLY fields Suggestic accepts
    const biomarkerInputs = biomarkers.map(b => {
        const isAbnormal = b.abnormalFlag && b.abnormalFlag !== '' && b.abnormalFlag.toLowerCase() !== 'no';
        
        // Get the Suggestic unit ID for this unit (case-insensitive lookup)
        const biomarkerUnitId = unitMap[b.unit.toLowerCase()];
        
        if (!biomarkerUnitId) {
            console.warn(`⚠️  Unknown unit: ${b.unit} for biomarker ${b.name}. Skipping this biomarker.`);
            console.warn(`   Available units: ${Object.keys(unitMap).slice(0, 10).join(', ')}...`);
            return null;
        }
        
        return {
            biomarkerId: b.id,
            biomarkerUnitId: biomarkerUnitId,
            result: {
                type: 'NUMBER',  // Required: must be NUMBER, STRING, or BOOLEAN
                value: b.value
                // Note: NO 'unit' field here - unit is encoded in biomarkerUnitId
            },
            date: b.collectionDateTime || b.resultDateTime,
            alert: isAbnormal,
            alertText: isAbnormal ? `${b.abnormalFlag}: Outside range ${b.referenceRange}` : null,
            displayValue: `${b.value} ${b.unit}`
        };
    }).filter(b => b !== null);  // Remove null entries for unknown units
    
    if (biomarkerInputs.length === 0) {
        console.warn('No valid biomarkers to store after filtering');
        return { success: false, message: 'No valid biomarkers' };
    }

    // Step 4: Add biomarker results to the lab test report
    const addBiomarkersMutation = `
        mutation AddBiomarkerResults($input: AddBiomarkerResultsInput!) {
            addBiomarkerResults(input: $input) {
                success
                message
            }
        }
    `;

    const biomarkersVariables = {
        input: {
            labTestReportId: labTestReportId,
            biomarkers: biomarkerInputs
        }
    };

    try {
        const result = await sgClient.query(addBiomarkersMutation, userId, biomarkersVariables);
        console.log('Biomarkers stored successfully:', result);
        
        // Store extended metadata as custom profile property
        await storeExtendedMetadata(sgClient, userId, orderKey, biomarkers, orderMetadata);
        
        console.log(`✓ Stored ${biomarkers.length} biomarkers with dates:`, {
            primaryDate,
            biomarkerIds: biomarkers.map(b => b.id)
        });
        
        return result;
    } catch (error) {
        console.error('Error storing biomarkers:', error);
        
        // Fallback: Use simple profile biomarkers if advanced API fails
        console.log('Falling back to simple profile biomarkers...');
        return await storeSimpleProfileBiomarkers(sgClient, userId, biomarkers);
    }
}

/**
 * Store extended metadata that doesn't fit in Suggestic's biomarker structure
 * This includes dates, notes, PDFs, facility info, etc.
 */
async function storeExtendedMetadata(sgClient, userId, orderKey, biomarkers, orderMetadata) {
    const metadata = {
        orderKey: orderKey,
        syncedAt: orderMetadata.syncedAt,
        
        // Comprehensive date tracking
        dates: {
            collection: biomarkers[0]?.collectionDateTime,
            result: biomarkers[0]?.resultDateTime,
            analysis: biomarkers[0]?.analysisDateTime,
            observation: biomarkers[0]?.observationDateTime,
            message: biomarkers[0]?.messageDateTime
        },
        
        // Test metadata
        biomarkerDetails: biomarkers.map(b => ({
            id: b.id,
            name: b.name,
            value: b.value,
            unit: b.unit,
            referenceRange: b.referenceRange,
            abnormalFlag: b.abnormalFlag,
            observationStatus: b.observationStatus,
            orderStatus: b.orderStatus,
            sendingFacility: b.sendingFacility,
            verifiedBy: b.verifiedBy,
            sequenceNumber: b.sequenceNumber
        })),
        
        // Notes and reports
        notes: {
            order: orderMetadata.orderNotes,
            patient: orderMetadata.patientNotes,
            results: biomarkers.flatMap(b => b.notes || [])
        },
        
        // PDF reports (base64 encoded)
        pdfReports: orderMetadata.pdfReports
    };

    // Store as a custom profile property
    // Note: This may need adjustment based on Suggestic's custom property API
    const mutation = `
        mutation {
            updateMyProfile(
                customProperties: {
                    labResults_${orderKey}: ${JSON.stringify(JSON.stringify(metadata))}
                }
            ) {
                success
            }
        }
    `;

    try {
        await sgClient.query(mutation, userId);
        console.log(`✓ Stored extended metadata for order ${orderKey}`);
    } catch (error) {
        console.warn('Could not store extended metadata:', error.message);
        // Don't fail the whole operation if metadata storage fails
    }
}

/**
 * Fallback method using simple profile biomarkers
 */
async function storeSimpleProfileBiomarkers(sgClient, userId, biomarkers) {
    // Map to simple profile fields
    const params = {};
    
    for (const biomarker of biomarkers) {
        switch (biomarker.id) {
            case 'hba1c':
                params.hba1c = biomarker.value;
                break;
            case 'cholesterol_ldl':
                params.cholesterolLdl = biomarker.value;
                break;
            case 'cholesterol_total':
                params.totalCholesterol = biomarker.value;
                break;
            case 'vitaminD':
                params.vitaminD = biomarker.value;
                break;
            case 'vitaminB12':
                params.vitaminB12 = biomarker.value;
                break;
            case 'cortisol':
                params.cortisol = biomarker.value;
                break;
            case 'ferritin':
                params.ferritin = biomarker.value;
                break;
        }
    }

    if (Object.keys(params).length === 0) {
        console.log('No biomarkers match simple profile fields');
        return { success: false };
    }

    const paramStr = Object.entries(params)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

    const mutation = `
        mutation {
            updateProfileBiomarkers(${paramStr}) {
                success
            }
        }
    `;

    return await sgClient.query(mutation, userId);
}

/**
 * Send Klaviyo notification about lab results
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {string} orderKey - Quest order key
 * @param {Array} biomarkers - Array of biomarker objects
 * @param {Object} order - KHSS order object
 */
async function sendKlaviyoLabResultsNotification(sgClient, userId, orderKey, biomarkers, order) {
    // Get user profile to retrieve email and name
    const profileQuery = `
        query {
            myProfile {
                id
                email
                firstName
                lastName
            }
        }
    `;
    
    const profileResult = await sgClient.query(profileQuery, userId);
    const profile = profileResult.myProfile;
    
    if (!profile || !profile.email) {
        console.warn('Cannot send Klaviyo notification: No email found for user');
        return;
    }
    
    // Categorize biomarkers into normal vs abnormal
    const abnormalBiomarkers = [];
    const normalBiomarkers = [];
    
    for (const biomarker of biomarkers) {
        const isAbnormal = biomarker.abnormalFlag && 
                          biomarker.abnormalFlag !== '' && 
                          biomarker.abnormalFlag.toLowerCase() !== 'no';
        
        if (isAbnormal) {
            abnormalBiomarkers.push(biomarker.name);
        } else {
            normalBiomarkers.push(biomarker.name);
        }
    }
    
    // Get collection date from first biomarker
    const collectionDate = biomarkers[0]?.collectionDateTime || new Date().toISOString();
    
    // Send notification
    await sendLabResultsNotification({
        email: profile.email,
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        orderKey: orderKey,
        totalBiomarkers: biomarkers.length,
        abnormalCount: abnormalBiomarkers.length,
        collectionDate: collectionDate,
        resultDate: new Date().toISOString(),
        hasAbnormalResults: abnormalBiomarkers.length > 0,
        userId: userId
    });
    
    console.log(`📧 Klaviyo notification sent to ${profile.email}`);
}

/**
 * Check if an order has already been synced for a user
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {string} orderKey - Quest order key
 * @returns {Promise<boolean>} - True if already synced
 */
async function isOrderAlreadySynced(sgClient, userId, orderKey) {
    try {
        return await isInCustomAttributeArray(sgClient, userId, 'synced_quest_orders', orderKey);
    } catch (error) {
        console.warn('Error checking if order already synced:', error.message);
        return false; // Assume not synced if we can't check
    }
}

/**
 * Mark an order as synced in user's custom attributes
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {string} orderKey - Quest order key
 */
async function markOrderAsSynced(sgClient, userId, orderKey) {
    try {
        const success = await addToCustomAttributeArray(
            sgClient, 
            userId, 
            'synced_quest_orders', 
            orderKey, 
            'Quest Lab Results'
        );
        
        if (success) {
            console.log(`✅ Marked order ${orderKey} as synced for user ${userId}`);
        } else {
            console.error(`Failed to mark order ${orderKey} as synced`);
        }
    } catch (error) {
        console.warn('Error marking order as synced:', error.message);
        // Don't fail the whole operation if we can't mark as synced
    }
}

/**
 * Extract Suggestic user ID from KHSS order notes
 * @param {Array} notes - Array of note strings from KHSS
 * @returns {string|null} - Suggestic user ID or null
 */
function extractSuggesticUserId(notes) {
    if (!notes || !Array.isArray(notes)) return null;
    
    for (const note of notes) {
        // Look for our marker format: SUGGESTIC_USER_ID:uuid
        const match = note.match(/SUGGESTIC_USER_ID:([a-f0-9-]+)/i);
        if (match && match[1]) {
            console.log('Found Suggestic user ID in notes:', match[1]);
            return match[1];
        }
    }
    
    console.warn('No Suggestic user ID found in notes');
    return null;
}

/**
 * Find Suggestic user ID by looking up order key in custom attributes
 * @param {Object} sgClient - Suggestic API client
 * @param {string} orderKey - KHSS order key (e.g., "RRX25.RX769802150731")
 * @returns {Promise<string|null>} - Suggestic user ID or null
 */
async function findUserByOrderKey(sgClient, orderKey) {
    try {
        console.log(`Querying users with order key: ${orderKey}`);
        
        // Step 1: Get all user IDs in the organization
        const usersQuery = `
            query {
                users {
                    edges {
                        node {
                            id
                        }
                    }
                }
            }
        `;
        
        const usersResult = await sgClient.query(usersQuery);
        
        if (!usersResult.users || !usersResult.users.edges) {
            console.error('No users returned from query');
            return null;
        }
        
        const userIds = usersResult.users.edges.map(edge => edge.node.id);
        console.log(`Checking ${userIds.length} users for order key ${orderKey}`);
        
        // Step 2: Query each user's custom attributes using myProfile with sg-user header
        const profileQuery = `
            query {
                myProfile {
                    id
                    customAttributes
                }
            }
        `;
        
        for (const userId of userIds) {
            try {
                const profileResult = await sgClient.query(profileQuery, userId);
                
                if (!profileResult.myProfile || !profileResult.myProfile.customAttributes) {
                    continue;
                }
                
                const attributes = JSON.parse(profileResult.myProfile.customAttributes);
                
                // Look for quest_appointment_order_key attribute matching this order
                const orderKeyAttr = attributes.find(attr => 
                    attr.name === 'quest_appointment_order_key' && 
                    attr.value === orderKey
                );
                
                if (orderKeyAttr) {
                    console.log(`✓ Found user for order ${orderKey}: ${userId}`);
                    return userId;
                }
            } catch (profileError) {
                console.warn(`Could not query profile for user ${userId}:`, profileError.message);
            }
        }
        
        console.warn(`No user found with order key: ${orderKey}`);
        return null;
        
    } catch (error) {
        console.error('Error looking up user by order key:', error);
        return null;
    }
}
