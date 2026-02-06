const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { getSuggesticClient } = require('./utils/api-wrapper');

/**
 * Calculate user wellness score from Suggestic data and plan compliance
 * Aggregates pillar scores (Sleep, Movement, Mindfulness) into 0-5 scale
 */

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Check query parameters first (overrides body)
        const queryParams = event.queryStringParameters || {};
        const bodyData = event.body ? JSON.parse(event.body) : {};
        
        // user_id from query params overrides profileId from body
        const userId = queryParams.user_id || bodyData.profileId || process.env.SUGGESTIC_USER_ID;

        if (!userId) {
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

        console.log('Fetching Suggestic data for:', userId, 'from', startDateStr, 'to', endDateStr);

        // Detect user's device source (APPLE or HEALTHCONNECT)
        const source = await client.getUserSource(userId);
        console.log('Using data source:', source);

        // Fetch real data from Suggestic
        const [sleepData, sleepQualityData, stepsData, movementData, nutritionData] = await Promise.all([
            client.getSleepData(userId, startDateStr, endDateStr, source).catch(err => {
                console.error('Sleep data error:', err);
                return { edges: [], dailyGoal: 480, totalTime: 0 };
            }),
            client.getSleepQualityData(userId, startDateStr, endDateStr, source).catch(err => {
                console.error('Sleep quality error:', err);
                return { edges: [], average: 0 };
            }),
            client.getStepsData(userId, startDateStr, endDateStr, source).catch(err => {
                console.error('Steps data error:', err);
                return { edges: [], dailyGoal: 10000 };
            }),
            client.getMovementData(userId, startDateStr, endDateStr, source).catch(err => {
                console.error('Movement data error:', err);
                return { edges: [] };
            }),
            client.getNutritionData(userId, startDateStr, endDateStr).catch(err => {
                console.error('Nutrition data error:', err);
                return { percentageCompleted: 0, mealsLogged: 0, mealsExpected: 0 };
            })
        ]);

        console.log('Suggestic data fetched:', {
            sleepEntries: sleepData.edges?.length || 0,
            sleepQualityEntries: sleepQualityData.edges?.length || 0,
            stepsEntries: stepsData.edges?.length || 0,
            movementEntries: movementData.edges?.length || 0,
            nutritionCompliance: nutritionData.percentageCompleted || 0
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
            id: userId,
            sleepTime: Math.round(avgSleepTime),
            sleepQuality: Math.round(avgSleepQuality),
            steps: Math.round(avgSteps),
            exercise: Math.round(avgExercise),
            mealTracking: {
                percentageCompleted: nutritionData.percentageCompleted || 0,
                mealsLogged: nutritionData.mealsLogged || 0,
                mealsExpected: nutritionData.mealsExpected || 0
            },
            program: null
        };

        console.log('Profile data (calculated from Suggestic):', profile);
        
        // Check if user has any real tracking data
        const hasTrackingData = (
            (profile.sleepTime && profile.sleepTime > 0) ||
            (profile.steps && profile.steps > 0) ||
            (profile.exercise && profile.exercise > 0) ||
            (profile.mealTracking && profile.mealTracking.percentageCompleted > 0)
        );

        // If no tracking data, return N/A response
        if (!hasTrackingData) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    data: {
                        profileId: userId,
                        name: 'User',
                        scores: {
                            overall: 'N/A',
                            sleep: 'N/A',
                            movement: 'N/A',
                            mindfulness: 'N/A',
                            nutrition: 'N/A'
                        },
                        message: "We don't have any tracking data yet! Connect your wearable device or start logging your activities to see your wellness score. 📱",
                        noData: true,
                        rawData: {
                            sleepTime: 0,
                            sleepQuality: 0,
                            steps: 0,
                            exercise: 0,
                            mealCompliance: 0
                        }
                    }
                })
            };
        }
        
        // Get assigned wellness programs (simplified for now)
        const assignedPrograms = [];
        
        // Load matching JSON plan files
        const planData = await loadAssignedPlans(assignedPrograms);
        
        // Calculate pillar scores with plan context
        const scores = calculatePillarScores(profile, planData);
        
        // Calculate overall score (average of all pillars)
        const overallScore = calculateOverallScore(scores);

        // Generate motivational message based on score and performance
        const message = generateMotivationalMessage(overallScore, scores, profile);

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
                    message: message,
                    rawData: {
                        sleepTime: profile.sleepTime || 0,
                        sleepQuality: profile.sleepQuality || 0,
                        steps: profile.steps || 0,
                        exercise: profile.exercise || 0,
                        mealCompliance: Math.round(profile.mealTracking?.percentageCompleted || 0)
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
    const quality = profile.sleepQuality || null; // null if not available
    
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
    
    // Quality score: only use if available, otherwise just use duration
    if (quality !== null && quality > 0) {
        const qualityScore = (quality / 100) * 5;
        // Average duration and quality
        return Math.min(5, (durationScore + qualityScore) / 2);
    } else {
        // No quality data - use duration only
        return durationScore;
    }
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

/**
 * Generate motivational message based on score and pillar performance
 */
function generateMotivationalMessage(overallScore, scores, profile) {
    // Extract actual metrics for personalization
    const steps = profile.steps || 0;
    const exerciseMinutes = profile.exerciseMinutes || 0;
    const sleepHours = Math.round((profile.sleepTime || 0) / 60 * 10) / 10; // Round to 1 decimal
    const sleepQuality = profile.sleepQuality || null;
    const mealCompliance = Math.round(profile.mealTracking?.percentageCompleted || 0);
    
    // High performance (3.5+) - Compliment their best pillar with actual data
    if (overallScore >= 3.5) {
        const bestPillar = Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a);
        const pillarName = bestPillar[0];
        const pillarScore = bestPillar[1];
        
        const highScoreMessages = {
            movement: [
                `${steps.toLocaleString()} steps! You're absolutely crushing it! 💪`,
                `${exerciseMinutes} minutes of exercise? That's what champions are made of! 🏆`,
                `With ${steps.toLocaleString()} steps today, you're basically unstoppable! 🚀`,
                `${exerciseMinutes} active minutes! Your body is doing a happy dance! 💃`,
                `Wow! ${steps.toLocaleString()} steps means you're walking the walk! 👟`,
                `${exerciseMinutes} minutes of movement magic! Keep it up! ✨`,
                `Your ${steps.toLocaleString()} steps are putting you in beast mode! 🦁`,
                `${exerciseMinutes} active minutes! Fitness level: Superhero! 🦸`,
                `Those ${steps.toLocaleString()} steps won't count themselves - oh wait, they did! 📱`,
                `${exerciseMinutes} minutes proves you're committed to excellence! 🌟`,
                `${steps.toLocaleString()} steps! Your sneakers deserve a medal! 🥇`,
                `Crushing ${exerciseMinutes} active minutes like a pro! 💥`,
                `${steps.toLocaleString()} steps = pure dedication! Love it! ❤️`,
                `${exerciseMinutes} minutes of activity! You're rewriting the rules! 📝`,
                `With ${steps.toLocaleString()} steps, you're basically a movement legend! 🎯`,
                `${exerciseMinutes} active minutes! Your fitness game is unmatched! 🔥`,
                `${steps.toLocaleString()} steps! Your couch called - it misses you! 🛋️`,
                `${exerciseMinutes} minutes of pure awesome! Keep slaying! 👑`,
                `Your ${steps.toLocaleString()} steps are making other trackers jealous! 📊`,
                `${exerciseMinutes} active minutes! That's the energy we love to see! ⚡`,
            ],
            sleep: [
                `${sleepHours} hours of sleep! You're a rest champion! 😴`,
                `Sleeping ${sleepHours} hours - your body is thanking you! 🛌`,
                `${sleepHours} hours! That's the sweet spot for recovery! 💤`,
                sleepQuality ? `${sleepHours}h with ${sleepQuality}% quality - sleep mastery! ⭐` : `${sleepHours} hours - you're crushing the sleep game! ✨`,
                `${sleepHours} hours of pure rest! Keep it up! 🌙`,
                sleepQuality ? `Quality at ${sleepQuality}% and ${sleepHours}h duration - perfection! 🏆` : `${sleepHours} hours - your pillow is doing a happy dance! 🎵`,
                `${sleepHours} hours! Your circadian rhythm is on point! ⌚`,
                `Logging ${sleepHours} hours nightly - that's consistency! 📊`,
                sleepQuality ? `${sleepQuality}% quality sleep - absolutely legendary! 🌟` : `${sleepHours} hours - sleep excellence achieved! 🥇`,
                `${sleepHours} hours means you're prioritizing recovery! 💪`,
                `${sleepHours} hours! Your body's repair shop is working overtime! 🔧`,
                sleepQuality ? `${sleepHours}h + ${sleepQuality}% quality = wellness gold! 💛` : `${sleepHours} hours - dreams approved! 💭`,
                `${sleepHours} hours of shuteye! Sleep goals achieved! 🎯`,
                `${sleepHours} hours! That's what champions are made of! 🏅`,
                sleepQuality ? `Sleep quality: ${sleepQuality}%. Duration: ${sleepHours}h. Both crushing! 🚀` : `${sleepHours} hours - you're sleeping like a pro! 😴`,
                `${sleepHours} hours! Your wellness journey loves this! ❤️`,
                `Nailing ${sleepHours} hours - rest royalty right here! 👑`,
                sleepQuality ? `${sleepQuality}% quality! Your sleep game is unmatched! 🔥` : `${sleepHours} hours - the sandman approves! ⭐`,
                `${sleepHours} hours nightly! Consistency is key! 🔑`,
                `${sleepHours} hours! Your body is sending thank-you notes! 💌`
            ],
            mindfulness: [
                "Zen master in training! Your inner peace is showing. 🧘",
                "Your mindfulness is on point – even your stress is stressed out! 🌟",
                "Calm, cool, and collected. Buddha would be proud! ☮️",
                "Your mind is so clear, it probably has a window cleaning service! 🧠",
                "Mental clarity champion! Your focus is legendary! 🎯",
                "Your mindfulness game is making meditation apps jealous! 📱",
                "Inner peace level: OFF THE CHARTS! Amazing! 📊",
                "Your mental wellness is basically a work of art! 🎨",
                "Stress management expert alert! You're crushing it! 🚨",
                "Your calm energy could power a wellness retreat! ⚡",
                "Mindfulness mastery achieved! Give yourself credit! 🏆",
                "Your mental health practice is inspiring! Keep it up! ✨",
                "Serenity now, serenity always! You've got this down! 🌊",
                "Your meditation stats are basically perfect! 💯",
                "Inner harmony on full display! Outstanding work! 🎵",
                "Your mindfulness consistency is breaking records! 📈",
                "Mental wellness warrior right here! Bravo! ⚔️",
                "Your stress levels are so low, they're practically napping! 😴",
                "Mindfulness influencer in the making! Incredible! 🌟",
                "Your mental clarity could cut glass! Sharp focus! 💎",
                "Zen achievement unlocked! You're on another level! 🔓",
                "Your mindfulness practice is basically meditation goals! 🧘‍♀️",
                "Peace, love, and perfect mental balance! You've got it! ☮️",
                "Your calm is contagious! Wellness approved! 💚",
                "Mental health champion status: CONFIRMED! 🏅",
                "Your mindfulness metrics deserve applause! 👏",
                "Inner peace ambassador right here! Amazing! 🌍",
                "Your meditation game is stronger than coffee! ☕",
                "Stress? Your mindfulness practice laughs at it! 😄",
                "Your mental wellness journey is a masterpiece! 🖼️",
                "Calm commander in action! Impressive work! 🎖️",
                "Your mindfulness consistency is goal-worthy! 🎯",
                "Mental clarity level: CRYSTAL CLEAR! 💎",
                "Your zen mode is permanently activated! Love it! 🌸",
                "Mindfulness expert status: ACHIEVED! 🎓",
                "Your inner peace is radiating outward! Brilliant! ☀️",
                "Mental wellness on point! You're setting standards! 📏",
                "Your calm could teach a masterclass! 🎙️",
                "Stress management: You're basically a professional! 💼",
                "Your mindfulness is making therapists proud! 🏥",
                "Inner balance achieved! Supreme effort! ⚖️",
                "Your mental health game is phenomenal! 🌟",
                "Mindfulness metrics: ALL GREEN! Outstanding! 🟢",
                "Your zen level could power a meditation center! 🏛️",
                "Mental wellness champion alert! You're it! 🚨",
                "Your inner peace is basically a superpower! 🦸",
                "Calm, centered, and crushing it! That's you! 💪",
                "Your mindfulness practice is hall-of-fame worthy! 🏆",
                "Mental clarity this good is pure excellence! ⭐",
                "Your stress levels are so managed, they filed for retirement! 📝"
            ],
            nutrition: [
                `${mealCompliance}% meal plan compliance! You're crushing it! 🥗`,
                `${mealCompliance}% on track! Your nutrition game is strong! 💪`,
                `Wow! ${mealCompliance}% compliance - that's dedication! 🏆`,
                `${mealCompliance}% following your plan! Nutrition excellence! ⭐`,
                `${mealCompliance}% meal plan success! Your body is celebrating! 🎉`,
                `Hitting ${mealCompliance}% - you're a nutrition champion! 👑`,
                `${mealCompliance}% compliance! That's what we call commitment! 💯`,
                `${mealCompliance}% on point! Your cells are doing the happy dance! 💃`,
                `${mealCompliance}% meal plan adherence! Outstanding work! 🌟`,
                `${mealCompliance}%! Fueling your body like a pro! 🚀`,
                `${mealCompliance}% compliance - nutrition mastery achieved! 🎯`,
                `${mealCompliance}% on track! Your fork deserves a medal! 🥇`,
                `Nailing ${mealCompliance}% - healthy eating champion! 🏅`,
                `${mealCompliance}% success! Your wellness journey loves this! ❤️`,
                `${mealCompliance}% meal compliance! Absolutely phenomenal! ✨`,
                `${mealCompliance}% on target! You're making it look easy! 😎`,
                `${mealCompliance}% plan adherence! Nutrition goals = crushed! 💥`,
                `${mealCompliance}%! Your body is sending thank-you notes! 💌`,
                `${mealCompliance}% compliance! That's gold standard eating! 🌟`,
                `Achieving ${mealCompliance}% - you're rewriting the rules! 📝`
            ]
        };
        
        const messages = highScoreMessages[pillarName] || ["You're crushing it! Keep up the amazing work! 🌟"];
        return messages[Math.floor(Math.random() * messages.length)];
    }
    
    // Moderate performance (1.5-3.5) - Suggest improvement in weakest pillar
    if (overallScore >= 1.5) {
        const worstPillar = Object.entries(scores).reduce((a, b) => b[1] < a[1] ? b : a);
        const pillarName = worstPillar[0];
        
        const moderateMessages = {
            movement: [
                `${steps.toLocaleString()} steps is a start! Let's aim higher tomorrow! 💚`,
                `${exerciseMinutes} active minutes - you can do more! Your body is ready! 💪`,
                `${steps.toLocaleString()} steps today. How about adding 1,000 more? 🎯`,
                `${exerciseMinutes} minutes of movement. Let's push for 30! 🚀`,
                `You've got ${steps.toLocaleString()} steps - the 10K goal is within reach! 🏃`,
                `${exerciseMinutes} active minutes is good, but you're capable of more! ⭐`,
                `${steps.toLocaleString()} steps logged! Your next goal: beat this tomorrow! 📈`,
                `${exerciseMinutes} minutes counts! Let's build on that momentum! 🌟`,
                `${steps.toLocaleString()} steps - you're ${(10000 - steps).toLocaleString()} away from 10K! 🎯`,
                `${exerciseMinutes} active minutes! What if you added just 10 more? 🤔`,
                `${steps.toLocaleString()} steps is progress! Keep that momentum going! 💥`,
                `${exerciseMinutes} minutes of exercise - let's make tomorrow even better! 🌟`,
                `You hit ${steps.toLocaleString()} steps! Your muscles want more! 🦵`,
                `${exerciseMinutes} active minutes! Small increases = big results! 💪`,
                `${steps.toLocaleString()} steps today - tomorrow's a new opportunity! 🌅`,
                `${exerciseMinutes} minutes! Your heart would love some more cardio! ❤️`,
                `${steps.toLocaleString()} steps - you're on the path! Let's walk it! 🚶`,
                `${exerciseMinutes} active minutes - consistency will get you there! 🔑`,
                `You've walked ${steps.toLocaleString()} steps! Ready for a challenge? 🏆`,
                `${exerciseMinutes} minutes is something! Let's make it everything! ✨`
            ],
            sleep: [
                `${sleepHours} hours isn't quite enough - let's aim for 7-9! 😴`,
                `You're at ${sleepHours}h - just a bit more for optimal rest! 🛌`,
                `${sleepHours} hours of sleep. Your body wants ${7 - sleepHours > 0 ? Math.round((7 - sleepHours) * 10) / 10 + ' more' : 'consistency'}! 💤`,
                sleepQuality && sleepQuality < 70 ? `Sleep quality at ${sleepQuality}% - let's improve that routine! ⭐` : `${sleepHours}h logged - time to prioritize more ZZZs! 🌙`,
                `${sleepHours} hours - you're close to the sweet spot! Keep going! ✨`,
                `Getting ${sleepHours}h - let's push for that 7-9 hour range! 🎯`,
                sleepQuality ? `${sleepHours}h with ${sleepQuality}% quality - both need a boost! 💪` : `${sleepHours} hours - your pillow is waiting for more time! 🛌`,
                `You're sleeping ${sleepHours}h - almost there! Consistency is key! 🔑`,
                `${sleepHours} hours logged - your body is craving more! 💚`,
                `${sleepHours}h - better sleep = better you! Let's commit! 🌟`,
                sleepQuality && sleepQuality < 70 ? `Quality: ${sleepQuality}%. Let's work on that sleep hygiene! 🌙` : `${sleepHours} hours - time to make sleep a priority! ❤️`,
                `At ${sleepHours}h, you're ${Math.round((7 - sleepHours) * 60)} minutes from optimal! ⏰`,
                `${sleepHours} hours - your recovery mode needs more time! 🔧`,
                `${sleepHours}h of sleep - let's level up that rest game! 🎮`,
                sleepQuality ? `${sleepHours}h duration, ${sleepQuality}% quality - room for improvement! 📈` : `${sleepHours} hours - small changes, big impact! 💥`,
                `You got ${sleepHours}h - your future self wants more! 🚀`,
                `${sleepHours} hours sleep - consistency will get you there! 🏆`,
                `${sleepHours}h logged - let's build a better sleep routine! 🏛️`,
                `Sleeping ${sleepHours}h - your wellness journey needs more rest! 🌱`,
                `${sleepHours} hours - quality sleep is an investment in YOU! 💰`
            ],
            mindfulness: [
                "Time to take a breather – your mind deserves a spa day! 🧘",
                "A few minutes of mindfulness can go a long way! 🌟",
                "Your stress could use a timeout. Let's meditate on that! ☮️",
                "Mental wellness check-in: it's time to tune in! 🧠",
                "Your mind is ready for some peace and quiet! Give it space. 🌸",
                "Mindfulness moment needed! Your mental health matters. 💚",
                "Stress management alert! Time to breathe and reset. 😮‍💨",
                "Your inner peace is calling! Will you answer? 📞",
                "Mental clarity opportunity detected! Meditation awaits. 🎯",
                "Your mind could use a vacation! Even 5 minutes helps. ⏰",
                "Calm mode activation needed! You've got this. 🌊",
                "Your mental wellness deserves attention! Give it some. 👀",
                "Mindfulness boost available! Just add breath. 💨",
                "Your stress levels need managing! Let's start today. 📊",
                "Mental health matters! Time for some self-care. 💝",
                "Your mind is ready to find its center! Help it out. 🎯",
                "Meditation opportunity! Your inner peace is waiting. 🧘‍♀️",
                "Time to trade chaos for calm! You deserve it. ✨",
                "Your mental wellness meter needs a refill! 🔋",
                "Mindfulness mission: Make space for peace today! ☮️",
                "Your stress wants a vacation! Give it one. 🏝️",
                "Mental clarity calling! Time to tune in and chill out. 📻",
                "Your mind deserves a break! Mindfulness to the rescue. 🦸",
                "Calm commander mode needed! Activate peace protocol. 🎖️",
                "Your mental health goals need daily practice! Start small. 🌱",
                "Mindfulness moment available! Claim it now. ⏰",
                "Your inner zen is buried under stress! Let's dig it out. ⛏️",
                "Mental wellness opportunity! Your future self will thank you. 🙏",
                "Time to show your mind some TLC! It works hard for you. 💪",
                "Your stress management game needs leveling up! 🎮",
                "Meditation calling! Even a minute makes a difference. 📞",
                "Your mental clarity is cloudy! Let's clear the skies. ☁️➡️☀️",
                "Mindfulness investment = peace dividend! Start depositing. 💰",
                "Your calm is in there somewhere! Let's find it together. 🔍",
                "Mental health check-in time! How's your inner peace? 💭",
                "Your mind needs a reset! Breathe and reboot. 🔄",
                "Stress timeout needed! Your wellness demands it. ⏸️",
                "Mindfulness muscles need exercising! Let's flex them. 💪",
                "Your mental wellness portfolio needs attention! 📈",
                "Inner peace opportunity detected! Seize it. 🎯",
                "Time to trade tension for tranquility! You can do this. 🌊",
                "Your mind is ready for some calm cultivation! 🌱",
                "Meditation motivation needed! Your mental health is worth it. 💎",
                "Stress management starts with mindfulness! Let's begin. 🏁",
                "Your inner calm is hiding! Let's coax it out. 🐚",
                "Mental wellness calling! Time to answer and engage. 📞",
                "Mindfulness moment missed? There's always now! ⏰",
                "Your peace potential is unlimited! Let's unlock it. 🔓",
                "Calm creation opportunity! Your mind is ready. 🎨",
                "Mental health investment time! Future you is cheering! 📣"
            ],
            nutrition: [
                `${mealCompliance}% meal plan compliance - let's push to 80%+! 🥗`,
                `You're at ${mealCompliance}% - your body wants better fuel! 🍎`,
                `${mealCompliance}% on track - small changes = big results! 🌱`,
                mealCompliance > 0 ? `${mealCompliance}% compliance. You're ${100 - mealCompliance}% away from perfect! 🎯` : `Time to start tracking those meals - your body will thank you! 🎯`,
                `${mealCompliance}% - your nutrition game needs leveling up! 🎮`,
                `At ${mealCompliance}%, there's room to grow! Let's fuel right! 🥦`,
                `${mealCompliance}% meal plan - consistency is the key! 🔑`,
                mealCompliance > 0 ? `You're ${mealCompliance}% there - let's boost that nutrition! 🚀` : `Start tracking your meals - every journey begins somewhere! 🚀`,
                `${mealCompliance}% compliance - your cells want more nutrients! 💥`,
                `${mealCompliance}% on plan - time to prioritize healthy eating! ⭐`,
                mealCompliance > 20 ? `${mealCompliance}% - you can do this! Your body believes in you! 💪` : `Your body is ready for better nutrition! Let's start tracking! 💪`,
                `${mealCompliance}% today - let's make tomorrow's meals count! 🍽️`,
                mealCompliance > 0 ? `${mealCompliance}% meal plan - small improvements add up! 📈` : `Every meal is a chance to fuel your body right! Start tracking! 📈`,
                mealCompliance > 20 ? `You're hitting ${mealCompliance}% - aim higher, you've got this! 🌟` : `Time to start logging those meals - you've got this! 🌟`,
                `${mealCompliance}% compliance - your health is worth the effort! 💚`,
                `${mealCompliance}% on track - let's build better habits! 🏛️`,
                mealCompliance > 0 ? `At ${mealCompliance}%, keep building momentum! 🏃` : `Ready to start your nutrition journey? First meal: track it! 🏃`,
                mealCompliance > 0 ? `${mealCompliance}% meal adherence - your future self will thank you! 🙏` : `Your future self will thank you for starting to track! 🙏`,
                `${mealCompliance}% - nutrition is an investment in YOU! 💰`,
                mealCompliance > 0 ? `You've hit ${mealCompliance}% - let's fuel that body right! ⚡` : `Let's start fueling that body right - track your first meal! ⚡`
            ]
        };
        
        const messages = moderateMessages[pillarName] || ["You're on the right track! Small steps lead to big changes. 🌟"];
        return messages[Math.floor(Math.random() * messages.length)];
    }
    
    // Low performance (<1.5) - Encourage tracking
    const encouragementMessages = [
        "It's like a desert out there – might be time to start tracking! 🌵",
        "Your wellness journey is waiting to begin! Let's get some data flowing. 📊",
        "Time to turn on those tracking tools – your future self will thank you! 🚀",
        "Ready to start your wellness adventure? First step: track it! 🎯",
        "Your body has a story to tell – let's start listening! 📱",
        "Even the longest journey starts with tracking the first step! 🗺️",
        "Data detective mode needed! Your health mysteries await solving. 🔍",
        "Your wellness journey needs a starting line! Let's draw one. 🏁",
        "Tracking time! Your future healthy self is rooting for you! 📣",
        "Let's turn data into action! First, we need the data. 💾",
        "Your health journey starts with awareness! Track and learn. 🧠",
        "Wellness waiting! Time to start gathering your health intel. 🕵️",
        "Every expert started as a beginner! Let's begin tracking. 🌱",
        "Your body is full of insights! Let's start collecting them. 💡",
        "Data darkness detected! Time to flip on the tracking lights. 💡",
        "Your wellness potential is unlimited! Step one: start tracking. 🚀",
        "Health journey activation needed! Begin with data collection. ⚡",
        "Your body's been keeping secrets! Tracking reveals all. 🤐➡️📱",
        "Wellness wisdom starts with data! Let's get some flowing. 🌊",
        "Your health story is unwritten! Let's start the first chapter. 📖",
        "Tracking transforms! Ready to see your wellness evolve? 🦋",
        "Data is power! Let's power up your health journey. 🔋",
        "Your wellness GPS needs activation! Turn on tracking. 🗺️",
        "Health insights await! Just add consistent tracking. 💎",
        "Your body is a wonderland! Let's start exploring with data. 🎢",
        "Wellness revolution begins with one tracked metric! 🎯",
        "Your health journey deserves documentation! Start today. 📝",
        "Data drives change! Let's start collecting and evolving. 🚗",
        "Your wellness potential is waiting! Unlock it with tracking. 🔓",
        "Health awareness begins now! Activate those tracking tools. ⏰",
        "Your body's performance metrics need attention! Let's look. 👀",
        "Wellness journey loading... Please start tracking! ⏳",
        "Your health transformation starts with measurement! Begin! 📏",
        "Data collection = self-care! Show yourself some love. 💚",
        "Your wellness roadmap needs data points! Let's add some. 🗺️",
        "Health journey kickoff! First play: start tracking. 🏈",
        "Your body is ready to share its stats! Listen up! 👂",
        "Wellness wisdom through data! Let's start gathering. 🧙",
        "Your health metrics are hiding! Tracking finds them. 🔦",
        "Data-driven wellness awaits! Press start on tracking. ▶️",
        "Your journey to better health needs a GPS! Tracking is it. 📍",
        "Health insights are earned through tracking! Let's earn some. 💪",
        "Your wellness story needs a beginning! Chapter 1: Track. 📚",
        "Data is your health compass! Time to start navigating. 🧭",
        "Your body wants to communicate! Tracking is the language. 🗣️",
        "Wellness transformation waiting! Required: data collection. ⏰",
        "Your health potential is enormous! Step 1: start tracking. 🌟",
        "Data collection is self-discovery! Begin the journey. 🔍",
        "Your wellness evolution starts with tracking! Ready? Set? Go! 🏁",
        "Health awareness activation needed! Turn on those trackers. 🎚️",
        "Your body is an amazing machine! Let's start the diagnostics. 🔧"
    ];
    
    return encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
}
