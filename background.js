// background.js

let session = null;

const saveSession = async () => {
  if (session) {
    await chrome.storage.local.set({ session });
  } else {
    await chrome.storage.local.remove('session');
  }
};

const loadSession = async () => {
  const data = await chrome.storage.local.get('session');
  if (data.session) {
    session = data.session;
  }
};

loadSession();

const getDifficultyName = (d) => {
  if (d <= 11) {
    return (12 - d) + "Q";
  } else {
    return (d - 11) + "D";
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SESSION') {
    const d = parseInt(message.difficulty, 10);
    session = {
      currentDifficulty: d,
      initialDifficulty: d,
      startTime: Date.now(),
      currentProblem: null,
      usedProblems: [],
      history: [],
      solvedCount: {},
      failedCount: {}
    };
    saveSession().then(() => {
      requestNextProblem();
      sendResponse({ session });
    });
    return true; // async
  } else if (message.type === 'GET_SESSION') {
    sendResponse({ session });
  } else if (message.type === 'STOP_SESSION') {
    if (session) {
      session.endTime = Date.now();
      chrome.storage.local.set({ lastSession: session }, () => {
        session = null;
        saveSession().then(() => {
          clearHighlight();
          chrome.tabs.create({ url: chrome.runtime.getURL('summary.html') });
          sendResponse({});
        });
      });
      return true;
    } else {
      sendResponse({});
    }
  } else if (message.type === 'RECORD_RESULT') {
    if (!session) {
      sendResponse({ error: "No active session" });
      return;
    }

    const { action } = message;
    const d = session.currentDifficulty;

    if (session.currentProblem) {
      if (!session.history) session.history = [];
      session.history.push({
        title: session.currentProblem.title,
        difficultyName: session.currentProblem.difficulty,
        status: action === 'AC' ? "AC" : "解説AC",
        url: session.currentProblem.url
      });
    }

    if (action === 'AC') {
      session.solvedCount[d] = (session.solvedCount[d] || 0) + 1;
      session.currentDifficulty++;
    } else {
      // failed or gave up
      session.failedCount[d] = (session.failedCount[d] || 0) + 1;
      session.currentDifficulty--;
    }

    // Clamp difficulty
    if (session.currentDifficulty < 1) session.currentDifficulty = 1;
    if (session.currentDifficulty > 17) session.currentDifficulty = 17;

    session.currentProblem = null;
    saveSession().then(() => {
      requestNextProblem();
      sendResponse({ session });
    });
    return true;
  } else if (message.type === 'PROBLEM_SELECTED') {
    if (!session) return;
    const { problem } = message;
    session.currentProblem = problem;
    if (!session.usedProblems.includes(problem.url)) {
      session.usedProblems.push(problem.url);
    }
    saveSession().then(() => {
      // broadcast to popup if needed, though popup can pull it
    });
    sendResponse({ ok: true });
  }
});

function requestNextProblem() {
  if (!session) return;
  const dName = getDifficultyName(session.currentDifficulty);
  chrome.tabs.query({ url: "*://atcoder-novisteps.vercel.app/*" }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        type: 'SELECT_PROBLEM', 
        difficultyName: dName,
        usedProblems: session.usedProblems 
      });
    });
  });
}

function clearHighlight() {
  chrome.tabs.query({ url: "*://atcoder-novisteps.vercel.app/*" }, (tabs) => {
    tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHT' }));
  });
}
