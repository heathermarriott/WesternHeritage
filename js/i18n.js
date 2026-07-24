/**
 * Internationalization (i18n) Module
 *
 * This module handles loading language files and applying translations
 * to the user interface.
 */

let translations = {};

/**
 * Fetches a language JSON file and stores its contents.
 * @param {string} language - The language code to load (e.g., "en", "es").
 * @returns {Promise<Object>} A promise that resolves with the loaded translations object.
 */
export async function loadLanguage(language) {
    try {
        const response = await fetch(`${language}.json`);
        translations = await response.json();
        localStorage.setItem("language", language);
        return translations;
    } catch (error) {
        console.error("Error loading language file:", error);
        // Return an empty object on failure to prevent crashes
        return {};
    }
}

/**
 * Updates the text content of all elements with a `data-lang-key` attribute.
 */
export function applyTranslationsToDom() {
    document.documentElement.lang = localStorage.getItem("language") || "en";

    document.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.getAttribute('data-lang-key');
        const keys = key.split('.');
        let text = translations;
        // Traverse the nested translation object
        for (const k of keys) {
            text = text ? text[k] : undefined;
        }
        // Update the element's text if a translation was found
        if (text) {
            element.textContent = text;
        }
    });
}