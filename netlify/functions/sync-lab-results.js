const { getKHSSClient } = require('./utils/khss-api-wrapper');
const { getSuggesticClient } = require('./utils/api-wrapper');

/**
 * Sync lab results from KHSS to Suggestic biomarkers
 * Can be called manually or via scheduled cron
 */
exports.handler = async (event, context) => {
    console.log('Starting lab results sync...');

    try {
        const khssClient = getKHSSClient(false); // Use test environment
        const sgClient = getSuggesticClient();

        // Retrieve all pending results from KHSS
        const resultsResponse = await khssClient.getResults();
        
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
                const userId = patient.Patient_Id;
                
                for (const order of patient.Orders || []) {
                    const orderKey = order.Order_Key;
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
        
        for (const resultData of result.Result_Data || []) {
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
    }

    return biomarkers;
}

/**
 * Store biomarkers in Suggestic using their biomarker API
 * Suggestic's API is limited, so we store core data in biomarkers
 * and extended metadata as custom profile properties
 */
async function storeBiomarkersInSuggestic(sgClient, userId, orderKey, biomarkers, orderMetadata) {
    // Use the most important date: collection date (when blood was drawn)
    const primaryDate = biomarkers[0]?.collectionDateTime || biomarkers[0]?.resultDateTime || new Date().toISOString();
    
    const reportId = `KHSS_${orderKey}_${Date.now()}`;
    
    // Prepare biomarker inputs - ONLY fields Suggestic accepts
    const biomarkerInputs = biomarkers.map(b => {
        const isAbnormal = b.abnormalFlag && b.abnormalFlag !== '' && b.abnormalFlag.toLowerCase() !== 'no';
        
        return {
            biomarkerId: b.id,
            // biomarkerUnitId: null, // Would need to look up Suggestic's unit IDs
            result: {
                value: b.value,
                unit: b.unit
            },
            date: b.collectionDateTime || b.resultDateTime,
            alert: isAbnormal,
            alertText: isAbnormal ? `${b.abnormalFlag}: Outside range ${b.referenceRange}` : null,
            displayValue: `${b.value} ${b.unit}`
        };
    });

    const mutation = `
        mutation AddBiomarkerResults($input: AddBiomarkerResultsInput!) {
            addBiomarkerResults(input: $input) {
                success
                message
            }
        }
    `;

    const variables = {
        input: {
            labTestReportId: reportId,
            biomarkers: biomarkerInputs
        }
    };

    try {
        const result = await sgClient.query(mutation, userId, variables);
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
