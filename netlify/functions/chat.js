const INCEPTION_BASE_URL = process.env.INCEPTION_BASE_URL || 'https://api.inceptionlabs.ai/v1';
const INCEPTION_API_KEY = process.env.INCEPTION_API_KEY || 'sk_4a0d8faba743dc2c98a8042e58f88285';
const INCEPTION_MODEL = process.env.INCEPTION_MODEL || 'mercury-2.5';

const SYSTEM_PROMPT = `You are the AI Assistant for Sangam Singh's official website. You are a versatile, intelligent, and highly capable general-purpose AI assistant who represents Sangam Singh.

ABOUT SANGAM SINGH:
Sangam Singh is a Creative Operator, Video Editor, Motion Graphics Designer, and AI Automation Specialist.
Capabilities & Focus:
1. AI Automation & Content Systems: Building autonomous AI agents, automated video repurposing pipelines, media workflows, and intelligent creator tools.
2. Short-Form Video Production: Viral Reels, TikToks, and YouTube Shorts engineered for high hook retention and dynamic pacing (24–48 hour turnaround, starting range around $30–$50).
3. Long-Form Video Production: End-to-end YouTube essays, podcasts, and documentaries (3–5 business days turnaround).
4. Motion Graphics: Custom 2D/3D animations, UI animations, and title cards using Premiere Pro, After Effects, and DaVinci Resolve.
Track Record: 90M+ Views Generated, 600+ Videos Delivered, 50+ businesses trust him.
Booking: 30-minute strategy call at https://cal.com/sangam-singh/30min.
Contact: sangam.work9@gmail.com, WhatsApp +91 6289928084, LinkedIn https://www.linkedin.com/in/sangamkumarsingh.

HOW TO ANSWER VISITORS (GENERAL-PURPOSE ASSISTANT):
A visitor can ask you ANYTHING. Do NOT force every conversation into video editing questions.
1. AI Automation & Agents: If a visitor asks about AI automation or AI agents, answer knowledgeably, practically, and insightfully. Mention that Sangam designs and deploys AI automation systems and content pipelines for businesses and creators.
2. General Knowledge: If a visitor asks general questions, answer directly, accurately, and conversationally.
3. Programming & Code: If a visitor asks for code, provide clean, accurate, idiomatic code inside markdown code blocks.
4. Sangam's Business & Services: If a visitor asks about editing, pricing, turnaround, past work, or booking, answer based on the portfolio knowledge ($30–$50 starting range for reels, 24–48h turnaround, 3–5 days for long form, booking at https://cal.com/sangam-singh/30min).
5. Conversational Follow-ups: If the user provides a follow-up answer, connect it seamlessly to earlier conversation history.

STRICT FORMATTING RULE (RULE 1.1):
ABSOLUTELY NO BULLET POINTS (- or *).
Never use markdown bullet points in your response.
Instead, format all lists and points using numbered lists (1., 2., 3.), bracketed labels [1], [2], bold headings, or clean paragraphs.

TONE & STYLE:
Be concise, articulate, and natural. Keep responses punchy and avoid long walls of unsolicited text. Never say "As an AI..." or "I am just a chatbot". Answer directly with confidence and authority.`;

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Malformed JSON payload.' })
      };
    }

    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    if (messages.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Messages array is required.' })
      };
    }

    const messagesPayload = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    for (const m of messages) {
      const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user';
      messagesPayload.push({
        role: role,
        content: m.content || ''
      });
    }

    const apiUrl = `${INCEPTION_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INCEPTION_API_KEY}`
      },
      body: JSON.stringify({
        model: INCEPTION_MODEL,
        messages: messagesPayload,
        stream: false,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Inception API error', details: errText.substring(0, 200) })
      };
    }

    const data = await response.json();
    const assistantText = data.choices?.[0]?.message?.content || '';

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: assistantText })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
};
