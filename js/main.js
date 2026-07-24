import { startRoundupGame, setTranslations as setGameTranslations } from './game.js';
import { renderPage as renderPageFromModule } from './renderer.js';
import { loadLanguage as loadLanguageFromModule, applyTranslationsToDom } from './i18n.js';
import { initializeUI, switchVideo, showStaticAvatar } from './ui.js';

// Get references to the main interactive elements on the page
const hatButton = document.getElementById("hatButton");
const menu = document.getElementById("menu");
const stage = document.getElementById("stage");
const closeBtn = document.getElementById("closeBtn");
const content = document.getElementById("content");
const introVideo = document.getElementById("introVideo");

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        introVideo.play().catch(() => {});
    }
});

// --- STATE VARIABLES ---
let currentAvatarImg = "assets/teddy.png";
let currentAvatarId = "teddy"; // Add an ID for the current avatar
let currentPage = "Select Avatar"; // Track the current page
let translations = {}; // To store the loaded language JSON

// --- MENU CONTROLS ---

// --- PAGE AND CONTENT LOGIC ---

/**
 * Wrapper for the renderPage function from the renderer module.
 * It gathers all necessary context and passes it to the renderer.
 */
function renderPage(page) {
    currentPage = page; // Update the current page tracker
    const context = {
        content,
        introVideo,
        stage,
        translations,
        currentAvatarImg,
        currentAvatarId,
        switchVideo,
        showStaticAvatar: () => showStaticAvatar(currentAvatarImg),
        loadLanguage,
        updateAvatar: (img, id) => {
            currentAvatarImg = img;
            currentAvatarId = id;
        }
    };
    renderPageFromModule(page, context);
}

// --- LANGUAGE AND TRANSLATION ---

async function loadLanguage(language) {
    translations = await loadLanguageFromModule(language);
    setGameTranslations(translations); // Pass translations to the game module
    applyTranslations();
}

function applyTranslations() {
    // Apply translations to static text in the DOM (like menu items)
    applyTranslationsToDom();

    // Re-render the current page with the new translations
    renderPage(currentPage);
}

// --- INITIALIZATION ---

// Add a click listener to every link in the navigation menu
document.querySelectorAll("#menu a").forEach(item => {
    item.addEventListener("click", function(e){
        e.preventDefault();
        const page = this.dataset.page;
        renderPage(page);
        menu.classList.remove("open");
        document.body.classList.remove("menu-open");
    });
});

// Load the saved language (or default to English) and render the initial page
async function initializeApp() {
    initializeUI({
        menu,
        hatButton,
        closeBtn,
        stage,
        introVideo,
        content
    });

    const savedLanguage = localStorage.getItem("language") || "en";
    await loadLanguage(savedLanguage);
}

initializeApp();

// --- SERVICE WORKER REGISTRATION ---
// Register the service worker to enable video caching for offline use and
// improved performance.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => console.log('Service Worker registered:', registration))
            .catch(error => console.log('Service Worker registration failed:', error));
    });
}