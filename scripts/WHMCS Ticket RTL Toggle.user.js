// ==UserScript==
// @name         WHMCS Ticket RTL Toggle
// @namespace    http://tampermonkey.net/
// @version      2026-06-03
// @description  Auto-RTL Arabic ticket replies + manual toggle buttons for WHMCS 8.2.1
// @author       Ali-Hela
// @match        *://*/*/supporttickets.php?action=view*
// @match        *://*/supporttickets.php?action=view*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

    // Returns true if Arabic chars make up a meaningful share of the letters
    function isArabic(text) {
        var arabic = (text.match(ARABIC_RE) || []).length;
        if (arabic === 0) return false;
        // letters only (ignore digits, punctuation, whitespace)
        var letters = (text.match(/[\p{L}]/gu) || []).length;
        if (letters === 0) return false;
        return (arabic / letters) >= 0.3; // 30%+ Arabic => treat as Arabic
    }

    function makeBtn(label, title) {
        var b = document.createElement('input');
        b.type = 'button';
        b.value = label;
        b.title = title;
        b.className = 'btn btn-xs btn-small btn-default rtl-toggle-btn';
        b.style.marginLeft = '4px';
        return b;
    }

    function applyRTL(msgEl, on) {
        if (on) {
            msgEl.style.direction = 'rtl';
            msgEl.style.textAlign = 'right';
        } else {
            msgEl.style.direction = '';
            msgEl.style.textAlign = '';
        }
        msgEl.dataset.rtlOn = on ? '1' : '0';
    }

    function syncBtn(btn, on) {
        if (!btn) return;
        btn.classList.toggle('btn-primary', on);
        btn.classList.toggle('btn-default', !on);
    }

    function getMsg(reply) {
        return reply.querySelector('.message');
    }

    function addButtons() {
        var replies = document.querySelectorAll('#ticketreplies .reply');
        replies.forEach(function(reply) {
            var tools = reply.querySelector('.tools > div');
            if (!tools || tools.querySelector('.rtl-toggle-btn')) return;
            var msg = getMsg(reply);
            if (!msg) return;

            // Auto-apply RTL for Arabic messages
            var auto = isArabic(msg.textContent || '');
            applyRTL(msg, auto);

            var btn = makeBtn('RTL', 'Toggle right-to-left for this message');
            syncBtn(btn, auto);
            btn.addEventListener('click', function() {
                var on = msg.dataset.rtlOn === '1';
                applyRTL(msg, !on);
                syncBtn(btn, !on);
            });
            tools.appendChild(btn);
        });
    }

    function addGlobalButton() {
        var container = document.getElementById('ticketreplies');
        if (!container || document.getElementById('rtl-toggle-all')) return;

        var bar = document.createElement('div');
        bar.style.margin = '8px 0';

        var allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.id = 'rtl-toggle-all';
        allBtn.className = 'btn btn-sm btn-default';
        allBtn.innerHTML = '<i class="fas fa-align-right"></i> Toggle RTL (all messages)';

        var state = false;
        allBtn.addEventListener('click', function() {
            state = !state;
            document.querySelectorAll('#ticketreplies .reply .message').forEach(function(msg) {
                applyRTL(msg, state);
            });
            document.querySelectorAll('.rtl-toggle-btn').forEach(function(b) {
                syncBtn(b, state);
            });
            syncBtn(allBtn, state);
        });

        bar.appendChild(allBtn);
        container.parentNode.insertBefore(bar, container);
    }

    function init() {
        addGlobalButton();
        addButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
