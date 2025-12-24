const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function sendOk(res, data) {
  res.json({ ok: true, data });
}

function sendError(res, status, code, message) {
  res.status(status).json({
    ok: false,
    error: { code, message }
  });
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = 12_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const message = typeof body === 'string'
        ? body
        : (body?.message || body?.error || 'Upstream request failed');
      const err = new Error(message);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    return body;
  } finally {
    clearTimeout(timeoutId);
  }
}

function pickFirstCountryMatch(countries, requestedName) {
  if (!Array.isArray(countries) || countries.length === 0) return null;

  const target = String(requestedName || '').trim().toLowerCase();
  const exact = countries.find(c => String(c?.name?.common || '').trim().toLowerCase() === target);
  return exact || countries[0];
}

function normalizeCountryData(country) {
  const countryName = country?.name?.common || 'Unknown';
  const capitalCity = Array.isArray(country?.capital) && country.capital[0] ? country.capital[0] : 'Unknown';
  const languages = country?.languages && typeof country.languages === 'object'
    ? Object.values(country.languages).filter(Boolean)
    : [];

  let currency = { code: 'Unknown', name: 'Unknown' };
  if (country?.currencies && typeof country.currencies === 'object') {
    const [code] = Object.keys(country.currencies);
    const c = code ? country.currencies[code] : null;
    currency = {
      code: code || 'Unknown',
      name: c?.name || 'Unknown'
    };
  }

  const flagUrl = country?.flags?.png || country?.flags?.svg || null;
  const flagEmoji = country?.flag || null;

  return { countryName, capitalCity, languages, currency, flagUrl, flagEmoji };
}

app.get('/api/random-user', async (req, res) => {
  try {
    const payload = await fetchJson('https://randomuser.me/api/');
    const user = Array.isArray(payload?.results) ? payload.results[0] : null;

    if (!user) {
      return sendError(res, 502, 'UPSTREAM_INVALID_RESPONSE', 'Random User API returned unexpected data.');
    }

    const data = {
      firstName: user?.name?.first || 'Unknown',
      lastName: user?.name?.last || 'Unknown',
      gender: user?.gender || 'Unknown',
      profilePictureUrl: user?.picture?.large || user?.picture?.medium || null,
      age: typeof user?.dob?.age === 'number' ? user.dob.age : null,
      dateOfBirth: user?.dob?.date || null,
      city: user?.location?.city || 'Unknown',
      country: user?.location?.country || 'Unknown',
      fullAddress: user?.location?.street
        ? `${user.location.street.name || ''} ${user.location.street.number || ''}`.trim() || 'Unknown'
        : 'Unknown'
    };

    return sendOk(res, data);
  } catch (err) {
    return sendError(res, 502, 'UPSTREAM_ERROR', err?.message || 'Failed to fetch random user.');
  }
});

app.get('/api/country/:countryName', async (req, res) => {
  const countryName = String(req.params.countryName || '').trim();
  if (!countryName) return sendError(res, 400, 'BAD_REQUEST', 'countryName is required.');

  try {
    const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}`;
    const payload = await fetchJson(url);

    const country = pickFirstCountryMatch(payload, countryName);
    const data = country ? normalizeCountryData(country) : normalizeCountryData(null);

    return sendOk(res, data);
  } catch (err) {
    const fallback = normalizeCountryData(null);
    return sendOk(res, {
      ...fallback,
      note: 'Country data is unavailable right now.'
    });
  }
});

app.get('/api/exchange/:currencyCode', async (req, res) => {
  const currencyCode = String(req.params.currencyCode || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return sendError(res, 400, 'BAD_REQUEST', 'currencyCode must be a 3-letter code (e.g. EUR).');
  }

  try {
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(currencyCode)}`;
    const payload = await fetchJson(url);

    const rates = payload?.rates;
    const usdRate = rates?.USD;
    const kztRate = rates?.KZT;

    if (typeof usdRate !== 'number' || typeof kztRate !== 'number') {
      return sendError(res, 502, 'UPSTREAM_INVALID_RESPONSE', 'Exchange rate API returned unexpected data.');
    }

    const data = {
      baseCurrency: currencyCode,
      usd: {
        code: 'USD',
        rate: usdRate,
        formatted: `1 ${currencyCode} = ${usdRate.toFixed(2)} USD`
      },
      kzt: {
        code: 'KZT',
        rate: kztRate,
        formatted: `1 ${currencyCode} = ${kztRate.toFixed(2)} KZT`
      }
    };

    return sendOk(res, data);
  } catch (err) {
    return sendError(res, 502, 'UPSTREAM_ERROR', err?.message || 'Failed to fetch exchange rates.');
  }
});

app.get('/api/news/:country', async (req, res) => {
  const country = String(req.params.country || '').trim();
  if (!country) return sendError(res, 400, 'BAD_REQUEST', 'country is required.');

  try {
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('format', 'json');
    url.searchParams.set('maxrecords', '100');
    url.searchParams.set('sort', 'datedesc');
    url.searchParams.set('timespan', '30d');
    url.searchParams.set('query', country);

    const payload = await fetchJson(url.toString());
    const articles = Array.isArray(payload?.articles) ? payload.articles : [];

    const normalize = (a) => ({
      title: a?.title || 'Untitled',
      imageUrl: a?.socialimage || null,
      description: a?.description || 'No description available.',
      url: a?.url || null
    });

    const countryLower = country.toLowerCase();
    const titleMatches = (a) => String(a?.title || '').toLowerCase().includes(countryLower);

    const english = articles
      .filter(a => titleMatches(a))
      .filter(a => !a?.language || String(a.language).toLowerCase() === 'english')
      .map(normalize)
      .filter(a => a.url);

    const anyLang = articles
      .filter(a => titleMatches(a))
      .map(normalize)
      .filter(a => a.url);

    const merged = [];
    for (const item of english) {
      if (merged.length >= 5) break;
      merged.push(item);
    }
    for (const item of anyLang) {
      if (merged.length >= 5) break;
      if (!merged.some(x => x.url === item.url)) merged.push(item);
    }

    const cleaned = merged.slice(0, 5);

    return sendOk(res, cleaned);
  } catch (err) {
    return sendError(res, 502, 'UPSTREAM_ERROR', err?.message || 'Failed to fetch news.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
