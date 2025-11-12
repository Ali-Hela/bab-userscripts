// ==UserScript==
// @name         WHMCS Server List Notes
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  try to take over the world!
// @author       Ali-H
// @match        https://account.bab-albahrain.com/babadmin/configservers.php
// @icon         https://account.bab-albahrain.com/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Add Notes column header after "Server Name"
    const table = document.getElementById('sortabletbl1');
    if (table) {
        const headerRow = table.querySelector('tr');
        if (headerRow) {
            const th = document.createElement('th');
            th.textContent = 'Notes';
            headerRow.insertBefore(th, headerRow.children[1]);
        }

        // For each server row, add a textarea for notes
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, idx) => {
            // Skip header and section rows (those with colspan)
            if (
                idx === 0 ||
                row.querySelector('td[colspan]') ||
                row.querySelector('th')
            ) return;

            // Get a unique key for this row (use server name text)
            const serverNameCell = row.children[0];
            let serverKey = '';
            if (serverNameCell) {
                // Try to get server id from data-server-id or fallback to text
                const refreshBtn = serverNameCell.querySelector('.refresh-server-item');
                if (refreshBtn && refreshBtn.dataset.serverId) {
                    serverKey = 'server_note_' + refreshBtn.dataset.serverId;
                } else {
                    serverKey = 'server_note_' + serverNameCell.textContent.trim();
                }
            }

            // Create textarea
            const td = document.createElement('td');
            const textarea = document.createElement('textarea');
            textarea.style.width = '100%';
            textarea.style.minHeight = '40px';
            textarea.value = localStorage.getItem(serverKey) || '';
            textarea.addEventListener('input', function() {
                localStorage.setItem(serverKey, textarea.value);
            });
            td.appendChild(textarea);

            // Insert after server name cell
            row.insertBefore(td, row.children[1]);
        });
    }
})();