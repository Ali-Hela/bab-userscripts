// ==UserScript==
// @name         WHMCS Personal Notes
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Add personal notes to support tickets in the WHMCS 8.2.1 admin area
// @author       Ali-Hela
// @match        *://*/*/supporttickets.php*
// @match        *://*/supporttickets.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // CSS Styles
    const styles = `
        .personal-notes-icon {
            cursor: pointer;
            margin-left: 5px;
            color: #007cba;
            font-size: 14px;
        }
        .personal-notes-icon:hover {
            color: #005a87;
        }
        .personal-notes-icon.has-note {
            color: #d63384;
        }
        .personal-note-display {
            display: block;
            margin-top: 5px;
            padding: 5px 8px;
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 3px;
            font-size: 12px;
            color: #856404;
            font-style: italic;
            max-width: 300px;
            word-wrap: break-word;
            white-space: pre-wrap;
        }
        .notes-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.4);
        }
        .notes-modal-content {
            background-color: #fefefe;
            margin: 15% auto;
            padding: 20px;
            border: 1px solid #888;
            width: 500px;
            max-width: 90%;
            border-radius: 5px;
        }
        .notes-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
        }
        .notes-close {
            color: #aaa;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        .notes-close:hover {
            color: black;
        }
        .notes-textarea {
            width: 100%;
            height: 150px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            resize: vertical;
        }
        .notes-buttons {
            margin-top: 15px;
            text-align: right;
        }
        .notes-btn {
            padding: 8px 16px;
            margin-left: 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .notes-btn-save {
            background-color: #007cba;
            color: white;
        }
        .notes-btn-save:hover {
            background-color: #005a87;
        }
        .notes-btn-cancel {
            background-color: #6c757d;
            color: white;
        }
        .notes-btn-cancel:hover {
            background-color: #545b62;
        }
        .notes-btn-delete {
            background-color: #dc3545;
            color: white;
        }
        .notes-btn-delete:hover {
            background-color: #c82333;
        }
    `;

    // Add styles to page
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Create modal HTML
    const modalHTML = `
        <div id="notesModal" class="notes-modal">
            <div class="notes-modal-content">
                <div class="notes-modal-header">
                    <h3>Personal Note</h3>
                    <span class="notes-close">&times;</span>
                </div>
                <div>
                    <p><strong>Ticket:</strong> <span id="ticketInfo"></span></p>
                    <textarea id="notesTextarea" class="notes-textarea" placeholder="Enter your personal note for this ticket..."></textarea>
                </div>
                <div class="notes-buttons">
                    <button id="deleteNoteBtn" class="notes-btn notes-btn-delete">Delete Note</button>
                    <button id="cancelNoteBtn" class="notes-btn notes-btn-cancel">Cancel</button>
                    <button id="saveNoteBtn" class="notes-btn notes-btn-save">Save Note</button>
                </div>
            </div>
        </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Get modal elements
    const modal = document.getElementById('notesModal');
    const closeBtn = document.querySelector('.notes-close');
    const cancelBtn = document.getElementById('cancelNoteBtn');
    const saveBtn = document.getElementById('saveNoteBtn');
    const deleteBtn = document.getElementById('deleteNoteBtn');
    const textarea = document.getElementById('notesTextarea');
    const ticketInfo = document.getElementById('ticketInfo');

    let currentTicketId = null;

    // Local storage functions
    function saveNote(ticketId, note) {
        const notes = JSON.parse(localStorage.getItem('supportTicketNotes') || '{}');
        if (note.trim()) {
            notes[ticketId] = note;
        } else {
            delete notes[ticketId];
        }
        localStorage.setItem('supportTicketNotes', JSON.stringify(notes));
    }

    function getNote(ticketId) {
        const notes = JSON.parse(localStorage.getItem('supportTicketNotes') || '{}');
        return notes[ticketId] || '';
    }

    function deleteNote(ticketId) {
        const notes = JSON.parse(localStorage.getItem('supportTicketNotes') || '{}');
        delete notes[ticketId];
        localStorage.setItem('supportTicketNotes', JSON.stringify(notes));
    }

    // Modal functions
    function openModal(ticketId, ticketSubject) {
        currentTicketId = ticketId;
        ticketInfo.textContent = `#${ticketId} - ${ticketSubject}`;
        textarea.value = getNote(ticketId);
        modal.style.display = 'block';
        textarea.focus();
    }

    function closeModal() {
        modal.style.display = 'none';
        currentTicketId = null;
        textarea.value = '';
    }

    // Event listeners
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', function() {
        if (currentTicketId) {
            saveNote(currentTicketId, textarea.value);
            updateNoteIcon(currentTicketId);
            closeModal();
        }
    });

    deleteBtn.addEventListener('click', function() {
        if (currentTicketId && confirm('Are you sure you want to delete this note?')) {
            deleteNote(currentTicketId);
            updateNoteIcon(currentTicketId);
            closeModal();
        }
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });

    function updateNoteIcon(ticketId) {
        const icon = document.querySelector(`[data-ticket-id="${ticketId}"]`);
        if (icon) {
            const hasNote = getNote(ticketId).trim() !== '';
            if (hasNote) {
                icon.classList.add('has-note');
                icon.title = 'Click to edit personal note';
            } else {
                icon.classList.remove('has-note');
                icon.title = 'Click to add personal note';
            }

            // Update inline note display
            updateInlineNote(ticketId);
        }
    }

    function updateInlineNote(ticketId) {
        const icon = document.querySelector(`[data-ticket-id="${ticketId}"]`);
        if (!icon) return;

        const noteText = getNote(ticketId).trim();
        const existingNote = icon.parentElement.querySelector('.personal-note-display');

        // Remove existing note display
        if (existingNote) {
            existingNote.remove();
        }

        // Add new note display if note exists
        if (noteText) {
            const noteDisplay = document.createElement('div');
            noteDisplay.className = 'personal-note-display';
            noteDisplay.textContent = noteText.length > 100 ? noteText.substring(0, 100) + '...' : noteText;
            noteDisplay.title = noteText; // Full text on hover

            // Insert after the ticket link
            const ticketCell = icon.closest('td');
            ticketCell.appendChild(noteDisplay);
        }
    }

    // Add notes icons to ticket rows
    function addNotesIcons() {
        const ticketTables = document.querySelectorAll('#sortabletbl1, #sortabletbl2');

        ticketTables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach((row, index) => {
                // Skip header row
                if (index === 0) return;

                const ticketLink = row.querySelector('a[href*="supporttickets.php?action=view&id="]');
                if (ticketLink) {
                    // Extract ticket ID from the link
                    const href = ticketLink.getAttribute('href');
                    const ticketIdMatch = href.match(/id=(\d+)/);
                    if (ticketIdMatch) {
                        const ticketId = ticketIdMatch[1];
                        const ticketSubject = ticketLink.textContent.trim();

                        // Check if icon already exists
                        if (row.querySelector('.personal-notes-icon')) return;

                        // Create notes icon
                        const notesIcon = document.createElement('span');
                        notesIcon.innerHTML = '📝';
                        notesIcon.className = 'personal-notes-icon';
                        notesIcon.setAttribute('data-ticket-id', ticketId);
                        notesIcon.title = 'Click to add personal note';

                        // Add click event
                        notesIcon.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            openModal(ticketId, ticketSubject);
                        });

                        // Add icon after the ticket link
                        ticketLink.insertAdjacentElement('afterend', notesIcon);

                        // Update icon state and inline note
                        updateNoteIcon(ticketId);
                    }
                }
            });
        });
    }

    // Initialize
    function init() {
        addNotesIcons();
    }

    // Run when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-run when page content changes (for AJAX updates)
    const observer = new MutationObserver(function(mutations) {
        let shouldUpdate = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldUpdate = true;
            }
        });
        if (shouldUpdate) {
            setTimeout(init, 100);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();