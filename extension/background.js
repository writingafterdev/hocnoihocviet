chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  chrome.action.setBadgeText({ text: '...', tabId: tab.id });
  chrome.action.setBadgeBackgroundColor({ color: '#F5A623', tabId: tab.id });

  try {
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    });

    const html = injectionResults[0].result;
    const url = tab.url;

    const response = await fetch('http://localhost:3000/api/admin/import/raw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ html, url }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to import');
    }

    chrome.action.setBadgeText({ text: 'OK', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#2ecc71', tabId: tab.id });

    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 3000);
  } catch (error) {
    console.error('Import error:', error);
    chrome.action.setBadgeText({ text: 'ERR', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#e74c3c', tabId: tab.id });

    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 5000);
  }
});
