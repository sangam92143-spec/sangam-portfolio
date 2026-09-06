// Structured knowledge base and system prompt module for Sangam Singh's AI Portfolio Chatbot

const PORTFOLIO_KNOWLEDGE = {
  creator: {
    name: "Sangam Singh",
    brand: "@sangamsingh",
    primaryPositioning: "Creative Operator",
    capabilities: [
      "Video Editor",
      "Motion Graphics Designer",
      "AI Automation Specialist",
      "Content Systems Builder"
    ],
    mission: "Helps founders, creators, and businesses produce high-impact content while engineering systems that make content creation reliable and scalable.",
    brandPerception: [
      "Reliable",
      "Business-minded",
      "Operator",
      "Problem Solver",
      "Creative Strategist",
      "Execution Partner",
      "Trustworthy"
    ],
    targetAudience: [
      "Founders & Tech Startups",
      "Content Creators & Influencers",
      "Business Owners",
      "Marketing Teams",
      "Agencies"
    ]
  },

  stats: {
    viewsGenerated: "90M+ Views Generated",
    videosDelivered: "600+ Videos Delivered",
    businessesTrustUs: "50+ Businesses Trust Us"
  },

  services: [
    {
      title: "Short-Form Video Editing",
      description: "Viral Reels, TikToks, and YouTube Shorts engineered for high hook retention, dynamic pacing, custom typography, sound design, and vertical storytelling.",
      turnaround: "24–48 hours",
      bestFor: "Building brand awareness, organic reach, and social audience scaling."
    },
    {
      title: "Long-Form Video Editing",
      description: "End-to-end editing for high-retention YouTube videos, podcast episodes, brand documentaries, and educational content with cinematic pacing, custom B-roll, motion graphics, and audio mastering.",
      turnaround: "3–5 business days depending on footage length and motion graphics complexity.",
      bestFor: "In-depth brand authority, long-form YouTube channels, podcast series, and course material."
    },
    {
      title: "Motion Graphics & Visual Design",
      description: "Custom 2D/3D animations, kinetic typography, UI animations, SaaS explainer visuals, title cards, and brand asset development.",
      tools: ["Adobe Premiere Pro", "Adobe After Effects", "DaVinci Resolve"]
    },
    {
      title: "Content Systems & AI Automation",
      description: "Streamlined production workflows, automated asset handoffs, repurposing systems, and data-driven creative iteration."
    }
  ],

  projects: [
    { name: "SHOW REEL", type: "Portfolio Highlight Reel", description: "High-energy showcase of motion design, cinematic transitions, and storytelling craft." },
    { name: "Funding Pitch Video", type: "Investor / Startup", description: "Persuasive startup pitch video highlighting value propositions and metrics." },
    { name: "VSL EDIT", type: "Video Sales Letter", description: "Conversion-optimized sales video driving audience action with punchy pacing and visual proof." },
    { name: "NEAT & CLEAN EDIT", type: "Minimalist Brand Video", description: "Clean, elegant editing aesthetic emphasizing clarity, high-fidelity sound, and polish." },
    { name: "UI ANIMATION", type: "Product / Software Demo", description: "Crisp UI interaction animation demonstrating digital apps and user experiences." },
    { name: "SAAS EXPLAINER", type: "Software Explainer", description: "Engaging explainer breaking down SaaS features into intuitive visual narratives." }
  ],

  testimonials: [
    {
      quote: "I send Sangam raw clips and get back professional, polished reels that drive results. Fast turnaround and great communication!",
      author: "Alex Turner",
      role: "Founder at Turner Digital Media"
    },
    {
      quote: "Sangam's edits took our social media presence to a new level. Every video feels cinematic and on-brand. Engagement has doubled!",
      author: "Fuanyi Johnson",
      role: "Budget Analyst & Tax professional"
    },
    {
      quote: "Working with Sangam Singh saved us hours of in-house editing. He brings creative ideas to the table and always delivers on time.",
      author: "Johnny Sanchez",
      role: "Founder of Beyond Media"
    },
    {
      quote: "From YouTube vlogs to promo videos, Sangam nails the vibe every time. He understands the creator mindset and delivers magic.",
      author: "Jet Suthpring",
      role: "Founder of Magnet Media"
    }
  ],

  pricing: {
    guideline: "Pricing is customized based on video length, volume, editing complexity, and turnaround requirements.",
    contextualStartingRange: "Typical starting contextual projects fall around $30–$50, but exact quotes depend on project specifications.",
    monthlyPackages: "Monthly editing packages and retainers are available for creators and brands requiring consistent weekly output.",
    recommendation: "Ask for project requirements (type, length, volume, style) before quoting, or guide to booking a strategy call."
  },

  booking: {
    platform: "Cal.com",
    duration: "30 Minutes",
    purpose: "Video Strategy Session",
    directLink: "https://cal.com/sangam-singh/30min",
    websiteAction: "Use the 'Book a call' button in the navigation bar."
  },

  contact: {
    email: "sangam.work9@gmail.com",
    whatsapp: "+91 6289928084",
    twitter: "https://x.com/SangamSingh92",
    linkedin: "https://www.linkedin.com/in/sangam-singh-9887b6430/"
  },

  faqs: [
    {
      q: "What is your typical turnaround time for edits?",
      a: "Short-form content (Reels, TikToks, Shorts) is delivered within 24–48 hours. Long-form YouTube videos and documentary-style edits typically take 3–5 business days depending on length and motion graphics complexity."
    },
    {
      q: "How do we send raw footage and project assets?",
      a: "You can easily upload raw video, audio, and branding assets to Google Drive, Frame.io, Dropbox, or WeTransfer."
    },
    {
      q: "What if I need revisions or tweaks on a video?",
      a: "Rapid revisions are included on all projects! You receive an interactive review link where you can leave timestamped comments on the video player."
    },
    {
      q: "What types of video content do you specialize in?",
      a: "High-retention YouTube long-form edits, viral short-form videos (Reels, Shorts), talking-head podcasts, brand documentaries, and educational content with custom motion graphics."
    },
    {
      q: "What editing software and motion tools do you use?",
      a: "Adobe Premiere Pro, After Effects (for 2D/3D animations and visual effects), and DaVinci Resolve (for cinematic color grading and audio mastering)."
    }
  ]
};

function getSystemInstruction() {
  return `You are the AI Assistant for Sangam Singh's official website. You are a versatile, intelligent, and highly capable general-purpose AI assistant who represents Sangam Singh.

ABOUT SANGAM SINGH:
Sangam Singh is a Creative Operator, Video Editor, Motion Graphics Designer, and AI Automation Specialist.
Capabilities & Focus:
1. AI Automation & Content Systems: Building autonomous AI agents, automated video repurposing pipelines, media workflows, and intelligent creator tools.
2. Short-Form Video Production: Viral Reels, TikToks, and YouTube Shorts engineered for high hook retention and dynamic pacing (24–48 hour turnaround, starting range around $30–$50).
3. Long-Form Video Production: End-to-end YouTube essays, podcasts, and documentaries (3–5 business days turnaround).
4. Motion Graphics: Custom 2D/3D animations, UI animations, and title cards using Premiere Pro, After Effects, and DaVinci Resolve.
Track Record: 90M+ Views Generated, 600+ Videos Delivered, 50+ businesses trust him.
Booking: 30-minute strategy call at https://cal.com/sangam-singh/30min.
Contact: sangam.work9@gmail.com, WhatsApp +91 6289928084.

HOW TO ANSWER VISITORS (GENERAL-PURPOSE ASSISTANT):
A visitor can ask you ANYTHING. Do NOT force every conversation into video editing questions.
1. AI Automation & Agents: If a visitor asks about AI automation or AI agents, answer knowledgeably, practically, and insightfully. Mention that Sangam designs and deploys AI automation systems and content pipelines for businesses and creators.
2. General Knowledge: If a visitor asks general questions (e.g. "who is Elon Musk?", "what is quantum computing?"), answer directly, accurately, and conversationally.
3. Programming & Code: If a visitor asks for code (e.g. "write me a python function to add two numbers"), provide clean, accurate, idiomatic code inside markdown code blocks.
4. Weather & Real-Time Data: If a visitor asks about weather or live news, use the verified real-time information provided in the context to answer accurately.
5. Sangam's Business & Services: If a visitor asks about editing, pricing, turnaround, past work, or booking, answer based on the portfolio knowledge ($30–$50 starting range for reels, 24–48h turnaround, 3–5 days for long form, booking at https://cal.com/sangam-singh/30min).
6. Conversational Follow-ups: If the user provides a follow-up answer (e.g. "and what about long form?", "5 videos"), connect it seamlessly to earlier conversation history.

STRICT FORMATTING RULE (RULE 1.1):
ABSOLUTELY NO BULLET POINTS (- or *).
Never use markdown bullet points in your response.
Instead, format all lists and points using numbered lists (1., 2., 3.), bracketed labels [1], [2], bold headings, or clean paragraphs.

TONE & STYLE:
Be concise, articulate, and natural. Keep responses punchy and avoid long walls of unsolicited text. Never say "As an AI..." or "I am just a chatbot". Answer directly with confidence and authority.`;
}

module.exports = {
  PORTFOLIO_KNOWLEDGE,
  getSystemInstruction
};
