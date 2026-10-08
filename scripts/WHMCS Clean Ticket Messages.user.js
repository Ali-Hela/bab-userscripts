// ==UserScript==
// @name         WHMCS Clean Ticket Messages
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Clean cluttered email messages in support tickets (blank lines, mailto spam, banners, quoted threads) with a one-click restore
// @author       Ali-Hela
// @match        https://account.bab-albahrain.com/babadmin/supporttickets.php*
// @icon         https://account.bab-albahrain.com/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const MIN_BLANK_LINES = 6; // messages with at least this many empty lines get a Clean button

    const styles = `
        .tc-btn { margin-left: 4px !important; }
        .tc-btn.tc-active { background: #5cb85c !important; border-color: #4cae4c !important; color: #fff !important; }
        .tc-bar { margin: 8px 0; }
        .tc-clean { line-height: 1.5; }
        .tc-clean .tc-gap { display: block; height: 0.6em; }
        .tc-clean .tc-hdr { color: #777; font-size: 12px; }
        .tc-clean .tc-hdr b { color: #555; }
        .tc-quote { margin-top: 10px; border-left: 3px solid #ccc; padding-left: 10px; }
        .tc-quote > summary { cursor: pointer; color: #337ab7; font-size: 12px; user-select: none; }
        .tc-quote > div { margin-top: 6px; color: #555; }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // ---------- parsing helpers ----------

    const textOf = html => html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;| |[​-‏﻿]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const isBlank = html => textOf(html) === '' && !/<img/i.test(html);

    // Lines that are pure mail-client noise
    const NOISE = [
        /^\[?EXTERNAL (SENDER|EMAIL)\]?$/i,
        /^CAUTION:\s*This email originated/i,
        /^DO NOT CLICK on links/i,
        /^AFS Classification\b/i,
        /^Sent from my (iPhone|iPad|Android|Samsung)/i,
        /^Get Outlook for /i,
    ];

    const HEADER = /^(From|To|Cc|Bcc|Sent|Date|Subject|Reply-To)\s*:/i;
    const FWD_MARK = /^=+\s*Forwarded message\s*=+$/i;
    const ORIG_MARK = /^-{2,}\s*(Original|Forwarded) Message\s*-{2,}$/i;
    const WROTE = /^On .{5,200} wrote:$/i;

    function tidyLine(html) {
        return html
            .replace(/(?<![="'])mailto:\s*/gi, '')
            .replace(/&lt;\s+/g, '&lt;')
            .replace(/\s+&gt;/g, '&gt;')
            .replace(/&nbsp;| /g, ' ')
            .replace(/[​-‏﻿]/g, '')
            .replace(/[ \t]+/g, ' ')
            .trim();
    }

    // Is line i the start of a quoted / forwarded block?
    function startsQuote(texts, i) {
        const t = texts[i];
        if (FWD_MARK.test(t) || ORIG_MARK.test(t) || WROTE.test(t)) return true;
        if (/^From\s*:/i.test(t)) {
            // must be followed shortly by other header fields
            let hits = 0;
            for (let j = i + 1; j < Math.min(texts.length, i + 8); j++) {
                if (HEADER.test(texts[j])) hits++;
            }
            return hits >= 2;
        }
        return false;
    }

    function renderLines(lines) {
        // collapse blank runs to a single gap, trim leading/trailing blanks
        const out = [];
        let prevBlank = true;
        for (const l of lines) {
            if (l === null) {
                if (!prevBlank) out.push('<span class="tc-gap"></span>');
                prevBlank = true;
                continue;
            }
            const t = textOf(l);
            if (HEADER.test(t)) {
                out.push('<div class="tc-hdr">' + l.replace(/^(\s*)([A-Za-z-]+\s*:)/, '$1<b>$2</b>') + '</div>');
            } else {
                out.push('<div>' + l + '</div>');
            }
            prevBlank = false;
        }
        while (out.length && out[out.length - 1].includes('tc-gap')) out.pop();
        return out.join('');
    }

    function clean(html) {
        const raw = html.split(/<br\s*\/?>/i);
        const lines = [];   // tidied html, or null for blank
        const texts = [];

        for (const r of raw) {
            const tidy = tidyLine(r);
            const t = textOf(tidy);
            if (isBlank(tidy)) {
                lines.push(null); texts.push('');
            } else if (NOISE.some(rx => rx.test(t))) {
                // dropped
            } else {
                lines.push(tidy); texts.push(t);
            }
        }

        let split = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] !== null && startsQuote(texts, i)) { split = i; break; }
        }

        const mainLines = split === -1 ? lines : lines.slice(0, split);
        const quoteLines = split === -1 ? [] : lines.slice(split);

        let out = '<div class="tc-clean">' + renderLines(mainLines);
        const mainHasText = mainLines.some(l => l !== null);
        if (quoteLines.length) {
            const n = quoteLines.filter(l => l !== null).length;
            out += '<details class="tc-quote"' + (mainHasText ? '' : ' open') + '>' +
                   '<summary>Show quoted / forwarded thread (' + n + ' lines)</summary>' +
                   '<div>' + renderLines(quoteLines) + '</div></details>';
        }
        return out + '</div>';
    }

    function looksCluttered(html) {
        const blanks = html.split(/<br\s*\/?>/i).filter(isBlank).length;
        return blanks >= MIN_BLANK_LINES || /(?<![="'])mailto:/i.test(html);
    }

    // ---------- per-message state ----------

    const messages = [];

    function setCleaned(m, on) {
        if (m.cleaned === on) return;
        m.el.innerHTML = on ? clean(m.original) : m.original;
        m.cleaned = on;
        m.btn.value = on ? 'Restore' : 'Clean';
        m.btn.classList.toggle('tc-active', on);
        m.btn.title = on ? 'Show the original message' : 'Tidy up this message';
    }

    function init() {
        const els = document.querySelectorAll('.reply .message.markdown-content');
        els.forEach(el => {
            if (el.dataset.tcInit) return;
            el.dataset.tcInit = '1';
            const original = el.innerHTML;
            if (!looksCluttered(original)) return;

            const reply = el.closest('.reply');
            const tools = reply && reply.querySelector('.tools > div');
            if (!tools) return;

            const btn = document.createElement('input');
            btn.type = 'button';
            btn.value = 'Clean';
            btn.title = 'Tidy up this message';
            btn.className = 'btn btn-xs btn-small btn-default tc-btn';
            const m = { el, original, btn, cleaned: false };
            btn.addEventListener('click', () => setCleaned(m, !m.cleaned));
            tools.appendChild(btn);
            messages.push(m);

            // Editing works on the real content, so always restore first
            reply.addEventListener('click', e => {
                if (e.target && e.target.value === 'Edit') setCleaned(m, false);
            }, true);
        });

        if (!messages.length || document.getElementById('tc-toggle-all')) return;

        const bar = document.createElement('div');
        bar.className = 'tc-bar';
        const all = document.createElement('button');
        all.type = 'button';
        all.id = 'tc-toggle-all';
        all.className = 'btn btn-sm btn-default';
        const label = () => messages.every(m => m.cleaned) ? 'Restore all messages' : 'Clean all messages (' + messages.length + ')';
        const refresh = () => { all.innerHTML = '<i class="fas fa-broom"></i> ' + label(); };
        refresh();
        all.addEventListener('click', () => {
            const target = !messages.every(m => m.cleaned);
            messages.forEach(m => setCleaned(m, target));
            refresh();
        });
        messages.forEach(m => m.btn.addEventListener('click', refresh));
        bar.appendChild(all);

        const anchor = document.querySelector('form#ticketreplies');
        if (anchor) anchor.parentNode.insertBefore(bar, anchor);
    }

    init();
})();
