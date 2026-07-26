const LOCAL_REFERENCE_API = 'http://localhost:3000/api/benchmark/reference-assessments';
const LOCAL_IMPORT_DEBUG_API = 'http://localhost:3000/api/benchmark/import-debug';
const CLEAR_BADGE_ALARM = 'clear-benchmark-import-badge';

function setBadge(text, color) {
  chrome.action.setBadgeText({ text: String(text || '').slice(0, 4) });
  chrome.action.setBadgeBackgroundColor({ color });
}

function clearBadgeLater() {
  chrome.alarms.create(CLEAR_BADGE_ALARM, { delayInMinutes: 1 });
}

function badgeForError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/Could not extract both question and essay/i.test(message)) {
    return { text: 'NOEX', color: '#dc2626' };
  }
  if (/Local API failed|Failed to fetch|NetworkError|ECONNREFUSED|localhost/i.test(message)) {
    return { text: 'API', color: '#dc2626' };
  }
  if (/Cannot access|permission|Cannot read properties|Receiving end does not exist|No tab/i.test(message)) {
    return { text: 'PERM', color: '#dc2626' };
  }
  return { text: 'ERR', color: '#dc2626' };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CLEAR_BADGE_ALARM) {
    chrome.action.setBadgeText({ text: '' });
  }
});

async function executeInTab(tabId, func, args = [], options = {}) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: Boolean(options.allFrames) },
    func,
    args,
  });

  if (options.allFrames) {
    return results.map((result) => result?.result || {});
  }

  return results[0]?.result || {};
}

async function scrapeActiveDetailTab(tabId) {
  let frames = [];
  try {
    frames = await executeInTab(tabId, scrapeYouPassLikePage, [], { allFrames: true });
  } catch (error) {
    console.warn('All-frame extraction failed; falling back to main frame.', error);
    frames = [await executeInTab(tabId, scrapeYouPassLikePage)];
  }
  const scoredFrames = frames
    .filter(Boolean)
    .map((frame, index) => {
      const questionLength = String(frame.question || '').length;
      const essayLength = String(frame.essay || '').length;
      return {
        frame,
        index,
        score: (questionLength ? 1000 : 0) + (essayLength ? 1000 : 0) + Math.min(essayLength, 900),
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scoredFrames[0]?.frame || {};
  const bestQuestion = [...frames]
    .filter(Boolean)
    .sort((a, b) => String(b.question || '').length - String(a.question || '').length)[0]?.question || '';
  const bestEssay = [...frames]
    .filter(Boolean)
    .sort((a, b) => String(b.essay || '').length - String(a.essay || '').length)[0]?.essay || '';
  const bestScores = [...frames]
    .filter(Boolean)
    .sort((a, b) => Object.values(b.scores || {}).filter(Boolean).length - Object.values(a.scores || {}).filter(Boolean).length)[0]?.scores || {};

  return {
    ...best,
    question: best.question || bestQuestion,
    essay: best.essay || bestEssay,
    scores: Object.values(best.scores || {}).filter(Boolean).length ? best.scores : bestScores,
    debug: {
      ...(best.debug || {}),
      frameCount: frames.length,
      frameCandidates: scoredFrames.slice(0, 5).map((item) => ({
        index: item.index,
        questionLength: String(item.frame.question || '').length,
        essayLength: String(item.frame.essay || '').length,
        url: item.frame.url || '',
        bodyTextSample: item.frame.debug?.bodyTextSample || '',
      })),
    },
  };
}

async function sendReferenceAssessment(data) {
  const response = await fetch(LOCAL_REFERENCE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Local API failed with ${response.status}.`);
  }
  return payload;
}

async function sendImportDebug(data) {
  try {
    await fetch(LOCAL_IMPORT_DEBUG_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.warn('Could not save benchmark import debug snapshot:', error);
  }
}

async function importCurrentDetail(tab) {
  if (!tab.id) return;

  setBadge('RUN', '#2563eb');

  const extracted = await scrapeActiveDetailTab(tab.id);
  const data = {
    question: extracted.question || '',
    essay: extracted.essay || '',
    scores: extracted.scores || {},
    sourceUrl: tab.url || extracted.url || '',
  };

  if (!data.question || !data.essay) {
    const debugPayload = {
      url: data.sourceUrl,
      questionLength: data.question.length,
      essayLength: data.essay.length,
      debug: extracted.debug || {},
    };
    console.info('Benchmark extraction debug:', debugPayload);
    await sendImportDebug(debugPayload);
    const missing = [
      data.question ? '' : 'question',
      data.essay ? '' : 'essay',
    ].filter(Boolean).join(' and ');
    throw new Error(`Could not extract both question and essay from this page. Missing ${missing}.`);
  }

  setBadge('QUE', '#7c3aed');
  const saved = await sendReferenceAssessment(data);
  setBadge(saved?.queued ? 'QUE' : 'DB!', saved?.queued ? '#16a34a' : '#f59e0b');
  clearBadgeLater();
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    await importCurrentDetail(tab);
  } catch (error) {
    console.error('Benchmark import failed:', error);
    const badge = badgeForError(error);
    setBadge(badge.text, badge.color);
    clearBadgeLater();
  }
});

function scrapeYouPassLikePage() {
  const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const lower = (value) => norm(value).toLowerCase();

  function isVisible(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    return Boolean(el.getClientRects().length);
  }

  function rawElementText(el) {
    return String(el?.innerText || el?.textContent || '').replace(/\r/g, '');
  }

  function elementText(el) {
    return norm(rawElementText(el));
  }

  const allElements = Array.from(document.querySelectorAll('body *')).filter(isVisible);

  function scoreFromBlock(blockText, labels) {
    const clean = norm(blockText);
    const low = clean.toLowerCase();
    let search = clean;
    for (const label of labels) {
      const idx = low.indexOf(label.toLowerCase());
      if (idx >= 0) {
        search = clean.slice(idx + label.length);
        break;
      }
    }
    const match = search.match(/\b(?:[0-9](?:\.5)?|9(?:\.0)?)\b/);
    return match ? match[0].replace(/\.0$/, '') : '';
  }

  function findScore(labels) {
    const exactMatches = allElements.filter((el) => {
      const text = lower(elementText(el));
      return labels.some((label) => text === label.toLowerCase());
    });

    for (const el of exactMatches) {
      let cursor = el;
      for (let depth = 0; cursor && depth < 5; depth += 1, cursor = cursor.parentElement) {
        const blockText = elementText(cursor);
        if (blockText.length > 0 && blockText.length < 180) {
          const score = scoreFromBlock(blockText, labels);
          if (score) return score;
        }
      }
    }

    for (const el of allElements) {
      const blockText = elementText(el);
      if (!blockText || blockText.length > 220) continue;
      const blockLower = blockText.toLowerCase();
      if (labels.some((label) => blockLower.includes(label.toLowerCase()))) {
        const score = scoreFromBlock(blockText, labels);
        if (score) return score;
      }
    }

    return '';
  }

  function promptScore(text) {
    const t = norm(text);
    if (t.length < 30 || t.length > 650) return -1;
    let score = 0;
    const questionMarks = (t.match(/\?/g) || []).length;
    if (questionMarks) score += Math.min(questionMarks, 3) * 3;
    if (/(to what extent|agree|disagree|discuss|advantages|disadvantages|outweigh|problem|solution|opinion|essay|positive or negative|negative development|positive development|is this a positive|is this a negative|what can be|how can|what are the|what is the|reasons?|change in preference|encouraged|encourage|main means of transport|beneficial physically|environmentally)/i.test(t)) score += 4;
    if (/^(governments|some people|many people|young people|some children|children|in some countries|due to|with the development)/i.test(t)) score += 1;
    if (/(word count|bài gốc|band score|task response|lexical|grammar|ghi chú|tra từ vựng)/i.test(t)) score -= 6;
    return score;
  }

  function findQuestion() {
    const candidates = [];
    for (const el of allElements) {
      const text = elementText(el);
      const score = promptScore(text);
      if (score < 4) continue;
      const childTextMax = Math.max(0, ...Array.from(el.children).map((child) => elementText(child).length));
      if (childTextMax > text.length * 0.8 && text.length > 120) continue;
      const rect = el.getBoundingClientRect();
      candidates.push({ text, score: score + (rect.width > 250 ? 1 : 0), length: text.length });
    }
    candidates.sort((a, b) => b.score - a.score || a.length - b.length);
    if (candidates[0]?.text) return candidates[0].text;

    let beforeEssay = norm(document.body?.innerText || '').split(/\bBài gốc\b/i)[0] || '';
    const submittedMarker = beforeEssay.match(/\bNộp bài:\s*[^A-Z?]{0,80}/i);
    if (submittedMarker?.index !== undefined) {
      beforeEssay = beforeEssay.slice(submittedMarker.index + submittedMarker[0].length);
    }
    beforeEssay = beforeEssay
      .replace(/\b(?:Xem thêm\s*)?\d+\s*thảo luận\b.*$/i, '')
      .replace(/\bChia sẻ bài làm\b.*$/i, '')
      .trim();
    const questionLike = beforeEssay
      .match(/[A-Z][^?]{25,650}\?(?:\s+[A-Z][^?]{10,350}\?)?/g)
      ?.map((text) => norm(text))
      .filter((text) => promptScore(text) >= 4)
      .sort((a, b) => promptScore(b) - promptScore(a) || b.length - a.length);

    return questionLike?.[0] || '';
  }

  function findHeading(patterns) {
    return allElements
      .map((el) => ({ el, text: elementText(el), low: lower(elementText(el)) }))
      .filter((item) => item.text.length > 0 && item.text.length < 140)
      .filter((item) => patterns.some((pattern) => item.low === pattern || item.low.includes(pattern)))
      .sort((a, b) => a.text.length - b.text.length)[0]?.el || null;
  }

  function cleanEssayText(text, question) {
    let value = String(text || '');
    value = value.replace(/\r/g, '');
    value = value.replace(/Word count:\s*\d+/gi, '');
    value = value.replace(/Nộp bài:\s*[^\n]+/gi, '');
    value = value.replace(/\d+\s*thảo luận/gi, '');
    value = value.replace(/Chia sẻ bài làm/gi, '');
    value = value.replace(/Bài gốc/gi, '');
    value = value.replace(/YouPass sửa bài/gi, '');
    value = value.replace(/Sample từ YouPass/gi, '');
    if (question) value = value.replace(question, '');
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function isEssayLike(text) {
    const cleaned = cleanEssayText(text, '');
    if (cleaned.length < 250 || cleaned.length > 9000) return false;
    if (/(band score|task response|lexical resource|coherence\s*&\s*cohesion|grammatical range|tra từ vựng|ghi chú|youpass sửa bài|sample từ youpass)/i.test(cleaned)) {
      return false;
    }
    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
    if (wordCount < 80) return false;
    return /\b(in conclusion|on the one hand|on the other hand|however|moreover|furthermore|while|although|personally|i believe)\b/i.test(cleaned)
      || wordCount >= 140;
  }

  function closestTabPanel(el) {
    let cursor = el;
    for (let depth = 0; cursor && depth < 8; depth += 1, cursor = cursor.parentElement) {
      const role = cursor.getAttribute?.('role');
      if (role === 'tabpanel') return cursor;
      if (cursor.matches?.('[class*="tab"],[class*="panel"],[class*="content"],[class*="essay"]')) return cursor;
    }
    return null;
  }

  function textAfterHeading(heading) {
    const root = closestTabPanel(heading) || heading.parentElement;
    if (!root) return '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    const lines = [];
    let seenHeading = false;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!isVisible(node)) continue;
      if (node === heading) {
        seenHeading = true;
        continue;
      }
      const text = rawElementText(node).trim();
      if (!text) continue;
      const low = text.toLowerCase();
      if (seenHeading && /^(youpass sửa bài|sample từ youpass|ghi chú|tra từ vựng|task response|coherence|lexical resource|gra|band score)$/i.test(text.trim())) {
        break;
      }
      if (seenHeading && node.children.length === 0) lines.push(text);
    }
    return lines.join('\n');
  }

  function isUiText(text) {
    return /^(youpass sửa bài|sample từ youpass|ghi chú|tra từ vựng|task response|coherence|lexical resource|gra|band score|bài viết của bạn|word count|nộp bài|chia sẻ bài làm)$/i.test(norm(text))
      || /(band score|task response|lexical resource|coherence\s*&\s*cohesion|grammatical range|tra từ vựng|ghi chú|youpass sửa bài|sample từ youpass)/i.test(text);
  }

  function visibleLeafTextElements() {
    return allElements.filter((el) => {
      const text = rawElementText(el).trim();
      if (!text || isUiText(text)) return false;
      const visibleChildren = Array.from(el.children || []).filter(isVisible);
      const childTextLength = visibleChildren.reduce((sum, child) => sum + elementText(child).length, 0);
      return childTextLength < elementText(el).length * 0.55;
    });
  }

  function textAfterHeadingByGeometry(heading, question) {
    if (!heading) return '';
    const headingRect = heading.getBoundingClientRect();
    const leaves = visibleLeafTextElements()
      .map((el) => ({ el, text: rawElementText(el).trim(), rect: el.getBoundingClientRect() }))
      .filter((item) => item.rect.top > headingRect.bottom - 4)
      .filter((item) => item.rect.left < Math.max(window.innerWidth * 0.72, headingRect.left + 900))
      .filter((item) => item.text.length > 15)
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

    const lines = [];
    for (const item of leaves) {
      const clean = norm(item.text);
      if (/^(youpass sửa bài|sample từ youpass|ghi chú|tra từ vựng)$/i.test(clean)) break;
      if (question && clean === norm(question)) continue;
      if (promptScore(clean) >= 4 && lines.length === 0) continue;
      lines.push(item.text);
      const candidate = cleanEssayText(lines.join('\n'), question);
      if (isEssayLike(candidate) && candidate.split(/\s+/).length >= 180) return candidate;
    }

    return cleanEssayText(lines.join('\n'), question);
  }

  function findEssay(question) {
    const heading = findHeading(['bài gốc', 'original essay', 'your essay']);
    if (heading) {
      const afterHeading = cleanEssayText(textAfterHeading(heading), question);
      if (isEssayLike(afterHeading)) return afterHeading;

      const geometricText = textAfterHeadingByGeometry(heading, question);
      if (isEssayLike(geometricText)) return geometricText;

      const nearbyBlocks = [];
      let cursor = heading.nextElementSibling;
      for (let index = 0; cursor && index < 8; index += 1, cursor = cursor.nextElementSibling) {
        const text = rawElementText(cursor);
        if (/(youpass sửa bài|sample từ youpass|ghi chú|tra từ vựng|task response|coherence|lexical resource|gra|band score)/i.test(text)) break;
        nearbyBlocks.push(text);
        const cleaned = cleanEssayText(nearbyBlocks.join('\n'), question);
        if (isEssayLike(cleaned)) return cleaned;
      }
    }

    const blocks = allElements
      .map((el) => elementText(el))
      .filter((text) => text.length > 350 && text.length < 12000)
      .filter((text) => !/(band score|task response|lexical resource|coherence\s*&\s*cohesion|tra từ vựng|ghi chú|youpass sửa bài|sample từ youpass)/i.test(text))
      .map((text) => cleanEssayText(text, question))
      .filter(isEssayLike);

    blocks.sort((a, b) => b.length - a.length);
    return blocks[0] || '';
  }

  const question = findQuestion();
  const essay = findEssay(question);

  return {
    url: location.href,
    question,
    essay,
    debug: {
      visibleElementCount: allElements.length,
      bodyTextLength: norm(document.body?.innerText || '').length,
      bodyTextSample: norm(document.body?.innerText || '').slice(0, 30000),
      hasBaiGocHeading: Boolean(findHeading(['bài gốc', 'original essay', 'your essay'])),
      questionLength: question.length,
      essayLength: essay.length,
    },
    scores: {
      overall: findScore(['Band Score', 'Overall', 'Kết quả']),
      taskResponse: findScore(['Task Response', 'Task achievement', 'TR', 'TA']),
      coherenceCohesion: findScore(['Coherence & Cohesion', 'Coherence and Cohesion', 'CC']),
      lexicalResource: findScore(['Lexical Resource', 'LR']),
      gra: findScore(['GRA', 'Grammar', 'Grammatical Range']),
    },
  };
}
