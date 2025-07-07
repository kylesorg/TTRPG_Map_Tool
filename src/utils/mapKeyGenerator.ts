// Utility for generating unique map keys
import { BackgroundImageAPI } from './backgroundImageAPI';

/**
 * Generates a random 16-character alphanumeric string
 */
function generateRandomKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Checks if a map key already exists using the lightweight check endpoint
 */
async function keyExists(mapKey: string): Promise<boolean> {
    try {
        return await BackgroundImageAPI.checkMapExists(mapKey);
    } catch (error) {
        return false; // If there's an error, assume key doesn't exist
    }
}

/**
 * Generates a unique 16-character map key that doesn't already exist
 * Will loop until it finds a unique key (virtually guaranteed on first try)
 */
export async function generateUniqueMapKey(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 100; // Safety limit, though collision is extremely unlikely

    while (attempts < maxAttempts) {
        const newKey = generateRandomKey();
        const exists = await keyExists(newKey);

        if (!exists) {
            console.log(`Generated unique map key: ${newKey} (attempt ${attempts + 1})`);
            return newKey;
        }

        attempts++;
        console.log(`Key collision detected: ${newKey}, trying again...`);
    }

    // Fallback if we somehow can't generate a unique key
    throw new Error('Failed to generate unique map key after maximum attempts');
}

/**
 * Checks if a map key is considered "default" and should not be modified
 */
export function isDefaultKey(mapKey: string): boolean {
    const defaultPatterns = [
        'default',
        'default_map',
        'default_key',
        'test',
        'demo',
        'sample'
    ];

    const lowerKey = mapKey.toLowerCase();
    return defaultPatterns.some(pattern => lowerKey.includes(pattern));
}

/**
 * Ensures we have a valid, non-default map key for saving
 * If current key is default, generates a new unique key
 */
export async function ensureValidMapKey(currentKey: string): Promise<string> {
    if (isDefaultKey(currentKey)) {
        console.log(`Current key "${currentKey}" is protected, generating new key...`);
        return await generateUniqueMapKey();
    }
    return currentKey;
}
