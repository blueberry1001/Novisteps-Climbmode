// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const startPanel = document.getElementById('start-panel');
  const activePanel = document.getElementById('active-panel');
  const selectDiff = document.getElementById('initial-diff');
  const btnStart = document.getElementById('start-btn');
  const btnStop = document.getElementById('stop-btn');
  const btnGiveUp = document.getElementById('giveup-btn');
  const btnPause = document.getElementById('pause-btn');
  const textDiff = document.getElementById('curr-diff');
  const textProb = document.getElementById('curr-prob');
  const statsContainer = document.getElementById('stats');
  
  let lastSessionJson = '';

  const getDifficultyName = (d) => {
    if (d <= 11) return (12 - d) + "Q";
    else return (d - 11) + "D";
  };

  for (let d = 1; d <= 17; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = getDifficultyName(d);
    if (d === 11) opt.selected = true; // Default 1Q is a good middle ground
    selectDiff.appendChild(opt);
  }

  const updateUI = (session) => {
    if (!session) {
      startPanel.classList.remove('hidden');
      activePanel.classList.add('hidden');
      return;
    }
    
    startPanel.classList.add('hidden');
    activePanel.classList.remove('hidden');

    textDiff.textContent = getDifficultyName(session.currentDifficulty);
    
    if (session.currentProblem) {
      textProb.innerHTML = `<a href="${session.currentProblem.url}" target="_blank" style="color:inherit; text-decoration:none;">${session.currentProblem.title}</a>`;
      btnGiveUp.disabled = false;
    } else {
      textProb.textContent = "次の問題を取得中...";
      btnGiveUp.disabled = true;
    }

    // Pause button visibility / label
    if (btnPause) {
      if (session) {
        btnPause.classList.remove('hidden');
        if (session.paused) {
          btnPause.textContent = '再開';
        } else {
          btnPause.textContent = '一時停止';
        }
        btnPause.disabled = false;
      } else {
        btnPause.classList.add('hidden');
      }
    }

    renderStats(session.solvedCount, session.failedCount);
  };

  const renderStats = (solved, failed) => {
    statsContainer.innerHTML = '<strong>成績:</strong><br/>';
    let allKeys = new Set([...Object.keys(solved), ...Object.keys(failed)]);
    const sortedKeys = Array.from(allKeys).map(Number).sort((a,b) => a - b);
    
    if (sortedKeys.length === 0) {
      statsContainer.innerHTML += '<div style="color:#666;">まだ結果がありません</div>';
      return;
    }

    sortedKeys.forEach(d => {
      const s = solved[d] || 0;
      const f = failed[d] || 0;
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `<span>${getDifficultyName(d)}:</span> <span><span class="badge-ac">${s} AC</span> / <span class="badge-fail">${f} 解説AC</span></span>`;
      statsContainer.appendChild(row);
    });
  };

  chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
    if (response && response.session) {
      lastSessionJson = JSON.stringify(response.session);
      updateUI(response.session);
    } else {
      lastSessionJson = '';
      updateUI(null);
    }
  });

  btnStart.addEventListener('click', () => {
    const d = selectDiff.value;
    chrome.runtime.sendMessage({ type: 'START_SESSION', difficulty: d }, (response) => {
      if (response && response.session) {
        lastSessionJson = JSON.stringify(response.session);
        updateUI(response.session);
      }
    });
  });

  btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_SESSION' }, () => {
      lastSessionJson = '';
      updateUI(null);
    });
  });

  const recordResult = (action) => {
    btnGiveUp.disabled = true;
    textProb.textContent = "次の問題を取得中...";
    
    chrome.runtime.sendMessage({ type: 'RECORD_RESULT', action: action }, (response) => {
      if (response && response.session) {
         lastSessionJson = JSON.stringify(response.session);
         updateUI(response.session);
      }
    });
  };

  btnGiveUp.addEventListener('click', () => recordResult('GiveUp'));

  // Pause / Resume
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (res) => {
        const s = res && res.session;
        if (!s) return;
        const cmd = s.paused ? 'RESUME_SESSION' : 'PAUSE_SESSION';
        chrome.runtime.sendMessage({ type: cmd }, (response) => {
          if (response && response.session) {
            lastSessionJson = JSON.stringify(response.session);
            updateUI(response.session);
          }
        });
      });
    });
  }

  setInterval(() => {
    chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
      if (response && response.session) {
        const json = JSON.stringify(response.session);
        if (json !== lastSessionJson) {
           lastSessionJson = json;
           updateUI(response.session);
        }
      } else {
        lastSessionJson = '';
      }
    });
  }, 1000);
});
