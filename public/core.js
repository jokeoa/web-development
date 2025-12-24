const els = {
  loadBtn: () => document.getElementById('loadBtn'),
  status: () => document.getElementById('status'),
  userCard: () => document.getElementById('userCard'),
  countryCard: () => document.getElementById('countryCard'),
  exchangeCard: () => document.getElementById('exchangeCard'),
  newsCard: () => document.getElementById('newsCard')
};

function setStatus(message, type = 'info') {
  const el = els.status();
  if (!el) return;
  el.textContent = message || '';
  el.dataset.type = type;
}

function clearStatus() {
  setStatus('', 'info');
}

function setMuted(el, muted) {
  if (!el) return;
  el.classList.toggle('muted', Boolean(muted));
}

function setCard(el, nodeOrText) {
  if (!el) return;
  el.replaceChildren();
  if (typeof nodeOrText === 'string') {
    el.textContent = nodeOrText;
  } else if (nodeOrText instanceof Node) {
    el.appendChild(nodeOrText);
  }
}

function createKeyValueList(rows) {
  const dl = document.createElement('dl');
  dl.className = 'kv';

  for (const { label, value } of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;

    const dd = document.createElement('dd');
    dd.textContent = value ?? '—';

    dl.append(dt, dd);
  }

  return dl;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

async function apiGet(endpoint) {
  const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  const payload = await res.json().catch(() => null);

  if (!payload || typeof payload !== 'object') {
    throw new Error('Server returned an invalid response.');
  }

  if (payload.ok) return payload.data;

  const message = payload?.error?.message || 'Request failed.';
  const err = new Error(message);
  err.code = payload?.error?.code;
  err.status = res.status;
  throw err;
}

function renderUser(user) {
  const wrap = document.createElement('div');
  wrap.className = 'profile';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'avatarWrap';

  if (user.profilePictureUrl) {
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = user.profilePictureUrl;
    img.alt = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Profile picture';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      img.remove();
      avatarWrap.appendChild(createImagePlaceholder('No image'));
    });
    avatarWrap.appendChild(img);
  } else {
    avatarWrap.appendChild(createImagePlaceholder('No image'));
  }

  const meta = document.createElement('div');
  meta.className = 'profileMeta';

  const title = document.createElement('div');
  title.className = 'profileTitle';
  title.textContent = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();

  const rows = [
    { label: 'Gender', value: user.gender || 'Unknown' },
    { label: 'Age', value: typeof user.age === 'number' ? String(user.age) : '—' },
    { label: 'Date of birth', value: formatDate(user.dateOfBirth) },
    { label: 'City', value: user.city || 'Unknown' },
    { label: 'Country', value: user.country || 'Unknown' },
    { label: 'Full address', value: user.fullAddress || 'Unknown' }
  ];

  meta.append(title, createKeyValueList(rows));
  wrap.append(avatarWrap, meta);
  return wrap;
}

function createImagePlaceholder(text) {
  const ph = document.createElement('div');
  ph.className = 'imgPlaceholder';
  ph.textContent = text;
  return ph;
}

function renderCountry(country) {
  const wrap = document.createElement('div');
  wrap.className = 'country';

  const header = document.createElement('div');
  header.className = 'countryHeader';

  const flagBox = document.createElement('div');
  flagBox.className = 'flagBox';

  if (country.flagUrl) {
    const img = document.createElement('img');
    img.className = 'flag';
    img.src = country.flagUrl;
    img.alt = `${country.countryName || 'Country'} flag`;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      img.remove();
      flagBox.appendChild(createImagePlaceholder(country.flagEmoji || 'No flag'));
    });
    flagBox.appendChild(img);
  } else {
    flagBox.appendChild(createImagePlaceholder(country.flagEmoji || 'No flag'));
  }

  const h = document.createElement('div');
  h.className = 'countryTitle';
  h.textContent = country.countryName || 'Unknown';

  header.append(flagBox, h);

  const rows = [
    { label: 'Capital', value: country.capitalCity || 'Unknown' },
    { label: 'Languages', value: Array.isArray(country.languages) && country.languages.length ? country.languages.join(', ') : 'Unknown' },
    {
      label: 'Currency',
      value: country.currency
        ? `${country.currency.code || 'Unknown'}${country.currency.name ? ` — ${country.currency.name}` : ''}`
        : 'Unknown'
    }
  ];

  wrap.append(header, createKeyValueList(rows));
  return wrap;
}

function renderExchange(exchange) {
  const wrap = document.createElement('div');
  wrap.className = 'exchange';

  const rows = [];
  if (exchange?.usd?.formatted) rows.push({ label: 'USD', value: exchange.usd.formatted });
  if (exchange?.kzt?.formatted) rows.push({ label: 'KZT', value: exchange.kzt.formatted });

  if (!rows.length) {
    wrap.textContent = 'Exchange rates are unavailable.';
    return wrap;
  }

  wrap.appendChild(createKeyValueList(rows));
  return wrap;
}

function renderNews(newsItems, countryName) {
  if (!Array.isArray(newsItems) || newsItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = countryName
      ? `No recent news found containing “${countryName}” in the headline.`
      : 'No news to display.';
    return empty;
  }

  const grid = document.createElement('div');
  grid.className = 'newsGrid';

  for (const item of newsItems) {
    const card = document.createElement('article');
    card.className = 'newsItem';

    const media = document.createElement('div');
    media.className = 'newsMedia';

    if (item.imageUrl) {
      const img = document.createElement('img');
      img.className = 'newsImg';
      img.src = item.imageUrl;
      img.alt = item.title || 'News image';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => {
        img.remove();
        media.appendChild(createImagePlaceholder('No image'));
      });
      media.appendChild(img);
    } else {
      media.appendChild(createImagePlaceholder('No image'));
    }

    const body = document.createElement('div');
    body.className = 'newsBody';

    const title = document.createElement('h3');
    title.className = 'newsTitle';
    title.textContent = item.title || 'Untitled';

    const desc = document.createElement('p');
    desc.className = 'newsDesc';
    desc.textContent = item.description || 'No description available.';

    const link = document.createElement('a');
    link.className = 'newsLink';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Read more';

    body.append(title, desc, link);
    card.append(media, body);
    grid.appendChild(card);
  }

  return grid;
}

function setLoadingState(isLoading) {
  const btn = els.loadBtn();
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Loading…' : 'Get random user';
}

async function loadEverything() {
  clearStatus();
  setLoadingState(true);

  const userEl = els.userCard();
  const countryEl = els.countryCard();
  const exchangeEl = els.exchangeCard();
  const newsEl = els.newsCard();

  setMuted(userEl, true);
  setMuted(countryEl, true);
  setMuted(exchangeEl, true);
  setMuted(newsEl, true);
  setCard(userEl, 'Loading user…');
  setCard(countryEl, 'Loading country…');
  setCard(exchangeEl, 'Loading exchange rates…');
  setCard(newsEl, 'Loading news…');

  try {
    const user = await apiGet('/api/random-user');
    setMuted(userEl, false);
    setCard(userEl, renderUser(user));

    const country = await apiGet(`/api/country/${encodeURIComponent(user.country || '')}`);
    setMuted(countryEl, false);
    setCard(countryEl, renderCountry(country));

    const currencyCode = country?.currency?.code && country.currency.code !== 'Unknown'
      ? country.currency.code
      : '';

    if (currencyCode) {
      try {
        const exchange = await apiGet(`/api/exchange/${encodeURIComponent(currencyCode)}`);
        setMuted(exchangeEl, false);
        setCard(exchangeEl, renderExchange(exchange));
      } catch (err) {
        setMuted(exchangeEl, false);
        setCard(exchangeEl, err?.message || 'Exchange rates are unavailable.');
      }
    } else {
      setMuted(exchangeEl, false);
      setCard(exchangeEl, 'Currency is unavailable for this country.');
    }

    try {
      const news = await apiGet(`/api/news/${encodeURIComponent(user.country || '')}`);
      setMuted(newsEl, false);
      setCard(newsEl, renderNews(news, user.country));
    } catch (err) {
      setMuted(newsEl, false);
      setCard(newsEl, err?.message || 'News are unavailable.');
    }
  } catch (err) {
    setStatus(err?.message || 'Something went wrong.', 'error');
  } finally {
    setLoadingState(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = els.loadBtn();
  if (!btn) return;
  btn.addEventListener('click', () => {
    void loadEverything();
  });
});
