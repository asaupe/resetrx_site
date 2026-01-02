# ResetRx Wellness Score Algorithm

## Overview
Your wellness score is a simple 0-5 rating that shows how well you're doing across four key areas of health. Think of it like a report card for your body - but instead of letter grades, you get a number that's easy to understand and track over time.

## The Four Pillars of Wellness

Your overall score is based on four equally important pillars:
1. **Sleep** - How well you're resting
2. **Movement** - How active you are
3. **Mindfulness** - Your mental wellness
4. **Nutrition** - What you're eating

Each pillar gets its own score from 0 to 5, and your overall score is simply the average of all four.

---

## How Each Pillar is Scored

### 1. Sleep Score (0-5)

Your sleep score looks at two things:
- **Duration**: How many hours you sleep
- **Quality**: How good that sleep is (if available from your tracker)

#### Sleep Duration Scoring:
- **5 points**: 7-9 hours (the sweet spot!)
- **4 points**: 9-10 hours (good, but a bit too much)
- **3.5 points**: 6-7 hours (getting there)
- **2 points**: 5-6 hours (needs improvement)
- **1 point**: 4-5 hours (not enough rest)
- **0.5 points**: Less than 4 or more than 10 hours

#### Sleep Quality (if available):
- Converted from 0-100% to a 0-5 scale
- Example: 80% quality = 4 points

**How we combine them:**
- If you have both duration AND quality data: We average the two scores
- If quality data is missing: We only use duration (no penalty!)

**Example:** 
- You sleep 7.5 hours (5 points) with 80% quality (4 points)
- Your sleep score = (5 + 4) / 2 = **4.5 out of 5** ⭐

---

### 2. Movement Score (0-5)

Movement is scored based on two activities:
- **Steps**: How much you're walking throughout the day
- **Exercise**: Active workout minutes

#### Steps Scoring (worth 40% of movement):
- **5 points**: 10,000+ steps
- **4 points**: 7,500-9,999 steps
- **3 points**: 5,000-7,499 steps
- **2 points**: 2,500-4,999 steps
- **1 point**: 1,000-2,499 steps
- **0 points**: Less than 1,000 steps

#### Exercise Scoring (worth 60% of movement):
- **5 points**: 30+ minutes
- **4 points**: 20-29 minutes
- **3 points**: 15-19 minutes
- **2 points**: 10-14 minutes
- **1 point**: 5-9 minutes
- **0 points**: Less than 5 minutes

**How we combine them:**
- Steps score × 40% + Exercise score × 60%

**Example:**
- You walk 8,500 steps (4 points) and exercise 25 minutes (4 points)
- Your movement score = (4 × 0.4) + (4 × 0.6) = **4.0 out of 5** 💪

---

### 3. Mindfulness Score (0-5)

Currently being developed! This will track:
- Meditation minutes
- Stress management activities
- Mental wellness check-ins

For now, this returns a neutral score of **2.5** as a placeholder.

---

### 4. Nutrition Score (0-5)

Nutrition is scored based on how well you're following your personalized meal plan.

#### Meal Plan Compliance:
- **5 points**: 100% compliance (following your plan perfectly)
- **4 points**: 80% compliance
- **3 points**: 60% compliance
- **2 points**: 40% compliance
- **1 point**: 20% compliance
- **0 points**: Not tracking meals

**Example:**
- You followed your meal plan for 8 out of 10 meals = 80% compliance
- Your nutrition score = **4.0 out of 5** 🥗

---

## Overall Score Calculation

Your overall wellness score is simply the **average** of all four pillar scores.

### Example Calculation:
```
Sleep Score:       5.0
Movement Score:    4.6
Mindfulness Score: 2.5
Nutrition Score:   0.0
----------------------------
Total:            12.1
Divided by 4:      3.0

Overall Score = 3.0 out of 5
```

---

## What Your Score Means

### 🌟 Excellent (3.5 - 5.0)
You're doing great! The app celebrates your best pillar with a compliment based on your actual data:
- "8,604 steps! You're absolutely crushing it! 💪"
- "7.1 hours of sleep! You're a rest champion! 😴"

### 💪 Good Progress (1.5 - 3.4)
You're on the right track! The app gently nudges you to improve your weakest pillar:
- "0% meal plan compliance - let's push to 80%+! 🥗"
- "5,000 steps today. How about adding 1,000 more? 🎯"

### 🌱 Getting Started (0 - 1.4)
Just beginning your wellness journey! The app encourages you to start tracking:
- "Your wellness journey is waiting to begin! Let's get some data flowing. 📊"
- "Time to turn on those tracking tools – your future self will thank you! 🚀"

---

## Important Notes

### Data Collection Period
- All scores are based on the **last 7 days** of data
- This gives a fair picture of your recent habits without being affected by one bad day

### Missing Data
- If a data point is missing (like sleep quality), we work with what we have
- You're never penalized for data your device doesn't track
- Scores are only calculated from available information

### Why These Numbers?
The scoring criteria are based on:
- **Sleep**: CDC and National Sleep Foundation guidelines (7-9 hours)
- **Movement**: American Heart Association recommendations (10,000 steps, 150 min/week exercise)
- **Nutrition**: Personalized to your specific meal plan and health goals

---

## Your Personalized Messages

Every message you see references YOUR actual data:
- "You're at **4,200 steps** - the 10K goal is within reach!"
- "**6.2 hours** isn't quite enough - let's aim for 7-9!"
- "**45% meal compliance** - small improvements add up!"

This makes the feedback feel intelligent and relevant to your real progress, not just generic advice.

---

## The Bottom Line

Your wellness score isn't about being perfect - it's about **awareness and progress**. 

- Track your habits
- Watch your scores improve
- Celebrate your wins
- Learn from the data

Small, consistent improvements in each pillar add up to big changes in your overall health! 🎯
