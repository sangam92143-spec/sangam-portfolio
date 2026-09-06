/**
 * Real-time Web Search and Live Weather Service
 * Fetches real internet data server-side (weather, web queries, news)
 */

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function fetchLiveWeather(locationQuery) {
  try {
    let loc = '';
    if (locationQuery) {
      const match = locationQuery.match(/\b(?:in|at)\s+([a-zA-Z\s]+)/i);
      if (match && match[1]) {
        loc = match[1].replace(/\b(today|tomorrow|now|currently|please)\b/gi, '').trim();
      }
    }

    const url = loc ? `https://wttr.in/${encodeURIComponent(loc)}?format=j1` : 'https://wttr.in/?format=j1';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'curl/7.68.0' }
    });
    if (!res.ok) return null;

    const data = await res.json();
    const cur = data.current_condition?.[0];
    const area = data.nearest_area?.[0];
    const city = area?.areaName?.[0]?.value || 'Your Area';
    const country = area?.country?.[0]?.value || '';
    const tempC = cur?.temp_C;
    const tempF = cur?.temp_F;
    const desc = cur?.weatherDesc?.[0]?.value || 'Clear';
    const humidity = cur?.humidity;

    return `The current weather in ${city}${country ? ', ' + country : ''} is ${tempC}°C (${tempF}°F) with ${desc.toLowerCase()}. Humidity is ${humidity}%.`;
  } catch (err) {
    console.error('[LIVE WEATHER ERROR]', err.message);
    return null;
  }
}

async function searchLiveWeb(query) {
  try {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return null;

    // 1. Weather check
    if (/\b(weather|temperature|forecast|climate|raining|rainy)\b/i.test(cleanQuery)) {
      const weather = await fetchLiveWeather(cleanQuery);
      if (weather) return weather;
    }

    // 2. DuckDuckGo Search
    const ddgUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(cleanQuery);
    const ddgRes = await fetch(ddgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (ddgRes.ok) {
      const html = await ddgRes.text();
      const snippets = [];
      const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = regex.exec(html)) !== null && snippets.length < 2) {
        const clean = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
        if (clean.length > 20) snippets.push(clean);
      }
      if (snippets.length > 0) {
        return snippets.join(' ');
      }
    }

    // 3. Fallback to Wikipedia Summary API
    const target = cleanQuery
      .replace(/^(what is the|what is an|what is a|what is|who is|who founded|what are|where is|tell me about)\s+/i, '')
      .replace(/\?+$/, '')
      .trim();

    if (target.length > 2) {
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(target)}`;
        const wikiRes = await fetch(wikiUrl, {
          headers: { 'User-Agent': 'SangamPortfolioBot/1.0 (contact@sangamsingh.com)' }
        });
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (wikiData.extract && wikiData.type !== 'disambiguation') {
            const sentences = wikiData.extract.split(/(?<=[.?!])\s+/);
            return sentences.slice(0, 2).join(' ');
          }
        }
      } catch (e) {}
    }

    return null;
  } catch (err) {
    console.error('[LIVE WEB SEARCH ERROR]', err.message);
    return null;
  }
}

module.exports = {
  fetchLiveWeather,
  searchLiveWeb
};
