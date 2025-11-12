// ==UserScript==
// @name         WHMCS User Names Notes
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Lightweight version: adds custom name inputs and shows them in all flagto dropdowns using localStorage
// @match        https://account.bab-albahrain.com/babadmin/supporttickets.php*
// @icon         https://account.bab-albahrain.com/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // --- Local storage helpers ---
  const getCustomName = a => localStorage.getItem(`assignee_custom_name_${a}`) || '';
  const saveCustomName = (a, n) => {
    n = n.trim();
    if (n) localStorage.setItem(`assignee_custom_name_${a}`, n);
    else localStorage.removeItem(`assignee_custom_name_${a}`);
    updateFlagtoSelects();
  };

  // --- Extract "(Name)" from a string like "Department (Ali)" ---
  const extractAssignee = t => (t.match(/\(([^)]+)\)$/) || [])[1];

  // --- Add input boxes for each ticket row ---
  function addInputs() {
    document.querySelectorAll('tbody tr').forEach(row => {
      const cell = row.querySelector('td:nth-child(3)');
      if (!cell || cell.querySelector('.custom-name-input')) return;

      const assignee = extractAssignee(cell.textContent.trim());
      if (!assignee) return;

      const input = document.createElement('input');
      input.className = 'custom-name-input';
      input.placeholder = 'Custom name...';
      input.value = getCustomName(assignee);
      Object.assign(input.style, {
        display: 'block',
        width: '150px',
        marginTop: '5px',
        fontSize: '11px',
      });

      input.addEventListener('change', () => saveCustomName(assignee, input.value));
      cell.appendChild(input);
    });
  }

  // --- Update all <select name="flagto"> dropdowns ---
  function updateFlagtoSelects() {
    document.querySelectorAll('select[name="flagto"]').forEach(sel => {
      sel.querySelectorAll('option').forEach(opt => {
        if (opt.value === '0') return;
        const name = opt.textContent.trim().replace(/\s*\(.*\)\s*$/, '');
        const note = getCustomName(name);
        opt.textContent = note ? `${name} (${note})` : name;
      });
    });
  }

  // --- Init once ---
  function init() {
    addInputs();
    updateFlagtoSelects();
  }

  // Run once when page loads
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
