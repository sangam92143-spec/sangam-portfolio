/**
 * Sangam AI Portfolio Chatbot - Core Chat Service
 * Single Authoritative Gemini Pipeline with SSE Streaming,
 * Real-Time Web Grounding, and Technical Fallback.
 */

const fs = require('fs');
const path = require('path');
const { PORTFOLIO_KNOWLEDGE, getSystemInstruction } = require('../data/chatbotKnowledge');
const { searchLiveWeb, fetchLiveWeather } = require('./webSearchService');
const {
  extractWorkingMemory,
  buildContextWindow
} = require('./conversationManager');

const CHAT_LOGS_FILE = path.join(__dirname, '..', 'data', 'chat_logs.json');

/**
 * Log conversation turn to disk for website owner audit
 */
function logConversationTurn(userText, assistantText, ip) {
  try {
    let logs = [];
    if (fs.existsSync(CHAT_LOGS_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(CHAT_LOGS_FILE, 'utf8') || '[]');
      } catch (e) {
        logs = [];
      }
    }
    logs.push({
      id: 'LOG-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
      timestamp: new Date().toISOString(),
      user: userText || '',
      assistant: assistantText || '',
      ip: ip || 'local'
    });
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    fs.writeFileSync(CHAT_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('[CHAT LOG ERROR]', err.message);
  }
}

/**
 * Stream a technical fallback chunk by chunk via SSE
 */
async function streamFallbackResponse(res, text, lastUserMessage, ip) {
  const words = text.split(/(\s+)/);
  for (let i = 0; i < words.length; i += 3) {
    const chunk = words.slice(i, i + 3).join('');
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    await new Promise(r => setTimeout(r, 16));
  }
  res.write('data: [DONE]\n\n');
  res.end();

  logConversationTurn(lastUserMessage, text, ip);
}

/**
 * Resolve Inception Labs API configuration dynamically
 */
function getInceptionConfig() {
  let apiKey = process.env.INCEPTION_API_KEY || 'sk_4a0d8faba743dc2c98a8042e58f88285';
  let baseUrl = process.env.INCEPTION_BASE_URL || 'https://api.inceptionlabs.ai/v1';
  let model = process.env.INCEPTION_MODEL || 'mercury-2.5';

  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        if (trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (key === 'INCEPTION_API_KEY') apiKey = val;
          if (key === 'INCEPTION_BASE_URL') baseUrl = val;
          if (key === 'INCEPTION_MODEL') model = val;
        }
      }
    } catch (e) {}
  }

  return { apiKey, baseUrl, model };
}

/**
 * Handle incoming chat requests.
 * Authoritative pipeline:
 * 1. User message arrives
 * 2. Conversation history is loaded
 * 3. Structured memory is extracted/updated
 * 4. Website knowledge is injected into the Gemini prompt
 * 5. Relevant live web data is added if query requires external/real-time facts
 * 6. Full prompt + history sent to Gemini API
 * 7. Gemini generates the response
 * 8. Gemini response is streamed to the user via SSE
 * Fallback: If Gemini API fails (quota, network, invalid key), return:
 * "Sorry, I’m having trouble connecting right now. Please try again."
 */
async function handleChatStream(req, res, payload) {
  const messages = payload && Array.isArray(payload.messages) ? payload.messages : [];
  const clientContext = payload && payload.context ? payload.context : {};

  if (messages.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Messages array is required.' }));
    return;
  }

  // SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const lastUserObj = messages.filter(m => m.role === 'user').pop() || {};
  const lastUserMessage = (lastUserObj.content || '').trim();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';

  // 1. Structured Working Memory extraction
  const memory = extractWorkingMemory(messages);

  // 2. Compact context window when conversation grows long
  const { recentMessages, compactSummary } = buildContextWindow(messages, memory, 10);

  // 3. Web Search / Live Weather Detection
  let liveSearchResult = null;
  const isSearchQuery =
    /\b(weather|temperature|forecast|climate|raining|rainy)\b/i.test(lastUserMessage) ||
    lastUserMessage.toLowerCase().startsWith('what happened in') ||
    lastUserMessage.toLowerCase().startsWith('latest ai news') ||
    lastUserMessage.toLowerCase().startsWith('latest gemini model') ||
    lastUserMessage.toLowerCase().startsWith('current price of') ||
    lastUserMessage.toLowerCase().startsWith('search for ');

  if (isSearchQuery) {
    if (/\b(weather|temperature|forecast)\b/i.test(lastUserMessage)) {
      liveSearchResult = await fetchLiveWeather(lastUserMessage);
    } else {
      liveSearchResult = await searchLiveWeb(lastUserMessage);
    }
  }

  const { apiKey, baseUrl, model } = getInceptionConfig();

  // Temporary Server Debug Logging
  console.log('\n=================== [CHAT REQUEST PIPELINE] ===================');
  console.log(`[CHAT LOG] Received user message: "${lastUserMessage}"`);
  console.log(`[CHAT LOG] Inception API called: ${apiKey ? 'true' : 'false (Missing INCEPTION_API_KEY in .env)'}`);
  console.log(`[CHAT LOG] Inception model used: ${model}`);
  console.log(`[CHAT LOG] Conversation history included: ${recentMessages.length > 1 ? 'true (turns=' + recentMessages.length + ')' : 'false (first turn)'}`);
  console.log(`[CHAT LOG] Website knowledge included: true`);
  console.log(`[CHAT LOG] Web search triggered: ${liveSearchResult ? 'true' : 'false'}`);

  const TECHNICAL_FALLBACK_TEXT = "Sorry, I’m having trouble connecting right now. Please try again.";

  // If no Inception API key is configured, return the clean technical fallback
  if (!apiKey) {
    console.log('[CHAT LOG] Error: No INCEPTION_API_KEY configured. Returning technical fallback.');
    console.log(`[CHAT LOG] Response sent to client: "${TECHNICAL_FALLBACK_TEXT}"`);
    console.log('================================================================\n');
    await streamFallbackResponse(res, TECHNICAL_FALLBACK_TEXT, lastUserMessage, clientIp);
    return;
  }

  try {
    // 4. Formulate System Prompt with Website Knowledge + Memory + Context + Live Data
    let memoryBlock = '\n\n<STRUCTURED_WORKING_MEMORY>\n';
    memoryBlock += 'Established conversation context facts (use without asking user to repeat):\n';
    if (memory.visitor_name) memoryBlock += `1. Visitor Name: ${memory.visitor_name}\n`;
    if (memory.quantity) memoryBlock += `2. Stated Project Quantity: ${memory.quantity}\n`;
    if (memory.project_type) memoryBlock += `3. Project Type: ${memory.project_type}\n`;
    if (memory.video_type) memoryBlock += `4. Video Format/Niche: ${memory.video_type}\n`;
    if (memory.duration) memoryBlock += `5. Target Duration: ${memory.duration}\n`;
    if (memory.style) memoryBlock += `6. Style Preference: ${memory.style}\n`;
    if (memory.services_discussed.length > 0) memoryBlock += `7. Services Discussed: ${memory.services_discussed.join(', ')}\n`;
    if (memory.pricing_discussed.length > 0) memoryBlock += `8. Pricing Discussed: ${memory.pricing_discussed.join(', ')}\n`;
    if (memory.user_preferences.length > 0) memoryBlock += `9. User Preferences: ${memory.user_preferences.join(', ')}\n`;
    if (memory.important_context.length > 0) memoryBlock += `10. Important Context: ${memory.important_context.join('; ')}\n`;
    memoryBlock += '</STRUCTURED_WORKING_MEMORY>\n';

    let summaryBlock = '';
    if (compactSummary) {
      summaryBlock = `\n<PRIOR_CONVERSATION_SUMMARY>\n${compactSummary}\n</PRIOR_CONVERSATION_SUMMARY>\n`;
    }

    let pageContextBlock = '';
    if (clientContext.currentPage || clientContext.currentSection) {
      pageContextBlock = `\n<VISITOR_PAGE_CONTEXT>\n` +
        (clientContext.currentPage ? `Current Page: ${clientContext.currentPage}\n` : '') +
        (clientContext.currentSection ? `Current Viewed Section: ${clientContext.currentSection}\n` : '') +
        `</VISITOR_PAGE_CONTEXT>\n`;
    }

    let searchBlock = '';
    if (liveSearchResult) {
      searchBlock = `\n<RETRIEVED_LIVE_SEARCH_DATA>\n${liveSearchResult}\nUse this verified real-time information to answer the user accurately.\n</RETRIEVED_LIVE_SEARCH_DATA>\n`;
    }

    const fullSystemPrompt = getSystemInstruction() + memoryBlock + summaryBlock + pageContextBlock + searchBlock;

    // Convert messages for Inception chat completions (OpenAI-compatible)
    const messagesPayload = [
      { role: 'system', content: fullSystemPrompt }
    ];

    for (const m of recentMessages) {
      const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user';
      messagesPayload.push({
        role: role,
        content: m.content || ''
      });
    }

    const inceptionPayload = {
      model: model,
      messages: messagesPayload,
      stream: true,
      temperature: 0.4
    };

    const apiUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(inceptionPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[CHAT LOG] Inception API Error: HTTP ${response.status}`, errText.substring(0, 300));
      console.log(`[CHAT LOG] Returning technical fallback to client: "${TECHNICAL_FALLBACK_TEXT}"`);
      console.log('================================================================\n');
      await streamFallbackResponse(res, TECHNICAL_FALLBACK_TEXT, lastUserMessage, clientIp);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullAssistantText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataPayload = trimmed.slice(6);
          if (dataPayload === '[DONE]') continue;

          try {
            const data = JSON.parse(dataPayload);
            const textChunk = data.choices?.[0]?.delta?.content || '';
            if (textChunk) {
              fullAssistantText += textChunk;
              res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
            }
          } catch (e) {}
        }
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.trim().slice(6));
        const textChunk = data.choices?.[0]?.delta?.content || '';
        if (textChunk) {
          fullAssistantText += textChunk;
          res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
        }
      } catch (e) {}
    }

    res.write('data: [DONE]\n\n');
    res.end();

    console.log(`[CHAT LOG] Inception response received: "${fullAssistantText.substring(0, 120)}..."`);
    console.log('================================================================\n');

    // Persist turn
    logConversationTurn(lastUserMessage, fullAssistantText, clientIp);

  } catch (err) {
    console.error(`[CHAT LOG] Execution error: ${err.message}`);
    console.log(`[CHAT LOG] Returning technical fallback to client: "${TECHNICAL_FALLBACK_TEXT}"`);
    console.log('================================================================\n');
    await streamFallbackResponse(res, TECHNICAL_FALLBACK_TEXT, lastUserMessage, clientIp);
  }
}

module.exports = {
  handleChatStream,
  logConversationTurn
};
