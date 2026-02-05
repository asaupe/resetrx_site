/**
 * Utility functions for working with Suggestic custom attributes
 * Provides a clean interface for reading and writing custom attributes
 */

/**
 * Get all custom attributes for a user
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @returns {Promise<Array>} Array of custom attributes
 */
async function getCustomAttributes(sgClient, userId) {
    const query = `
        query {
            myProfile {
                id
                customAttributes
            }
        }
    `;
    
    const result = await sgClient.query(query, userId);
    const customAttributes = result.myProfile?.customAttributes;
    
    if (!customAttributes) {
        return [];
    }
    
    return JSON.parse(customAttributes);
}

/**
 * Get a specific custom attribute by name
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {string} attributeName - Name of the attribute to retrieve
 * @returns {Promise<string|null>} Attribute value or null if not found
 */
async function getCustomAttribute(sgClient, userId, attributeName) {
    const attributes = await getCustomAttributes(sgClient, userId);
    // Support both 'key' and 'name' fields for compatibility
    const attribute = attributes.find(attr => 
        attr.key === attributeName || attr.name === attributeName
    );
    
    return attribute ? attribute.value : null;
}

/**
 * Get a custom attribute parsed as JSON
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {string} attributeName - Name of the attribute to retrieve
 * @param {*} defaultValue - Default value if attribute doesn't exist
 * @returns {Promise<*>} Parsed JSON value or default
 */
async function getCustomAttributeJSON(sgClient, userId, attributeName, defaultValue = null) {
    const value = await getCustomAttribute(sgClient, userId, attributeName);
    
    if (!value) {
        return defaultValue;
    }
    
    try {
        return JSON.parse(value);
    } catch (error) {
        console.warn(`Failed to parse custom attribute ${attributeName} as JSON:`, error.message);
        return defaultValue;
    }
}

/**
 * Set a single custom attribute
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {string} attributeName - Name of the attribute
 * @param {string} value - Value to set
 * @param {string} category - Optional category for organization
 * @returns {Promise<boolean>} Success status
 */
async function setCustomAttribute(sgClient, userId, attributeName, value, category = null) {
    const mutation = `
        mutation SetCustomAttribute($attributes: [ProfileCustomAttribute!]!) {
            createProfileCustomAttributes(
                append: true
                attributes: $attributes
            ) {
                success
                errors {
                    field
                    messages
                }
            }
        }
    `;
    
    const attribute = {
        name: attributeName,
        dataType: 'STRING',
        value: value
    };
    
    if (category) {
        attribute.category = category;
    }
    
    const variables = {
        attributes: [attribute]
    };
    
    const result = await sgClient.query(mutation, userId, variables);
    
    if (result.createProfileCustomAttributes?.errors?.length > 0) {
        console.error(`Error setting custom attribute ${attributeName}:`, 
            result.createProfileCustomAttributes.errors);
        return false;
    }
    
    return result.createProfileCustomAttributes?.success || false;
}

/**
 * Set a custom attribute with a JSON value
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {string} attributeName - Name of the attribute
 * @param {*} value - Value to serialize and set
 * @param {string} category - Optional category for organization
 * @returns {Promise<boolean>} Success status
 */
async function setCustomAttributeJSON(sgClient, userId, attributeName, value, category = null) {
    return setCustomAttribute(sgClient, userId, attributeName, JSON.stringify(value), category);
}

/**
 * Set multiple custom attributes at once
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {Array} attributes - Array of {name, value, category?, dataType?} objects
 * @returns {Promise<boolean>} Success status
 */
async function setCustomAttributes(sgClient, userId, attributes) {
    const mutation = `
        mutation SetCustomAttributes($attributes: [ProfileCustomAttribute!]!) {
            createProfileCustomAttributes(
                append: true
                attributes: $attributes
            ) {
                success
                errors {
                    field
                    messages
                }
            }
        }
    `;
    
    // Ensure all attributes have required fields
    const formattedAttributes = attributes.map(attr => ({
        name: attr.name,
        dataType: attr.dataType || 'STRING',
        value: attr.value,
        ...(attr.category && { category: attr.category })
    }));
    
    const variables = {
        attributes: formattedAttributes
    };
    
    const result = await sgClient.query(mutation, userId, variables);
    
    if (result.createProfileCustomAttributes?.errors?.length > 0) {
        console.error('Error setting custom attributes:', 
            result.createProfileCustomAttributes.errors);
        return false;
    }
    
    return result.createProfileCustomAttributes?.success || false;
}

/**
 * Add an item to an array-type custom attribute
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {string} attributeName - Name of the array attribute
 * @param {*} item - Item to add to the array
 * @param {string} category - Optional category for organization
 * @returns {Promise<boolean>} Success status
 */
async function addToCustomAttributeArray(sgClient, userId, attributeName, item, category = null) {
    // Get current array
    const currentArray = await getCustomAttributeJSON(sgClient, userId, attributeName, []);
    
    // Add item if not already present
    if (!currentArray.includes(item)) {
        currentArray.push(item);
        return setCustomAttributeJSON(sgClient, userId, attributeName, currentArray, category);
    }
    
    return true; // Already exists, no need to update
}

/**
 * Remove an item from an array-type custom attribute
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {string} attributeName - Name of the array attribute
 * @param {*} item - Item to remove from the array
 * @param {string} category - Optional category for organization
 * @returns {Promise<boolean>} Success status
 */
async function removeFromCustomAttributeArray(sgClient, userId, attributeName, item, category = null) {
    // Get current array
    const currentArray = await getCustomAttributeJSON(sgClient, userId, attributeName, []);
    
    // Remove item if present
    const newArray = currentArray.filter(i => i !== item);
    
    if (newArray.length !== currentArray.length) {
        return setCustomAttributeJSON(sgClient, userId, attributeName, newArray, category);
    }
    
    return true; // Item not in array, no need to update
}

/**
 * Check if an item exists in an array-type custom attribute
 * @param {Object} sgClient - Suggestic API client
 * @param {string} userId - Suggestic user ID
 * @param {string} attributeName - Name of the array attribute
 * @param {*} item - Item to check for
 * @returns {Promise<boolean>} True if item exists in array
 */
async function isInCustomAttributeArray(sgClient, userId, attributeName, item) {
    const currentArray = await getCustomAttributeJSON(sgClient, userId, attributeName, []);
    return currentArray.includes(item);
}

module.exports = {
    getCustomAttributes,
    getCustomAttribute,
    getCustomAttributeJSON,
    setCustomAttribute,
    setCustomAttributeJSON,
    setCustomAttributes,
    addToCustomAttributeArray,
    removeFromCustomAttributeArray,
    isInCustomAttributeArray
};
