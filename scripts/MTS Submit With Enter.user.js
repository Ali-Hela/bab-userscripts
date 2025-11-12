// ==UserScript==
// @name         MTS Submit With Enter
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  try to take over the world!
// @author       Ali-H
// @match        https://merchant.gate-e.com/mts/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gate-e.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

      // Helper: Find the first submit button in the form, or fallback to form.submit()
  function submitForm(form) {
    // Try to find a visible submit button
    let btn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type]), button[type="button"]');
    if (btn && !btn.disabled && btn.offsetParent !== null) {
      btn.click();
    } else {
      form.requestSubmit ? form.requestSubmit() : form.submit();
    }
  }

  // Attach keydown listener to all forms
  function enableEnterSubmitForAllForms() {
    document.querySelectorAll('form').forEach(form => {
      // Avoid double-binding
      if (form.dataset.enterSubmitBound) return;
      form.dataset.enterSubmitBound = "1";

      form.addEventListener('keydown', function (e) {
        // Only trigger on Enter key in input or select fields (not textarea)
        if (
          e.key === "Enter" &&
          !e.shiftKey &&
          !e.ctrlKey &&
          !e.altKey &&
          !e.metaKey &&
          (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")
        ) {
          // Prevent default Enter behavior (e.g., form auto-submit or input newline)
          e.preventDefault();
          submitForm(form);
        }
      });
    });
  }

  // Run on page load and whenever new forms are added (for SPA)
  enableEnterSubmitForAllForms();
  // Observe DOM for dynamically added forms
  new MutationObserver(enableEnterSubmitForAllForms).observe(document.body, { childList: true, subtree: true });

})();