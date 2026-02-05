# ResetRx - Personalized Wellness Platform

![ResetRx Logo](assets/images/ResetRxLogo_transparent.png)

A responsive, modern website for the ResetRx wellness platform, delivering personalized health and wellness coaching through an integrated, AI-powered approach.

## Overview

ResetRx integrates intelligent nutrition, adaptive fitness, and habit optimization into one seamless platform that easily connects with health trackers. Our solution redefines how people live healthier lives with personalized wellness coaching every step of the way.

## Features

- **Responsive Design**: Fully mobile-responsive interface that works on all devices
- **Modern UI**: Clean, professional design with attention to typography and spacing
- **Interactive Elements**: Hover effects, smooth scrolling, and mobile navigation
- **Integrated Contact Form**: Direct email submission through FormSubmit
- **Performance Optimized**: Fast loading with optimized images and minimal dependencies

## Technologies Used

- HTML5
- CSS3 (with custom properties and flexbox/grid layouts)
- JavaScript (vanilla)
- Font Awesome Icons
- Google Fonts
- Netlify Functions (serverless backend)
- Suggestic API (nutrition and biomarker tracking)
- Quest Diagnostics / KHSS API (lab results integration)
- FormSubmit (for contact form handling)
- GitHub Pages (for hosting)

## Backend Architecture

### Netlify Functions

The platform uses serverless functions to handle:
- **Quest Appointment Scheduling**: Two-step booking flow with KHSS API integration
- **Lab Results Sync**: Automated biomarker data sync from Quest to Suggestic
- **User Profile Management**: Custom attributes for tracking appointments and lab orders
- **Email Notifications**: Klaviyo integration for appointment confirmations

### Utilities

Located in `netlify/functions/utils/`:

#### Custom Attributes Utility (`custom-attributes.js`)

Reusable helper functions for managing Suggestic custom attributes:

```javascript
const { 
    getCustomAttribute,
    setCustomAttribute,
    addToCustomAttributeArray,
    isInCustomAttributeArray 
} = require('./utils/custom-attributes');

// Example: Check if order already synced
const alreadySynced = await isInCustomAttributeArray(
    sgClient, 
    userId, 
    'synced_quest_orders', 
    orderKey
);

// Example: Mark order as synced
await addToCustomAttributeArray(
    sgClient, 
    userId, 
    'synced_quest_orders', 
    orderKey, 
    'Quest Lab Results'
);

// Example: Store appointment data
await setCustomAttribute(
    sgClient,
    userId,
    'quest_appointment_id',
    appointmentId,
    'Quest Appointment'
);
```

Available functions:
- `getCustomAttributes(sgClient, userId)` - Get all custom attributes
- `getCustomAttribute(sgClient, userId, name)` - Get single attribute value
- `getCustomAttributeJSON(sgClient, userId, name, defaultValue)` - Get and parse JSON attribute
- `setCustomAttribute(sgClient, userId, name, value, category)` - Set single attribute
- `setCustomAttributeJSON(sgClient, userId, name, value, category)` - Set JSON attribute
- `setCustomAttributes(sgClient, userId, attributes)` - Set multiple attributes at once
- `addToCustomAttributeArray(sgClient, userId, name, item, category)` - Add item to array
- `removeFromCustomAttributeArray(sgClient, userId, name, item, category)` - Remove from array
- `isInCustomAttributeArray(sgClient, userId, name, item)` - Check if item exists in array

## Pages and Sections

1. **Hero Section**: Introducing ResetRx with a clear value proposition
2. **Benefits**: Highlighting nutrition, activity, and habit-building features
3. **Wellness Revolution**: Overview of the platform's unique approach
4. **How It Works**: Step-by-step explanation of the user journey
5. **Inspirational Quote**: Reinforcing the brand philosophy
6. **Health Transformation**: Visual testimonials and success metrics
7. **Contact Form**: Easy way for visitors to get in touch

## Deployment

This site is deployed using GitHub Pages. Any push to the main branch automatically updates the live site.

Live URL: [https://asaupe.github.io/resetrx_site/](https://asaupe.github.io/resetrx_site/)

## Local Development

To work on this project locally:

1. Clone the repository:
   ```
   git clone https://github.com/asaupe/resetrx_site.git
   ```

2. Open the project in your code editor

3. To view the site, open `index.html` in your browser

4. After making changes:
   ```
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```

## Contact

For more information about ResetRx, contact [eva@resetrx.live](mailto:eva@resetrx.live).

---

© 2025 ResetRx. All rights reserved.