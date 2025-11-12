// ==UserScript==
// @name         cPanel Services Note Manager
// @namespace    http://tampermonkey.net/
// @version      2025-01-06
// @description  Add note boxes for cPanel services by IP address
// @author       You
// @match        https://store.cpanel.net/clientarea.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=cpanel.net
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Wait for the page to fully load
    function waitForElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
        } else {
            setTimeout(() => waitForElement(selector, callback), 100);
        }
    }

    function addNoteBoxes() {
        const serviceItems = document.querySelectorAll('#servicesPanel .div-service-item');

        serviceItems.forEach(item => {
            // Extract IP address from the service item
            const ipElement = item.querySelector('.text-domain');
            if (!ipElement) return;

            const ipAddress = ipElement.textContent.trim();

            // Check if note box already exists
            if (item.querySelector('.service-note-box')) return;

            // Create minimal note input
            const noteInput = document.createElement('input');
            noteInput.type = 'text';
            noteInput.className = 'service-note-box';
            noteInput.placeholder = `Note...`;
            noteInput.style.cssText = `
                width: 200px;
                height: 25px;
                margin-left: 10px;
                border: 1px solid #ddd;
                border-radius: 3px;
                padding: 3px 6px;
                font-size: 11px;
                background-color: #fafafa;
                vertical-align: middle;
            `;

            // Load existing note from localStorage
            const savedNote = localStorage.getItem(`cpanel_note_${ipAddress}`);
            if (savedNote) {
                noteInput.value = savedNote;
            }

            // Save note on input change
            noteInput.addEventListener('input', function(e) {
                e.stopPropagation();
                const noteValue = this.value.trim();
                if (noteValue) {
                    localStorage.setItem(`cpanel_note_${ipAddress}`, noteValue);
                } else {
                    localStorage.removeItem(`cpanel_note_${ipAddress}`);
                }
            });

            // Prevent clicks from navigating
            noteInput.addEventListener('click', function(e) {
                e.stopPropagation();
            });

            // Insert note box inline with the service buttons
            const buttonsDiv = item.querySelector('.div-service-buttons');
            if (buttonsDiv) {
                buttonsDiv.appendChild(noteInput);
            }
        });
    }

    // Initialize when the services panel is loaded
    waitForElement('#servicesPanel', () => {
        addNoteBoxes();

        // Also watch for any dynamic content changes
        const observer = new MutationObserver(() => {
            addNoteBoxes();
        });

        observer.observe(document.querySelector('#servicesPanel'), {
            childList: true,
            subtree: true
        });
    });
})();