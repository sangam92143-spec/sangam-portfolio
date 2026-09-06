/**
 * Conversation Manager & Working Memory Engine
 * Maintains structured facts, handles casual replies, resolves references,
 * compacts long conversation transcripts, and calculates dynamic estimates.
 */

const { PORTFOLIO_KNOWLEDGE } = require('../data/chatbotKnowledge');
const { searchLiveWeb, fetchLiveWeather } = require('./webSearchService');

/**
 * Initialize an empty structured working memory state
 */
function createEmptyMemory() {
  return {
    visitor_name: null,
    project_type: null,        // 'short-form reels', 'long-form videos', 'both', 'motion graphics'
    video_type: null,          // 'reels', 'shorts', 'property tour', 'saas explainer', 'podcast', 'documentary', etc.
    quantity: null,            // integer count
    duration: null,            // e.g. '30 seconds', '6 minutes'
    raw_seconds: null,         // integer seconds
    style: null,               // e.g. 'Hormozi dynamic captions', 'Ali Abdaal clean minimal', 'cinematic'
    budget: null,
    timeline: null,
    services_discussed: [],
    pricing_discussed: [],
    questions_already_answered: [],
    user_preferences: [],
    important_context: [],
    last_assistant_intent: null // 'asked_quantity', 'asked_duration', 'asked_style', 'asked_footage', 'quoted_reels', 'quoted_longform', etc.
  };
}

/**
 * Extract structured working facts from conversation turns
 */
function extractWorkingMemory(messages) {
  const memory = createEmptyMemory();
  const turns = Array.isArray(messages) ? messages : [];

  let lastAssistantText = '';

  turns.forEach((m, idx) => {
    const role = m.role;
    const content = (m.content || '').trim();
    const low = content.toLowerCase();

    if (role === 'assistant' || role === 'model') {
      lastAssistantText = content;
      // Track assistant intent from what was asked
      if (low.includes('how many') || low.includes('volume')) {
        memory.last_assistant_intent = 'asked_quantity';
      } else if (low.includes('how long') || low.includes('duration') || low.includes('minutes') || low.includes('seconds')) {
        memory.last_assistant_intent = 'asked_duration';
      } else if (low.includes('style') || low.includes('aesthetic') || low.includes('vibe')) {
        memory.last_assistant_intent = 'asked_style';
      } else if (low.includes('footage') || low.includes('shot')) {
        memory.last_assistant_intent = 'asked_footage';
      } else if (low.includes('vertical') || low.includes('horizontal') || low.includes('short-form') || low.includes('long-form')) {
        memory.last_assistant_intent = 'asked_format';
      } else if (low.includes('$30') || low.includes('$50') || low.includes('pricing') || low.includes('quote')) {
        memory.last_assistant_intent = 'quoted_price';
      }
      return;
    }

    // Process USER message
    // 1. Name detection
    const namePattern = /(?:my name is|i'm|i am|call me|this is)\s+([A-Za-z]+)/i;
    const nameMatch = content.match(namePattern);
    if (nameMatch) {
      const candidate = nameMatch[1];
      const blacklist = ['a', 'the', 'looking', 'interested', 'here', 'planning', 'ready', 'just', 'asking', 'wondering', 'not', 'wanting', 'hoping'];
      if (!blacklist.includes(candidate.toLowerCase())) {
        memory.visitor_name = candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
        memory.important_context.push(`User name is ${memory.visitor_name}`);
      }
    }

    // 2. Quantity updates / modifications (e.g. "make it 3 instead", "make it 5", "5 reels", "just 5", "5")
    const modificationMatch = content.match(/(?:make it|change to|instead of \d+,?\s*(?:let's do|make it)?|actually)\s*(\d+)/i);
    const countWithUnitMatch = content.match(/\b(\d+)\s*(reels?|shorts?|videos?|tiktoks?|clips?|episodes?)\b/i);
    const bareNumberMatch = content.match(/^\s*(\d+)\s*$/);

    if (modificationMatch) {
      memory.quantity = parseInt(modificationMatch[1], 10);
      memory.important_context.push(`User updated quantity to ${memory.quantity}`);
    } else if (countWithUnitMatch) {
      memory.quantity = parseInt(countWithUnitMatch[1], 10);
      const unit = (countWithUnitMatch[2] || '').toLowerCase();
      if (/reel|short|tiktok/i.test(unit)) {
        memory.project_type = 'short-form reels';
        memory.video_type = 'vertical reels';
      } else if (/episode|podcast/i.test(unit)) {
        memory.project_type = 'long-form videos';
        memory.video_type = 'podcast';
      }
    } else if (bareNumberMatch && (memory.last_assistant_intent === 'asked_quantity' || !memory.quantity)) {
      memory.quantity = parseInt(bareNumberMatch[1], 10);
    }

    // 3. Project type and video niche detection
    if (low.includes('reel') || low.includes('short-form') || low.includes('short form') || low.includes('vertical') || low.includes('shorts') || low.includes('tiktok')) {
      memory.project_type = 'short-form reels';
      if (!memory.video_type) memory.video_type = 'reels';
    } else if (low.includes('long-form') || low.includes('long form') || low.includes('youtube video') || low.includes('documentary') || low.includes('podcast')) {
      memory.project_type = 'long-form videos';
      if (low.includes('podcast')) memory.video_type = 'podcast';
      else if (low.includes('documentary')) memory.video_type = 'documentary';
      else if (!memory.video_type) memory.video_type = 'long-form video';
    } else if (low.includes('motion graphic') || low.includes('animation') || low.includes('ui animation')) {
      memory.project_type = 'motion graphics';
      memory.video_type = 'motion graphics';
    }

    // Specific video niches
    if (low.includes('real estate') || low.includes('property') || low.includes('realtor') || low.includes('walkthrough')) {
      memory.video_type = 'real estate walkthrough';
      memory.user_preferences.push('real estate niche');
    } else if (low.includes('saas') || low.includes('software demo') || low.includes('app demo')) {
      memory.video_type = 'SaaS product demo';
      memory.user_preferences.push('SaaS & UI animations');
    } else if (low.includes('fitness') || low.includes('workout') || low.includes('gym')) {
      memory.video_type = 'fitness video';
      memory.user_preferences.push('high-energy beat-synced edits');
    } else if (low.includes('crypto') || low.includes('finance') || low.includes('trading')) {
      memory.video_type = 'finance & crypto video';
    } else if (low.includes('e-commerce') || low.includes('ecommerce') || low.includes('product ad')) {
      memory.video_type = 'e-commerce product ad';
    }

    // 4. Duration detection ("30 sec each", "30 seconds", "60s", "6 minutes", "6 min")
    const durSecMatch = content.match(/\b(\d+)\s*(?:seconds?|secs?|s)\b/i);
    const durMinMatch = content.match(/\b(\d+)\s*(?:minutes?|mins?|min|m)\b/i);
    const bareDurMatch = content.match(/^\s*(\d+)\s*(?:sec|seconds?|min|minutes?)\s*$/i);

    if (durMinMatch) {
      const mins = parseInt(durMinMatch[1], 10);
      memory.duration = `${mins} minute${mins > 1 ? 's' : ''}`;
      memory.raw_seconds = mins * 60;
    } else if (durSecMatch) {
      const secs = parseInt(durSecMatch[1], 10);
      memory.duration = `${secs} seconds`;
      memory.raw_seconds = secs;
    } else if (bareDurMatch) {
      memory.duration = content.trim();
    } else if (memory.last_assistant_intent === 'asked_duration' && /^\s*(\d+)\s*$/.test(content)) {
      // If assistant asked for duration and user typed "6", check context (likely minutes if longform, seconds if reels)
      const num = parseInt(content.trim(), 10);
      if (memory.project_type === 'long-form videos' || low.includes('long')) {
        memory.duration = `${num} minutes`;
        memory.raw_seconds = num * 60;
      } else {
        memory.duration = `${num} seconds`;
        memory.raw_seconds = num;
      }
    }

    // 5. Style detection ("Something like Hormozi", "Ali Abdaal", "cinematic", "talking head")
    if (low.includes('hormozi')) {
      memory.style = 'Alex Hormozi dynamic captions & high-energy hooks';
      memory.user_preferences.push('Hormozi dynamic captions');
    } else if (low.includes('abdaal')) {
      memory.style = 'Ali Abdaal clean minimal documentary';
      memory.user_preferences.push('Ali Abdaal aesthetic');
    } else if (low.includes('cinematic')) {
      memory.style = 'cinematic color-graded with sound design';
      memory.user_preferences.push('cinematic aesthetic');
    } else if (low.includes('talking head')) {
      memory.style = 'talking head with dynamic zoom cuts and b-roll';
      memory.user_preferences.push('talking head format');
    }

    // 6. Topics & questions tracked
    if (low.includes('service') || low.includes('offer')) memory.services_discussed.push('video editing and motion design services');
    if (low.includes('charge') || low.includes('cost') || low.includes('price') || low.includes('pricing') || low.includes('how much') || low.includes('total')) {
      memory.pricing_discussed.push('project pricing estimate');
    }
  });

  // Deduplicate array fields
  memory.services_discussed = [...new Set(memory.services_discussed)];
  memory.pricing_discussed = [...new Set(memory.pricing_discussed)];
  memory.user_preferences = [...new Set(memory.user_preferences)];
  memory.important_context = [...new Set(memory.important_context)];

  return memory;
}

/**
 * Summarize older conversation messages when total messages exceed threshold.
 * Keeps recent messages verbatim while condensing older turns into a compact bullet-free paragraph.
 */
function buildContextWindow(messages, memory, maxRecentTurns = 6) {
  const turns = Array.isArray(messages) ? messages : [];
  if (turns.length <= maxRecentTurns) {
    return {
      recentMessages: turns,
      compactSummary: null
    };
  }

  const splitIdx = turns.length - maxRecentTurns;
  const olderMessages = turns.slice(0, splitIdx);
  const recentMessages = turns.slice(splitIdx);

  // Generate compact factual summary of older turns
  const summaryParts = [];
  if (memory.visitor_name) {
    summaryParts.push(`Visitor is ${memory.visitor_name}.`);
  }
  if (memory.quantity && memory.project_type) {
    summaryParts.push(`Discussed creating ${memory.quantity} ${memory.project_type}.`);
  } else if (memory.project_type) {
    summaryParts.push(`Discussed ${memory.project_type}.`);
  }
  if (memory.duration) {
    summaryParts.push(`Target video length is ${memory.duration} each.`);
  }
  if (memory.style) {
    summaryParts.push(`Requested ${memory.style} styling.`);
  }
  if (memory.pricing_discussed.length > 0) {
    summaryParts.push(`Pricing and rates were reviewed earlier in the discussion.`);
  }

  const compactSummary = summaryParts.length > 0
    ? summaryParts.join(' ')
    : `Prior conversation established visitor requirements and portfolio services.`;

  return {
    recentMessages,
    compactSummary
  };
}

/**
 * Resolve casual human replies, pronouns, and context-dependent references.
 * Provides accurate calculation, recall, and conversational continuation.
 */
async function resolveContextualResponse(messages, memory, pageContext = {}) {
  const userMessages = (messages || []).filter(m => m.role === 'user').map(m => (m.content || '').trim());
  const lastUserMessage = userMessages[userMessages.length - 1] || '';
  const query = lastUserMessage.toLowerCase().trim();

  // Find immediate previous assistant message for conversational ellipsis
  const assistantMessages = (messages || []).filter(m => m.role === 'assistant' || m.role === 'model').map(m => (m.content || '').trim());
  const lastAssistantMsg = assistantMessages[assistantMessages.length - 1] || '';
  const lastAssistantLow = lastAssistantMsg.toLowerCase();

  // ========================================================
  // 1. DEEP RECALL & IDENTITY (TEST 3)
  // "what did I say my name was?", "what's my name?", "who am I?"
  // ========================================================
  if (
    query.includes('what did i say my name was') ||
    query.includes('what is my name') ||
    query.includes("what's my name") ||
    query.includes('do you remember my name') ||
    query.includes('who am i') ||
    query === 'my name'
  ) {
    if (memory.visitor_name) {
      return `Your name is ${memory.visitor_name}.`;
    }
    return "You haven't mentioned your name yet. What should I call you?";
  }

  // Combined name and project recall: "who am I and what do I need?"
  if ((query.includes('who am i') || query.includes('what is my name')) && (query.includes('project') || query.includes('need') || query.includes('reels'))) {
    let resp = memory.visitor_name ? `You are ${memory.visitor_name}` : "You haven't shared your name yet";
    if (memory.quantity || memory.project_type) {
      resp += `, and you're planning ${memory.quantity ? `${memory.quantity} ` : ''}${memory.project_type || 'videos'}`;
      if (memory.duration) resp += ` (${memory.duration} each)`;
      if (memory.style) resp += ` in ${memory.style} style`;
    }
    resp += '.';
    return resp;
  }

  // Recall project / what are we making
  if (
    query.includes('what is my project') ||
    query.includes("what's my project") ||
    query.includes('what do i need') ||
    query.includes('what are we making') ||
    query.includes('remember my project')
  ) {
    if (memory.quantity || memory.project_type) {
      let desc = `You're looking to create ${memory.quantity ? `${memory.quantity} ` : ''}${memory.project_type || 'videos'}`;
      if (memory.duration) desc += ` at ${memory.duration} each`;
      if (memory.style) desc += ` in ${memory.style} style`;
      return `${desc}. Would you like to finalize timeline details or book a strategy call?`;
    }
    return "You haven't specified your project scope yet. Are you looking to edit short-form reels, long-form YouTube videos, or motion graphics?";
  }

  // ========================================================
  // 2. REAL-TIME WEB SEARCH & WEATHER (TEST 5)
  // "what's the weather today?", "what happened in AI today?", "latest gemini model"
  // ========================================================
  if (/\b(weather|temperature|forecast|climate|raining|rainy|snowing|sunny)\b/i.test(query)) {
    const liveWeather = await fetchLiveWeather(lastUserMessage);
    if (liveWeather) return liveWeather;
    return "I'm currently unable to retrieve the live weather forecast. Please check back in a moment.";
  }

  const isLiveSearchNeeded =
    query.startsWith('what happened in') ||
    query.startsWith('who founded') ||
    query.startsWith('what is the capital of') ||
    query.includes('latest ai news') ||
    query.includes('trending now') ||
    query.includes('latest gemini model') ||
    query.includes('current price of') ||
    query.startsWith('search for ');

  if (isLiveSearchNeeded) {
    const searchResult = await searchLiveWeb(lastUserMessage);
    if (searchResult) return searchResult;
  }

  // ========================================================
  // 3. SCOPE & QUANTITY MODIFICATIONS (TEST 4)
  // E.g. "okay then make it 3 instead", "change to 4", "make it 3"
  // ========================================================
  const isModification =
    query.includes('make it') ||
    query.includes('change to') ||
    query.includes('instead') ||
    query.includes('actually');

  if (isModification) {
    const modMatch = query.match(/(?:make it|change to|instead|actually)\s*(?:to\s*)?(\d+)/i) || query.match(/\b(\d+)\b/);
    if (modMatch) {
      memory.quantity = parseInt(modMatch[1], 10);
    }
    const count = memory.quantity || 3;
    const minTot = count * 30;
    const maxTot = count * 50;
    const pType = memory.project_type || 'reels';
    return `Updated! For ${count} ${pType}${memory.duration ? ` at ${memory.duration} each` : ''}, the revised total is $${minTot}–$${maxTot}. Standard turnaround is 24–48 hours.`;
  }

  // ========================================================
  // 3.5 CASUAL & SHORT HUMAN REPLIES (TEST 6)
  // "okay", "yeah", "no", "nah", "that one", "the first one", "same style", "okay let's do it"
  // ========================================================
  const isCasualAffirmation = !isModification && /^(ok|okay|yeah|yep|sure|sounds good|cool|alright|let's do it|okay let's do it|done)\b/i.test(query);
  const isCasualNegation = /^(no|nah|nope|not really|neither)\b/i.test(query);

  if (isCasualAffirmation) {
    // If assistant just quoted pricing or offered a call:
    if (lastAssistantLow.includes('call') || lastAssistantLow.includes('cal.com') || lastAssistantLow.includes('schedule') || lastAssistantLow.includes('booking')) {
      return `Awesome! You can pick a convenient time on Sangam's calendar right here: [Book a 30-Min Call](${PORTFOLIO_KNOWLEDGE.booking.directLink}).`;
    }
    if (lastAssistantLow.includes('footage') || lastAssistantLow.includes('upload') || lastAssistantLow.includes('drive')) {
      return "Great. You can share your Google Drive, Dropbox, or Frame.io link, or schedule a quick 30-minute kickoff call to review the files together.";
    }
    if (memory.quantity && (memory.project_type || memory.duration)) {
      const minTot = memory.quantity * 30;
      const maxTot = memory.quantity * 50;
      return `Sounds good! For your ${memory.quantity} ${memory.project_type || 'reels'}${memory.duration ? ` (${memory.duration} each)` : ''}, the estimated total is $${minTot}–$${maxTot}. Would you like to share your footage or book a call to get started?`;
    }
    return "Sounds great! Let me know what details you'd like to dive into next, or we can schedule a strategy call whenever you're ready.";
  }

  if (isCasualNegation) {
    return "No problem at all. Let me know what format, timeline, or questions you'd like to explore instead.";
  }

  // "same style"
  if (query.includes('same style') || query.includes('like before')) {
    if (memory.style) {
      return `Got it, we will keep the ${memory.style} style for these edits as well.`;
    }
    return "Understood. What style did you have in mind—dynamic captions with fast hooks (Hormozi style) or a clean minimal documentary look?";
  }

  // "the first one" / "that one"
  if (query === 'the first one' || query === 'first one' || query === 'that one') {
    if (lastAssistantLow.includes('short-form') || lastAssistantLow.includes('reel')) {
      memory.project_type = 'short-form reels';
      return "Short-form reels it is! How many reels are you looking to produce, and do you have raw footage ready?";
    }
    return "Understood. How many videos are you planning for this project?";
  }

  // ========================================================
  // 4. PRICING & DYNAMIC TOTAL CALCULATION (TEST 1, TEST 2)
  // "how much?", "what would the total be?", "so how much?"
  // ========================================================
  const isPricingInquiry =
    query.includes('how much') ||
    query.includes('what would the total be') ||
    query.includes('total') ||
    query.includes('so how much') ||
    query.includes('cost') ||
    query.includes('pricing') ||
    query.includes('rate') ||
    query.includes('charge');

  if (isPricingInquiry) {
    // If long-form is being discussed
    if (memory.project_type === 'long-form videos' || query.includes('long form') || query.includes('long-form') || query.includes('youtube')) {
      if (memory.duration || query.includes('minute') || query.includes('min')) {
        const durText = memory.duration || '6 minutes';
        return `For a ${durText} long-form video with cinematic pacing, custom b-roll, motion graphics, and audio mastering, pricing typically ranges from $80–$150 depending on footage volume and graphic complexity. Turnaround is 3–5 business days.`;
      }
      return "For long-form YouTube and documentary edits, pricing typically ranges from $80–$150+ per video depending on the raw footage length and motion graphics required. How long is your final video expected to be?";
    }

    // Short-form with quantity known (e.g. 5 reels)
    if (memory.quantity) {
      const minTot = memory.quantity * 30;
      const maxTot = memory.quantity * 50;
      const durText = memory.duration ? ` at ${memory.duration} each` : '';
      const styleText = memory.style ? ` in ${memory.style}` : '';
      return `For ${memory.quantity} short-form reels${durText}${styleText}, the total comes out to approximately $${minTot}–$${maxTot} ($30–$50 per reel) with turnaround in 24–48 hours. Would you like to review raw footage or book a strategy call?`;
    }

    // Section-aware inquiry: "how much is this?", "pricing for this section"
    const section = (pageContext.currentSection || '').toLowerCase();
    if ((query.includes('this') || query.includes('section') || query.includes('here')) && section) {
      if (section.includes('short') || section.includes('reel')) {
        return "You're currently viewing the short-form editing section! Standard vertical reels (Instagram, TikTok, Shorts) are typically $30–$50 per reel with 24–48 hour delivery. How many reels are you planning?";
      }
      if (section.includes('long') || section.includes('youtube')) {
        return "You're viewing the long-form editing section! Long-form YouTube edits typically range from $80–$150 per video with 3–5 business day turnaround. How long is your final cut expected to be?";
      }
      if (section.includes('package') || section.includes('monthly') || section.includes('retainer')) {
        return "You're viewing the monthly packages! We offer monthly creator retainers with guaranteed weekly volume and priority turnaround. Would you like to discuss a customized monthly package?";
      }
    }

    // General pricing inquiry
    return "Pricing depends on video length, volume, and editing complexity, but standard short-form reels are typically $30–$50 per video. Monthly retainers are also available for consistent creators. How many videos are you looking to edit?";
  }

  // ========================================================
  // 5. FORMAT TRANSITION & CONTEXTUAL FOLLOW-UPS (TEST 2)
  // "what about long form?", "and long form?", "and shorts?", "can you do both?"
  // ========================================================
  if (
    query.includes('what about long form') ||
    query.includes('and long form') ||
    query.includes('long form') ||
    query.includes('long-form') ||
    query.includes('youtube')
  ) {
    memory.project_type = 'long-form videos';
    return "For long-form YouTube videos and podcasts, Sangam handles end-to-end editing: narrative pacing, custom B-roll, motion graphics, and audio mastering with a 3–5 business day turnaround. Approximately how long will your video be?";
  }

  if (query.includes('and shorts') || query.includes('what about shorts') || query.includes('reels')) {
    memory.project_type = 'short-form reels';
    return "For short-form reels and shorts, delivery is 24–48 hours, with dynamic hooks, kinetic captions, and sound design at $30–$50 per reel. How many are you planning?";
  }

  if (query.includes('both') || query.includes('can you do both')) {
    memory.project_type = 'both';
    return "Yes, we frequently build systems that produce full-length long-form YouTube episodes and repurpose each one into 3–5 viral vertical reels for social distribution.";
  }

  // ========================================================
  // 6. SHORT DIRECT INPUTS (DURATION OR QUANTITY SPECIFICATIONS)
  // E.g. "5", "30 sec each", "6 minutes"
  // ========================================================
  // Single number reply (e.g. user answered "5" or "10")
  if (/^\s*\d+\s*$/.test(query)) {
    const num = parseInt(query, 10);
    memory.quantity = num;
    const pType = memory.project_type || 'reels';
    return `Got it, ${num} ${pType}. What style or aesthetic are you looking for, and approximately how long will each video be?`;
  }

  // Duration specified (e.g. "30 sec each", "6 minutes", "60s")
  const durMatch = query.match(/\b(\d+)\s*(?:seconds?|secs?|min|minutes?)\b/i);
  if (durMatch) {
    if (memory.quantity && (memory.project_type === 'short-form reels' || !memory.project_type)) {
      const minTot = memory.quantity * 30;
      const maxTot = memory.quantity * 50;
      return `Got it—${memory.duration || '30 seconds'} each for ${memory.quantity} reels. Standard pricing is $30–$50 per reel (around $${minTot}–$${maxTot} total). What style do you prefer, such as dynamic Hormozi captions or a clean aesthetic?`;
    }
    if (memory.project_type === 'long-form videos') {
      return `Understood, a ${memory.duration || '6-minute'} long-form edit. Standard turnaround is 3–5 business days, typically $80–$150 depending on motion design and footage volume. Would you like to discuss the raw assets or book a call?`;
    }
    return `Got it, ${memory.duration || query}. How many videos are you planning to produce?`;
  }

  // Style specified (e.g. "Something like Hormozi", "Ali Abdaal style")
  if (query.includes('hormozi') || query.includes('abdaal') || query.includes('cinematic') || query.includes('clean')) {
    const countPart = memory.quantity ? `for your ${memory.quantity} reels ` : '';
    return `Great choice! The ${memory.style || 'dynamic'} style ${countPart}works exceptionally well for audience retention. Do you already have raw footage shot, or are you planning your shoot?`;
  }

  // Quantity modification ("okay then make it 3 instead")
  if (query.includes('make it') || query.includes('change to') || query.includes('instead')) {
    if (memory.quantity) {
      const minTot = memory.quantity * 30;
      const maxTot = memory.quantity * 50;
      const pType = memory.project_type || 'reels';
      return `Updated! For ${memory.quantity} ${pType}${memory.duration ? ` at ${memory.duration} each` : ''}, the revised total is $${minTot}–$${maxTot}. Turnaround is 24–48 hours.`;
    }
  }

  // ========================================================
  // 7. SERVICES INQUIRY (TEST 2)
  // "what services do you offer?"
  // ========================================================
  if (
    query.includes('service') ||
    query.includes('what do you offer') ||
    query.includes('what can you do') ||
    query.includes('what do you do')
  ) {
    return "Sangam specializes in short-form video editing (Reels, Shorts, TikToks), high-retention long-form YouTube editing, custom motion graphics, and automated content systems. Would you like details on short-form or long-form packages?";
  }

  // ========================================================
  // 8. CAPABILITIES & SOFTWARE INQUIRIES
  // "do you edit podcasts?", "what software do you use?", "can you do subtitles?"
  // ========================================================
  if (query.includes('podcast')) {
    return "Yes! Sangam edits full podcast episodes with multi-cam switching and audio mastering, and also repurposes full episodes into viral short-form clips with animated captions.";
  }

  if (query.includes('software') || query.includes('tool') || query.includes('premiere') || query.includes('after effects') || query.includes('davinci')) {
    return "Sangam edits in **Adobe Premiere Pro**, builds custom 2D/3D visual animations in **After Effects**, and does cinematic color grading and audio mastering in **DaVinci Resolve**.";
  }

  if (query.includes('caption') || query.includes('subtitle')) {
    return "Yes, absolutely. We design kinetic captions with custom fonts, brand colors, emojis, and keyword highlights (similar to Alex Hormozi and Ali Abdaal styles) engineered for hook retention.";
  }

  // ========================================================
  // 9. BOOKING & CONTACT INQUIRIES
  // "how can I book a call?", "contact"
  // ========================================================
  if (query.includes('book') || query.includes('call') || query.includes('schedule') || query.includes('meeting')) {
    return `You can schedule a 30-minute video strategy call with Sangam right here: [Book a 30-Min Call](${PORTFOLIO_KNOWLEDGE.booking.directLink}).`;
  }

  if (query.includes('contact') || query.includes('email') || query.includes('whatsapp') || query.includes('reach')) {
    return "You can reach Sangam directly at [sangam.work9@gmail.com](mailto:sangam.work9@gmail.com) or WhatsApp at [+91 6289928084](https://wa.me/916289928084).";
  }

  // ========================================================
  // 10. PORTFOLIO & WORK
  // ========================================================
  if (query.includes('portfolio') || query.includes('work') || query.includes('sample') || query.includes('showreel')) {
    return "Featured portfolio work includes the **SHOW REEL**, **Funding Pitch Video**, **VSL Edit**, **UI Animation**, and 5 interactive viral reels on the homepage. Would you like short-form or long-form samples?";
  }

  // ========================================================
  // 11. FOOTAGE READINESS
  // ========================================================
  if (query.includes('have footage') || query.includes('already shot') || query.includes('footage ready')) {
    return "That's great! Having raw footage ready means we can begin right away. You can share files via Google Drive, Dropbox, or Frame.io. Would you like to finalize a quote or schedule a strategy call?";
  }

  // ========================================================
  // 12. ADAPTIVE CONTEXT-AWARE FALLBACK (NO CANNED FAQ LOOPS)
  // ========================================================
  const namePrefix = memory.visitor_name ? `${memory.visitor_name}, ` : '';
  if (memory.quantity && memory.project_type) {
    return `${namePrefix}For your ${memory.quantity} ${memory.project_type}, standard turnaround is 24–48 hours ($30–$50/reel). Would you like an exact estimate or to book a quick strategy call?`;
  }
  if (memory.project_type) {
    return `${namePrefix}For your ${memory.project_type}, approximately how many videos are you planning to create, and do you already have raw footage?`;
  }

  return `${namePrefix}Tell me a bit about what kind of video you're looking to create—are you planning short-form reels, a long-form YouTube video, or motion graphics?`;
}

module.exports = {
  createEmptyMemory,
  extractWorkingMemory,
  buildContextWindow,
  resolveContextualResponse
};
