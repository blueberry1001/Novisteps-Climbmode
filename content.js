// content.js
let targetDifficulty = null;
let usedProblemsList = [];
let currentProblemUrl = null;
let currentHighlightElem = null;
let currentProblemStatus = null; // "AC", "解説AC", "未挑戦", etc.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SELECT_PROBLEM') {
        targetDifficulty = request.difficultyName;
        usedProblemsList = request.usedProblems || [];
        currentProblemUrl = null; // reset so we pick a new one
        debouncedFind();
    } else if (request.type === 'CLEAR_HIGHLIGHT') {
        targetDifficulty = null;
        removeHighlight();
    }
});

function removeHighlight() {
    if (currentHighlightElem) {
        currentHighlightElem.style.border = '';
        currentHighlightElem.style.backgroundColor = '';
        currentHighlightElem.style.boxShadow = '';
    }
    document.querySelectorAll('[data-novitrainer-highlight]').forEach(el => {
        el.style.backgroundColor = '';
        el.style.border = '';
        el.removeAttribute('data-novitrainer-highlight');
    });
    
    // Restore hidden problems in case CSS was insufficient
    document.querySelectorAll('tr').forEach(tr => {
        if (tr.style.display === 'none') {
            tr.style.display = '';
        }
    });
}

function getProblemStatusFromRow(row) {
    if (!row) return "Unknown";
    const img = row.querySelector('img[alt="AC"], img[alt="解説AC"], img[alt="挑戦中"], img[alt="未挑戦"]');
    if (img) {
        return img.getAttribute('alt').trim();
    }
    // If no image, it might be text inside the status button in the first td
    const statusTd = row.querySelector('td');
    if (statusTd) {
        const btn = statusTd.querySelector('button');
        if (btn) return btn.textContent.trim();
        return statusTd.textContent.trim();
    }
    return "Unknown"; // Fallback
}

// Inject robust CSS to hide unselected problems securely regardless of Svelte/React re-renders
let styleEl = document.getElementById('novitrainer-style');
if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'novitrainer-style';
    document.head.appendChild(styleEl);
}

function updateCSS() {
    if (currentProblemUrl) {
        styleEl.textContent = `
            tr:has(a[href*="atcoder.jp/contests/"]) {
                display: none !important;
            }
            tr:has(a[href="${currentProblemUrl}"]) {
                display: table-row !important;
            }
        `;
    } else {
        styleEl.textContent = '';
    }
}

function findAndHighlightProblem() {
    if (!targetDifficulty) return;
    
    // Remove previous highlights on difficulty headers
    document.querySelectorAll('[data-novitrainer-highlight]').forEach(el => {
        if (!el.textContent.includes(targetDifficulty)) {
            el.style.backgroundColor = '';
            el.style.border = '';
            el.removeAttribute('data-novitrainer-highlight');
        }
    });

    const buttons = Array.from(document.querySelectorAll('button'));
    const gradeButton = buttons.find(btn => {
        const text = btn.textContent.trim();
        const regex = new RegExp('^' + targetDifficulty + '(?:\\W|$)');
        return regex.test(text);
    });
    
    if (!gradeButton) return;
    
    const isExpanded = gradeButton.getAttribute('aria-expanded') === 'true';
    if (!isExpanded) {
        gradeButton.click();
        return; 
    }
    
    if (!gradeButton.hasAttribute('data-novitrainer-highlight')) {
        gradeButton.setAttribute('data-novitrainer-highlight', 'true');
        gradeButton.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
        gradeButton.style.border = '2px solid gold';
        gradeButton.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    let container = gradeButton.parentElement;
    let links = [];
    let maxDepth = 5;
    while (container && container !== document.body && maxDepth > 0) {
        links = Array.from(container.querySelectorAll('a[href*="atcoder.jp/contests/"]'));
        if (links.length > 0) break;
        container = container.parentElement;
        maxDepth--;
    }
    
    if (links.length === 0) return;
    
    let selectedLink = null;
    if (currentProblemUrl) {
        selectedLink = links.find(l => l.href === currentProblemUrl);
    }

    let isNewProblem = false;
    if (!selectedLink) {
        const availableLinks = links.filter(link => {
            if (usedProblemsList.includes(link.href)) return false;
            const row = link.closest('tr');
            if (row) {
                const status = getProblemStatusFromRow(row);
                if (status === "AC" || status === "解説AC") {
                    return false;
                }
            }
            return true;
        });

        if (availableLinks.length === 0) {
            const randomIndex = Math.floor(Math.random() * links.length);
            selectedLink = links[randomIndex];
        } else {
            const randomIndex = Math.floor(Math.random() * availableLinks.length);
            selectedLink = availableLinks[randomIndex];
        }
        isNewProblem = true;
    }

    if (selectedLink) {
        // Only broadcast and update state if it's a genuinely new selection
        if (currentProblemUrl !== selectedLink.href) {
            currentProblemUrl = selectedLink.href;
            isNewProblem = true;
        }

        highlightElement(selectedLink);
        
        // Apply the CSS rule unconditionally
        updateCSS(); 
        
        let row = selectedLink.closest('tr');
        if (row && isNewProblem) {
            // ONLY record the initial status when first picking the problem!
            // Otherwise, we overwrite the state during a Mutation change and miss the update.
            currentProblemStatus = getProblemStatusFromRow(row);
        }

        if (isNewProblem) {
            setTimeout(() => selectedLink.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            
            chrome.runtime.sendMessage({
                type: 'PROBLEM_SELECTED',
                problem: {
                    id: currentProblemUrl,
                    title: selectedLink.textContent.trim(),
                    url: selectedLink.href,
                    difficulty: targetDifficulty
                }
            });
        }
    }
}

function highlightElement(el) {
    if (currentHighlightElem) {
        currentHighlightElem.style.border = '';
        currentHighlightElem.style.backgroundColor = '';
        currentHighlightElem.style.boxShadow = '';
    }
    currentHighlightElem = el;
    el.style.border = '3px solid #f44336';
    el.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
    el.style.boxShadow = '0 0 10px #f44336';
    el.style.borderRadius = '4px';
}

function hideOtherRows() {
    if (!currentProblemUrl) return;
    const selectedLink = document.querySelector(`a[href="${currentProblemUrl}"]`);
    if (!selectedLink) return;

    const tbody = selectedLink.closest('tbody') || selectedLink.closest('table');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        const a = row.querySelector('a[href*="atcoder.jp/contests/"]');
        if (a) {
            if (a.href !== currentProblemUrl) {
                if (row.style.display !== 'none') {
                    row.style.setProperty('display', 'none', 'important');
                }
            } else {
                if (row.style.display === 'none') {
                    row.style.setProperty('display', '', 'important');
                }
            }
        }
    });
}

function checkStatusUpdate() {
    if (!currentProblemUrl) return;
    
    const selectedLink = document.querySelector(`a[href="${currentProblemUrl}"]`);
    if (!selectedLink) return;

    let row = selectedLink.closest('tr');
    if (!row) return;

    const newStatus = getProblemStatusFromRow(row);
    
    // Check if the status has actively changed to AC or 解説AC since we recorded it
    if (newStatus && newStatus !== currentProblemStatus) {
        if (newStatus === "AC") {
            currentProblemStatus = newStatus;
            currentProblemUrl = null;
            updateCSS(); // unhide before switching
            chrome.runtime.sendMessage({ type: 'RECORD_RESULT', action: 'AC' });
        } else if (newStatus === "解説AC") {
            currentProblemStatus = newStatus;
            currentProblemUrl = null;
            updateCSS(); // unhide before switching
            chrome.runtime.sendMessage({ type: 'RECORD_RESULT', action: 'GiveUp' });
        }
    }
}

let debounceTimer;
function debouncedFind() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        findAndHighlightProblem();
        checkStatusUpdate();
        hideOtherRows();
    }, 150);
}

const observer = new MutationObserver((mutations) => {
    if (targetDifficulty) {
        debouncedFind();
    }
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['alt', 'src', 'class'] });

chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
    if (response && response.session && response.session.currentDifficulty) {
        const getDifficultyName = (d) => {
            if (d <= 11) return (12 - d) + "Q";
            else return (d - 11) + "D";
        };
        targetDifficulty = getDifficultyName(response.session.currentDifficulty);
        usedProblemsList = response.session.usedProblems || [];
        if (response.session.currentProblem) {
            currentProblemUrl = response.session.currentProblem.url;
            updateCSS();
        }
        debouncedFind();
    }
});
