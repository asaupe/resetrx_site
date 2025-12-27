const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { getSuggesticClient } = require('./utils/api-wrapper');

/**
 * Calculate user wellness score from Suggestic data and plan compliance
 * Aggregates pillar scores (Sleep, Movement, Mindfulness) into 0-5 scale
 */

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { profileId } = JSON.parse(event.body);

        if (!profileId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'profileId is required' 
                })
            };
        }

        const client = getSuggesticClient();

        // Date range: last 7 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        console.log('Fetching Suggestic data for:', profileId, 'from', startDateStr, 'to', endDateStr);

        // Fetch real data from Suggestic
        const [sleepData, sleepQualityData, stepsData, movementData] = await Promise.all([
            client.getSleepData(profileId, startDateStr, endDateStr).catch(err => {
                console.error('Sleep data error:', err);
                return { edges: [], dailyGoal: 480, totalTime: 0 };
            }),
            client.getSleepQualityData(profileId, startDateStr, endDateStr).catch(err => {
                console.error('Sleep quality error:', err);
                return { edges: [], average: 0 };
            }),
            client.getStepsData(profileId, startDateStr, endDateStr).catch(err => {
                console.error('Steps data error:', err);
                return { edges: [], dailyGoal: 10000 };
            }),
            client.getMovementData(profileId, startDateStr, endDateStr).catch(err => {
                console.error('Movement data error:', err);
                return { edges: [] };
            })
        ]);

        console.log('Suggestic data fetched:', {
            sleepEntries: sleepData.edges?.length || 0,
            sleepQualityEntries: sleepQualityData.edges?.length || 0,
            stepsEntries: stepsData.edges?.length || 0,
            movementEntries: movementData.edges?.length || 0
        });

        // Calculate averages from the data
        const avgSleepTime = sleepData.edges?.length > 0
            ? sleepData.edges.reduce((sum, edge) => sum + (edge.node.value || 0), 0) / sleepData.edges.length
            : 0;
        
        const avgSleepQuality = sleepQualityData.edges?.length > 0
            ? sleepQualityData.edges.reduce((sum, edge) => sum + (edge.node.value || 0), 0) / sleepQualityData.edges.length
            : 0;
        
        const avgSteps = stepsData.edges?.length > 0
            ? stepsData.edges.reduce((sum, edge) => sum + (edge.node.steps || 0), 0) / stepsData.edges.length
            : 0;
        
        const avgExercise = movementData.edges?.length > 0
            ? movementData.edges.reduce((sum, edge) => sum + (edge.node.durationMinutes || 0), 0) / movementData.edges.length
            : 0;

        const profile = {
            id: profileId,
            sleepTime: Math.round(avgSleepTime),
            sleepQuality: Math.round(avgSleepQuality),
            steps: Math.round(avgSteps),
            exercise: Math.round(avgExercise),
            program: null
        };

        console.log('Profile data (calculated from Suggestic):', profile);
        
        // Get assigned wellness programs (simplified for now)
        const assignedPrograms = [];
        
        // Load matching JSON plan files
        const planData = await loadAssignedPlans(assignedPrograms);
        
        // Calculate pillar scores with plan context
        const scores = calculatePillarScores(profile, planData);
        
        // Calculate overall score (average of all pillars)
        const overallScore = calculateOverallScore(scores);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                data: {
                    profileId: profile.id,
                    name: 'User', // firstName/lastName not available in this schema
                    scores: {
                        overall: overallScore,
                        sleep: scores.sleep,
                        movement: scores.movement,
                        mindfulness: scores.mindfulness,
                        nutrition: scores.nutrition
                    },
                    rawData: {
                        sleepTime: profile.sleepTime || 0,
                        sleepQuality: profile.sleepQuality || 0,
                        steps: profile.steps || 0,
                        exercise: profile.exercise || 0,
                        mealCompliance: 0 // Not yet available
                    },
                    assignedPrograms: profile.program ? [profile.program] : [],
                    planData: planData.map(p => ({ pillar: p.pillar, title: p.data.title }))
                }
            })
        };

    } catch (error) {
        console.error('Calculate score error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

/**
 * Calculate average value from Suggestic edges array
 */
function calculateAverage(edges) {
    if (!edges || edges.length === 0) return 0;
    
    const values = edges.map(edge => edge.node.value).filter(v => v != null);
    if (values.length === 0) return 0;
    
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Load JSON plan files that match assigned programs
 */
async function loadAssignedPlans(assignedPrograms) {
    const contentDir = path.join(__dirname, '../../content');
    const plans = [];
    
    try {
        const files = await fs.readdir(contentDir);
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            // Parse filename: Sleep-1-1.json, Movement-2-1.json, etc.
            const match = file.match(/^(Sleep|Movement|Mindfulness|Nutrition)-(\d+)-(\d+)\.json$/);
            if (!match) continue;
            
            const [, pillar, week, day] = match;
            
            // Check if this pillar is in assigned programs
            const isAssigned = assignedPrograms.some(program => 
                program.name.toLowerCase().includes(pillar.toLowerCase()) ||
                program.category === pillar.toUpperCase()
            );
            
            if (isAssigned) {
                const filePath = path.join(contentDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const data = JSON.parse(content);
                
                plans.push({
                    pillar,
                    week: parseInt(week),
                    day: parseInt(day),
                    filename: file,
                    data
                });
            }
        }
        
        console.log(`Loaded ${plans.length} plan files for assigned programs`);
        return plans;
        
    } catch (error) {
        console.error('Error loading plan files:', error);
        return [];
    }
}

/**
 * Calculate individual pillar scores on 0-5 scale
 */
function calculatePillarScores(profile, planData) {
    // Find plan data for each pillar
    const sleepPlan = planData.find(p => p.pillar === 'Sleep');
    const movementPlan = planData.find(p => p.pillar === 'Movement');
    const mindfulnessPlan = planData.find(p => p.pillar === 'Mindfulness');
    
    return {
        sleep: calculateSleepScore(profile, sleepPlan),
        movement: calculateMovementScore(profile, movementPlan),
        mindfulness: calculateMindfulnessScore(profile, mindfulnessPlan),
        nutrition: calculateNutritionScore(profile)
    };
}

/**
 * Sleep score (0-5) based on duration and quality
 * Enhanced with plan-specific goals if available
 */
function calculateSleepScore(profile, sleepPlan) {
    const sleepHours = (profile.sleepTime || 0) / 60; // Already in minutes, convert to hours
    const quality = profile.sleepQuality || 0; // Already 0-100 scale
    
    // If we have a plan, check for specific goals
    let targetHours = { min: 7, max: 9 }; // Default target
    if (sleepPlan?.data?.sections) {
        // Look for goals in the plan (e.g., "Increase sleep duration from 4-5 hours to 5-6 hours")
        const goalSection = sleepPlan.data.sections.find(s => s.title === "Overall Goals");
        if (goalSection) {
            // Parse goals for sleep targets (this can be enhanced)
            console.log('Sleep plan goals:', goalSection.items);
        }
    }
    
    let durationScore = 0;
    if (sleepHours >= targetHours.min && sleepHours <= targetHours.max) {
        durationScore = 5;
    } else if (sleepHours >= 6 && sleepHours < 7) {
        durationScore = 3.5;
    } else if (sleepHours >= 5 && sleepHours < 6) {
        durationScore = 2;
    } else if (sleepHours >= 4 && sleepHours < 5) {
        durationScore = 1;
    } else if (sleepHours > 9 && sleepHours <= 10) {
        durationScore = 4;
    } else {
        durationScore = 0.5;
    }
    
    // Quality score: 0-100 → 0-5
    const qualityScore = (quality / 100) * 5;
    
    // Average duration and quality
    return Math.min(5, (durationScore + qualityScore) / 2);
}

/**
 * Movement score (0-5) based on steps and exercise
 * Enhanced with plan-specific goals if available
 */
function calculateMovementScore(profile, movementPlan) {
    const steps = profile.steps || 0;
    const exerciseMinutes = profile.exercise || 0;
    
    // If we have a plan, check for specific goals
    if (movementPlan?.data?.sections) {
        const goalSection = movementPlan.data.sections.find(s => s.title === "Overall Goals");
        if (goalSection) {
            console.log('Movement plan goals:', goalSection.items);
        }
    }
    
    // Steps score (0-5)
    let stepsScore = 0;
    if (steps >= 10000) {
        stepsScore = 5;
    } else if (steps >= 7500) {
        stepsScore = 4;
    } else if (steps >= 5000) {
        stepsScore = 3;
    } else if (steps >= 2500) {
        stepsScore = 2;
    } else if (steps >= 1000) {
        stepsScore = 1;
    } else {
        stepsScore = 0;
    }
    
    // Exercise score (0-5) - target 150 min/week = ~21 min/day
    let exerciseScore = 0;
    if (exerciseMinutes >= 30) {
        exerciseScore = 5;
    } else if (exerciseMinutes >= 20) {
        exerciseScore = 4;
    } else if (exerciseMinutes >= 15) {
        exerciseScore = 3;
    } else if (exerciseMinutes >= 10) {
        exerciseScore = 2;
    } else if (exerciseMinutes >= 5) {
        exerciseScore = 1;
    } else {
        exerciseScore = 0;
    }
    
    // Weighted average (steps 40%, exercise 60%)
    return Math.min(5, (stepsScore * 0.4 + exerciseScore * 0.6));
}

/**
 * Mindfulness score (0-5)
 * Enhanced with plan-specific goals if available
 */
function calculateMindfulnessScore(profile, mindfulnessPlan) {
    // If we have a plan, check for specific goals
    if (mindfulnessPlan?.data?.sections) {
        const goalSection = mindfulnessPlan.data.sections.find(s => s.title === "Overall Goals");
        if (goalSection) {
            console.log('Mindfulness plan goals:', goalSection.items);
        }
    }
    
    // TODO: Add mindfulness-specific metrics when available
    // For now, return neutral score
    return 2.5;
}

/**
 * Nutrition score (0-5) based on meal plan compliance
 */
function calculateNutritionScore(profile) {
    const compliance = profile.mealTracking?.percentageCompleted || 0;
    
    // Convert 0-100% to 0-5 scale
    return (compliance / 100) * 5;
}

/**
 * Calculate overall score as average of all pillar scores
 */
function calculateOverallScore(scores) {
    const validScores = Object.values(scores).filter(s => s !== null && s !== undefined);
    
    if (validScores.length === 0) {
        return 0;
    }
    
    const sum = validScores.reduce((a, b) => a + b, 0);
    const average = sum / validScores.length;
    
    // Round to 1 decimal place
    return Math.round(average * 10) / 10;
}
