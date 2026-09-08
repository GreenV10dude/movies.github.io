// ===== Configuration =====
const TMDB_API_KEY = 'bbbb5a007088a76226b3f08a2e264e24'; // replace with your free key: https://www.themoviedb.org/settings/api
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const VIDKING_BASE_URL = 'https://www.vidking.net';

const PLAYER_CONFIG = {
  color: 'e50914',
  autoPlay: true,
  nextEpisode: true,
  episodeSelector: true,
};

// Top 5 global platforms (TMDB watch providers, US catalog by default)
const PLATFORMS = {
  netflix: { name: 'Netflix', provider: 8, color: '#E50914' },
  prime: { name: 'Prime Video', provider: 9, color: '#00A8E1' },
  disney: { name: 'Disney+', provider: 337, color: '#113CCF' },
  max: { name: 'Max', provider: 384, color: '#5822B4' },
  appletv: { name: 'Apple TV+', provider: 350, color: '#A3A3A3' },
};

const DEFAULT_REGION = 'US';
const VALID_REGIONS = ['US', 'GB', 'CA', 'AU', 'IN', 'DE', 'FR', 'JP', 'BR', 'MX', 'ES', 'IT', 'KR', 'NL', 'SE'];

// ===== State =====
let currentType = 'movie';
let currentPlatform = null;
let userRegion = DEFAULT_REGION;
let regionSource = 'default';
let currentShow = null;
let currentSeason = 1;
let totalSeasons = 1;
let currentContentId = null;

let heroSlides = [];
let currentHeroIndex = 0;
let heroInterval = null;

let videoStartTime = 0;

// ===== Cache =====
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

// ===== DOM references (cached after load) =====
let navItems, searchOverlay, searchInput, searchSuggestions, heroSlider, heroDots;
let featuredContent, popularContent, searchResults, searchContent, searchResultsCount;
let continueWatching, continueWatchingContent, detailsModal, detailsContent, playerModal;
let videoPlayer, loading, settingsModal, playerLoading, playerPoster, playerTitle;

function $(id) {
  return document.getElementById(id);
}

function initDOM() {
  navItems = document.querySelectorAll('.nav-item[data-type]');
  searchOverlay = $('searchOverlay');
  searchInput = $('searchInput');
  searchSuggestions = $('searchSuggestions');
  heroSlider = $('heroSlider');
  heroDots = $('heroDots');
  featuredContent = $('featuredContent');
  popularContent = $('popularContent');
  searchResults = $('searchResults');
  searchContent = $('searchContent');
  searchResultsCount = $('searchResultsCount');
  continueWatching = $('continueWatching');
  continueWatchingContent = $('continueWatchingContent');
  detailsModal = $('detailsModal');
  detailsContent = $('detailsContent');
  playerModal = $('playerModal');
  videoPlayer = $('videoPlayer');
  loading = $('loading');
  settingsModal = $('settingsModal');
  playerLoading = $('playerLoading');
  playerPoster = $('playerPoster');
  playerTitle = $('playerTitle');
}

// ===== Utilities =====
function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function showLoading(show) {
  loading.classList.toggle('hidden', !show);
}

// ===== TMDB fetch with cache =====
async function fetchTMDB(endpoint) {
  const cacheKey = endpoint;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  try {
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(`${TMDB_BASE_URL}${endpoint}${sep}api_key=${TMDB_API_KEY}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    apiCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    console.error('TMDB API Error:', err);
    return null;
  }
}

// ===== Title helpers =====
const titleOf = (item) => item.title || item.name || 'Untitled';
const yearOf = (item) => (item.release_date || item.first_air_date || '').slice(0, 4);
const ratingOf = (item) => (item.vote_average ? item.vote_average.toFixed(1) : 'N/A');
const posterOf = (item, size) =>
  item.poster_path
    ? `https://image.tmdb.org/t/p/${size || 'w500'}${item.poster_path}`
    : 'https://via.placeholder.com/500x750?text=No+Image';

function qualityBadge(item) {
  const popularity = item.popularity || 0;
  const rating = item.vote_average || 0;
  if (popularity > 50 && rating > 6) return '<span class="badge hd">HD</span>';
  return '<span class="badge hd">HD</span>';
}

// ===== Content loading =====
function refreshCurrentView() {
  if (currentPlatform && PLATFORMS[currentPlatform]) {
    loadPlatformContent(currentPlatform);
  } else {
    loadContent();
  }
}

async function loadContent() {
  currentPlatform = null;
  showLoading(true);
  searchResults.classList.add('hidden');
  continueWatching.classList.add('hidden');

  $('featuredTitle').textContent = 'Trending Now';
  $('popularTitle').textContent = 'Popular on FLIXHUB';

  const type = currentType;

  loadContinueWatching();

  let trendingPromise, popularPromise;
  if (type === 'anime') {
    trendingPromise = fetchTMDB('/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc');
    popularPromise = fetchTMDB('/discover/tv?with_genres=16&with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=100');
  } else {
    trendingPromise = fetchTMDB(`/trending/${type}/week`);
    popularPromise = fetchTMDB(`/${type}/popular`);
  }

  const [trending, popular] = await Promise.all([trendingPromise, popularPromise]);

  if (trending && trending.results) {
    renderContent(trending.results.slice(0, 12), featuredContent, type === 'anime' ? 'tv' : type);
  }
  if (popular && popular.results) {
    renderContent(popular.results.slice(0, 12), popularContent, type === 'anime' ? 'tv' : type);
  }

  showLoading(false);
}

async function loadGenreContent(genreId, genreName) {
  showLoading(true);
  searchResults.classList.add('hidden');
  continueWatching.classList.add('hidden');

  $('featuredTitle').textContent = `${genreName} — Movies`;
  $('popularTitle').textContent = `${genreName} — TV Shows`;

  const [movies, tv] = await Promise.all([
    fetchTMDB(`/discover/movie?with_genres=${genreId}&sort_by=popularity.desc`),
    fetchTMDB(`/discover/tv?with_genres=${genreId}&sort_by=popularity.desc`),
  ]);

  if (movies && movies.results) renderContent(movies.results.slice(0, 12), featuredContent, 'movie');
  if (tv && tv.results) renderContent(tv.results.slice(0, 12), popularContent, 'tv');

  showLoading(false);
}

async function loadPlatformContent(platformKey) {
  const platform = PLATFORMS[platformKey];
  if (!platform) return;
  currentPlatform = platformKey;
  showLoading(true);
  searchResults.classList.add('hidden');
  continueWatching.classList.add('hidden');

  $('featuredTitle').textContent = `${platform.name} — Movies (${userRegion})`;
  $('popularTitle').textContent = `${platform.name} — TV Shows (${userRegion})`;

  loadContinueWatching();

  const base = `with_watch_providers=${platform.provider}&watch_region=${encodeURIComponent(userRegion)}&with_watch_monetization_types=flatrate&sort_by=popularity.desc`;
  const [movies, tv] = await Promise.all([
    fetchTMDB(`/discover/movie?${base}`),
    fetchTMDB(`/discover/tv?${base}`),
  ]);

  if (movies && movies.results && movies.results.length) {
    renderContent(movies.results.slice(0, 12), featuredContent, 'movie');
  } else {
    featuredContent.innerHTML = '<p style="color:#b3b3b3;padding:20px 0">No movies found for this platform in your region.</p>';
  }
  if (tv && tv.results && tv.results.length) {
    renderContent(tv.results.slice(0, 12), popularContent, 'tv');
  } else {
    popularContent.innerHTML = '<p style="color:#b3b3b3;padding:20px 0">No TV shows found for this platform in your region.</p>';
  }

  showLoading(false);
}

function renderContent(items, container, forceType) {
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  items.forEach((item) => {
    if (!item.poster_path) return;
    frag.appendChild(createCard(item, forceType || item.media_type || currentType));
  });
  container.appendChild(frag);
}

function createCard(item, type) {
  const title = titleOf(item);
  const year = yearOf(item);
  const rating = ratingOf(item);

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <img class="card-image" src="${posterOf(item)}" alt="${title}" loading="lazy" />
    ${qualityBadge(item)}
    <div class="play-overlay">
      <svg width="24" height="24" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </div>
    <div class="card-overlay">
      <div class="card-title">${title}</div>
      <div class="card-meta">
        <span>${year || 'N/A'}</span>
        <span class="card-rating">★ ${rating}</span>
      </div>
    </div>
  `;

  if (type === 'movie') {
    const progress = getWatchProgress(`movie_${item.id}`);
    if (progress && progress.progress < 95) {
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      bar.innerHTML = `<div class="progress-fill" style="width:${progress.progress}%"></div>`;
      card.appendChild(bar);
    }
  }

  card.addEventListener('click', () => showDetails(item.id, type));
  return card;
}

// ===== Hero banner =====
async function loadHeroBanner() {
  const data = await fetchTMDB('/trending/movie/day');
  if (!data || !data.results) return;
  heroSlides = data.results.slice(0, 5);

  const withLogos = await Promise.all(
    heroSlides.map(async (movie) => {
      const images = await fetchTMDB(`/movie/${movie.id}/images?include_image_language=en,null`);
      movie.logoPath = images && images.logos && images.logos.length ? images.logos[0].file_path : null;
      return movie;
    })
  );
  heroSlides = withLogos;
  renderHeroSlides();
  startHeroAutoplay();
}

function renderHeroSlides() {
  heroSlider.innerHTML = heroSlides
    .map((movie, i) => {
      const backdrop = movie.backdrop_path
        ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
        : posterOf(movie, 'w1280');
      const year = yearOf(movie);
      const rating = ratingOf(movie);
      const titleHTML = movie.logoPath
        ? `<img class="hero-title-logo" src="https://image.tmdb.org/t/p/w500${movie.logoPath}" alt="${titleOf(movie)}" />`
        : `<h1 class="hero-title">${titleOf(movie)}</h1>`;
      return `
        <div class="hero-slide ${i === 0 ? 'active' : ''}" data-index="${i}">
          <div class="hero-background" style="background-image:url('${backdrop}')"></div>
          <div class="hero-content">
            <span class="hero-badge">Trending now</span>
            ${titleHTML}
            <div class="hero-meta">
              <span class="hero-rating">★ ${rating}</span>
              <span>${year || ''}</span>
              <span>Movie</span>
            </div>
            <p class="hero-overview">${movie.overview || 'No description available.'}</p>
            <div class="hero-actions">
              <button class="hero-btn hero-btn-play" data-play="${movie.id}" data-type="movie">▶ Play</button>
              <button class="hero-btn hero-btn-info" data-details="${movie.id}" data-type="movie">ⓘ More Info</button>
            </div>
          </div>
        </div>`;
    })
    .join('');

  heroDots.innerHTML = heroSlides
    .map((_, i) => `<button class="hero-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></button>`)
    .join('');

  heroSlider.querySelectorAll('[data-play]').forEach((btn) =>
    btn.addEventListener('click', () => playMovie(btn.dataset.play))
  );
  heroSlider.querySelectorAll('[data-details]').forEach((btn) =>
    btn.addEventListener('click', () => showDetails(btn.dataset.details, btn.dataset.type))
  );
  heroDots.querySelectorAll('.hero-dot').forEach((dot) =>
    dot.addEventListener('click', () => goToHeroSlide(parseInt(dot.dataset.index)))
  );
}

function goToHeroSlide(index) {
  heroSlider.querySelectorAll('.hero-slide').forEach((s) => s.classList.remove('active'));
  heroDots.querySelectorAll('.hero-dot').forEach((d) => d.classList.remove('active'));
  heroSlider.querySelector(`.hero-slide[data-index="${index}"]`)?.classList.add('active');
  heroDots.querySelector(`.hero-dot[data-index="${index}"]`)?.classList.add('active');
  currentHeroIndex = index;
}

function startHeroAutoplay() {
  if (heroInterval) clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    currentHeroIndex = (currentHeroIndex + 1) % heroSlides.length;
    goToHeroSlide(currentHeroIndex);
  }, 5000);
}

function stopHeroAutoplay() {
  if (heroInterval) clearInterval(heroInterval);
  heroInterval = null;
}

// ===== Search =====
const debouncedSuggestions = debounce(showSearchSuggestions, 300);

async function showSearchSuggestions() {
  const q = searchInput.value.trim();
  if (!q) {
    const trending = await fetchTMDB('/trending/all/day');
    if (trending && trending.results) {
      renderSearchCards(
        trending.results.filter((i) => i.media_type === 'movie' || i.media_type === 'tv').slice(0, 18)
      );
    }
    return;
  }
  const results = await fetchTMDB(`/search/multi?query=${encodeURIComponent(q)}`);
  if (results && results.results) {
    renderSearchCards(
      results.results.filter((i) => i.media_type === 'movie' || i.media_type === 'tv')
    );
  }
}

function renderSearchCards(items) {
  searchSuggestions.innerHTML = '';
  if (!items.length) {
    searchSuggestions.innerHTML = '<p style="color:#b3b3b3;grid-column:1/-1;text-align:center;padding:40px">No results found</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  items.forEach((item) => frag.appendChild(createCard(item, item.media_type)));
  searchSuggestions.appendChild(frag);
}

async function performSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  showLoading(true);
  searchOverlay.classList.remove('active');
  continueWatching.classList.add('hidden');
  searchResults.classList.remove('hidden');
  $('searchResultsTitle').textContent = `Search Results for "${q}"`;

  const results = await fetchTMDB(`/search/multi?query=${encodeURIComponent(q)}`);
  if (results && results.results) {
    const filtered = results.results.filter((i) => i.media_type === 'movie' || i.media_type === 'tv');
    searchResultsCount.textContent = `${filtered.length} results`;
    renderContent(filtered, searchContent, null);
    searchContent.style.display = 'grid';
    searchContent.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
    searchContent.style.overflowX = 'visible';
  }
  showLoading(false);
}

// ===== Details modal =====
async function showDetails(tmdbId, mediaType) {
  showLoading(true);
  try {
    const [details, credits] = await Promise.all([
      fetchTMDB(`/${mediaType}/${tmdbId}`),
      fetchTMDB(`/${mediaType}/${tmdbId}/credits`),
    ]);
    if (!details) return;

    const title = titleOf(details);
    const backdrop = details.backdrop_path
      ? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
      : posterOf(details);
    const poster = posterOf(details);
    const year = yearOf(details);
    const rating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
    const runtime = details.runtime || (details.episode_run_time && details.episode_run_time[0]) || null;
    const genres = details.genres || [];
    const overview = details.overview || 'No overview available.';
    const cast = credits.cast ? credits.cast.slice(0, 8) : [];

    detailsContent.innerHTML = `
      <div class="details-backdrop" style="background-image:url('${backdrop}')"></div>
      <div class="details-info">
        <div class="details-header">
          <img class="details-poster" src="${poster}" alt="${title}" />
          <div class="details-main">
            <h1 class="details-title">${title}</h1>
            <div class="details-meta">
              <span class="details-rating">★ ${rating}</span>
              <span>${year || 'N/A'}</span>
              ${runtime ? `<span>${runtime} min</span>` : ''}
              <span>${mediaType === 'movie' ? 'Movie' : 'TV Series'}</span>
            </div>
            <p class="details-overview">${overview}</p>
            <button class="btn-play" data-play="${tmdbId}" data-type="${mediaType}">▶ Play Now</button>
          </div>
        </div>
        ${genres.length ? `<div class="details-section"><h3>Genres</h3><div class="details-genres">${genres.map((g) => `<span class="genre-tag">${g.name}</span>`).join('')}</div></div>` : ''}
        ${cast.length ? `<div class="details-section"><h3>Cast</h3><div class="cast-grid">${cast
          .map(
            (m) => `
              <div class="cast-member">
                <img class="cast-photo" src="${m.profile_path ? `${TMDB_IMAGE_BASE}${m.profile_path}` : 'https://via.placeholder.com/120x150?text=No+Photo'}" alt="${m.name}" />
                <div class="cast-name">${m.name}</div>
                <div class="cast-character">${m.character || ''}</div>
              </div>`
          )
          .join('')}</div></div>` : ''}
      </div>
    `;

    detailsContent.querySelector('[data-play]').addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.play;
      const type = e.currentTarget.dataset.type;
      detailsModal.classList.remove('active');
      if (type === 'movie') playMovie(id);
      else fetchTMDB(`/tv/${id}`).then((d) => playTVShow(d));
    });

    detailsModal.classList.add('active');
  } catch (err) {
    console.error('Details error:', err);
  }
  showLoading(false);
}

// ===== Playback (VidKing) =====
function showPlayerLoading(content) {
  if (!content) return;
  playerPoster.src = posterOf(content, 'w500');
  playerTitle.textContent = titleOf(content);
  playerLoading.classList.remove('hidden');
}

function hidePlayerLoading() {
  playerLoading.classList.add('hidden');
}

async function playMovie(tmdbId) {
  currentContentId = `movie_${tmdbId}`;
  videoStartTime = Date.now();

  const details = await fetchTMDB(`/movie/${tmdbId}`);
  showPlayerLoading(details);

  const params = new URLSearchParams({ color: PLAYER_CONFIG.color, autoPlay: String(PLAYER_CONFIG.autoPlay) });
  const embedUrl = `${VIDKING_BASE_URL}/embed/movie/${tmdbId}?${params}`;

  videoPlayer.src = embedUrl;
  playerModal.classList.add('active');
  videoPlayer.onload = () => setTimeout(hidePlayerLoading, 1200);
}

async function playTVShow(show) {
  currentShow = show;
  const details = await fetchTMDB(`/tv/${show.id}`);
  if (details) {
    totalSeasons = details.number_of_seasons || 1;
    showPlayerLoading(details);
  }
  currentSeason = 1;
  playEpisode(show.id, 1, 1);
}

function playEpisode(tmdbId, season, episode) {
  currentContentId = `tv_${tmdbId}_s${season}e${episode}`;
  videoStartTime = Date.now();

  const params = new URLSearchParams({
    color: PLAYER_CONFIG.color,
    autoPlay: String(PLAYER_CONFIG.autoPlay),
    nextEpisode: String(PLAYER_CONFIG.nextEpisode),
    episodeSelector: String(PLAYER_CONFIG.episodeSelector),
  });

  const embedUrl = `${VIDKING_BASE_URL}/embed/tv/${tmdbId}/${season}/${episode}?${params}`;

  videoPlayer.src = embedUrl;
  playerModal.classList.add('active');
  videoPlayer.onload = () => setTimeout(hidePlayerLoading, 1200);
}

function closePlayerModal() {
  playerModal.classList.remove('active');
  videoPlayer.src = '';
  hidePlayerLoading();
  setTimeout(loadContinueWatching, 1500);
}

// ===== Progress tracking (localStorage) =====
function getWatchProgress(id) {
  try {
    const all = JSON.parse(localStorage.getItem('flixhub_progress') || '{}');
    return all[id] || null;
  } catch {
    return null;
  }
}

function saveWatchProgress(id, data) {
  try {
    const all = JSON.parse(localStorage.getItem('flixhub_progress') || '{}');
    all[id] = data;
    localStorage.setItem('flixhub_progress', JSON.stringify(all));
  } catch {}
}

function loadContinueWatching() {
  try {
    const all = JSON.parse(localStorage.getItem('flixhub_progress') || '{}');
    const entries = Object.values(all)
      .sort((a, b) => (b.updated || 0) - (a.updated || 0))
      .slice(0, 6);

    if (!entries.length) {
      continueWatching.classList.add('hidden');
      return;
    }

    continueWatching.classList.remove('hidden');
    continueWatchingContent.innerHTML = '';

    entries.forEach((data) => {
      if (data.progress >= 95) return;
      fetchTMDB(`/${data.type}/${data.id}`).then((details) => {
        if (!details) return;
        continueWatchingContent.appendChild(createCard(details, data.type));
      });
    });
  } catch {}
}

function setupProgressTracking() {
  setInterval(() => {
    if (currentContentId && playerModal.classList.contains('active')) saveCurrentProgress();
  }, 5000);
}

function saveCurrentProgress() {
  if (!currentContentId) return;
  const isTv = currentContentId.startsWith('tv_');
  const id = currentContentId.replace(/^movie_|^tv_/, '').split('_')[0];
  saveWatchProgress(currentContentId, {
    id,
    type: isTv ? 'tv' : 'movie',
    progress: 0,
    updated: Date.now(),
  });
}

// ===== Settings =====
function saveSettings() {
  try {
    localStorage.setItem('flixhub_settings', JSON.stringify(PLAYER_CONFIG));
  } catch {}
}

function normalizeColor(color) {
  return String(color || '').replace('#', '').toLowerCase();
}

function applyAccentColor() {
  const hex = `#${normalizeColor(PLAYER_CONFIG.color)}`;
  document.documentElement.style.setProperty('--netflix-red', hex);
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('flixhub_settings') || '{}');
    Object.assign(PLAYER_CONFIG, s);
  } catch {}
  PLAYER_CONFIG.color = normalizeColor(PLAYER_CONFIG.color) || 'e50914';
  applyAccentColor();
  document.querySelectorAll('.color-btn').forEach((b) => b.classList.toggle('active', normalizeColor(b.dataset.color) === PLAYER_CONFIG.color));
  $('autoPlayToggle').checked = PLAYER_CONFIG.autoPlay;
  $('nextEpisodeToggle').checked = PLAYER_CONFIG.nextEpisode;
  $('episodeSelectorToggle').checked = PLAYER_CONFIG.episodeSelector;
  loadRegionState();
}

// ===== Region + consent (client-side only, no IP stored) =====
function getConsent() {
  try {
    return localStorage.getItem('flixhub_consent');
  } catch {
    return null;
  }
}

function setConsent(value) {
  try {
    localStorage.setItem('flixhub_consent', value);
    localStorage.setItem('flixhub_consent_at', String(Date.now()));
  } catch {}
}

function updateRegionNote() {
  const note = $('regionNote');
  if (note) note.textContent = `Catalog region: ${userRegion} · ${regionSource === 'ip' ? 'auto-detected' : regionSource}`;
  const select = $('regionSelect');
  if (select && VALID_REGIONS.includes(userRegion)) select.value = userRegion;
}

function loadRegionState() {
  try {
    const saved = JSON.parse(localStorage.getItem('flixhub_region') || 'null');
    if (saved && typeof saved.code === 'string' && VALID_REGIONS.includes(saved.code.toUpperCase())) {
      userRegion = saved.code.toUpperCase();
      regionSource = saved.source === 'manual' ? 'manual' : 'ip';
    }
  } catch {}
  updateRegionNote();
}

function applyRegion(code, source) {
  const upper = String(code || '').toUpperCase();
  if (!VALID_REGIONS.includes(upper)) return;
  userRegion = upper;
  regionSource = source;
  try {
    localStorage.setItem('flixhub_region', JSON.stringify({ code: upper, source, at: Date.now() }));
  } catch {}
  updateRegionNote();
  refreshCurrentView();
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms || 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function detectRegionByIP() {
  // Primary: ipwho.is (free, no key, CORS-enabled). Fallback: ipapi.co. Never throws.
  try {
    const res = await fetchWithTimeout('https://ipwho.is/', 5000);
    if (res && res.ok) {
      const data = await res.json();
      const code = data && data.success !== false && data.country_code ? String(data.country_code).toUpperCase() : '';
      if (VALID_REGIONS.includes(code)) {
        applyRegion(code, 'ip');
        return code;
      }
    }
  } catch {}
  try {
    const res = await fetchWithTimeout('https://ipapi.co/country/', 5000);
    if (res && res.ok) {
      const text = (await res.text()).trim().toUpperCase();
      if (VALID_REGIONS.includes(text)) {
        applyRegion(text, 'ip');
        return text;
      }
    }
  } catch {}
  updateRegionNote();
  return null;
}

function initConsent() {
  const banner = $('consentBanner');
  const legalModal = $('legalModal');
  if (!banner) return;
  const consent = getConsent();
  if (!consent) banner.classList.remove('hidden');

  $('consentAllow')?.addEventListener('click', async () => {
    setConsent('granted');
    banner.classList.add('hidden');
    const btn = $('consentAllow');
    if (btn) btn.textContent = 'Detecting…';
    await detectRegionByIP();
    if (btn) btn.textContent = 'Allow region detection';
  });
  $('consentDecline')?.addEventListener('click', () => {
    setConsent('declined');
    banner.classList.add('hidden');
    // Stay on US defaults (or previously saved manual region), no IP lookup.
    updateRegionNote();
  });
  $('consentMore')?.addEventListener('click', () => legalModal?.classList.add('active'));
  $('closeLegal')?.addEventListener('click', () => legalModal?.classList.remove('active'));
  legalModal?.addEventListener('click', (e) => {
    if (e.target === legalModal) legalModal.classList.remove('active');
  });
}

// ===== Event listeners =====
function setupEvents() {
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      navItems.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('[data-platform]').forEach((b) => b.classList.remove('active'));
      item.classList.add('active');
      currentType = item.dataset.type;
      loadContent();
    });
  });

  document.querySelectorAll('[data-genre]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.textContent;
      document.querySelectorAll('.dropdown').forEach((d) => d.classList.remove('open'));
      navItems.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('[data-platform]').forEach((b) => b.classList.remove('active'));
      loadGenreContent(btn.dataset.genre, name);
    });
  });

  document.querySelectorAll('[data-platform]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dropdown').forEach((d) => d.classList.remove('open'));
      navItems.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('[data-platform]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadPlatformContent(btn.dataset.platform);
    });
  });

  const browseBtn = $('browseBtn');
  browseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = browseBtn.closest('.dropdown');
    const wasOpen = dropdown.classList.contains('open');
    document.querySelectorAll('.dropdown').forEach((d) => d.classList.remove('open'));
    if (!wasOpen) dropdown.classList.add('open');
  });
  const platformsBtn = $('platformsBtn');
  platformsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = platformsBtn.closest('.dropdown');
    const wasOpen = dropdown.classList.contains('open');
    document.querySelectorAll('.dropdown').forEach((d) => d.classList.remove('open'));
    if (!wasOpen) dropdown.classList.add('open');
  });
  document.addEventListener('click', () => document.querySelectorAll('.dropdown').forEach((d) => d.classList.remove('open')));

  $('homeLink').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('[data-platform]').forEach((b) => b.classList.remove('active'));
    searchResults.classList.add('hidden');
    loadContent();
  });

  $('searchToggle').addEventListener('click', () => {
    searchOverlay.classList.add('active');
    searchInput.focus();
    showSearchSuggestions();
  });

  $('closeSearch').addEventListener('click', () => searchOverlay.classList.remove('active'));
  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) searchOverlay.classList.remove('active');
  });
  searchInput.addEventListener('input', debouncedSuggestions);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  $('settingsBtn').addEventListener('click', () => {
    loadSettings();
    settingsModal.classList.add('active');
  });
  $('closeSettings').addEventListener('click', () => settingsModal.classList.remove('active'));

  document.querySelectorAll('.color-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      PLAYER_CONFIG.color = normalizeColor(btn.dataset.color);
      applyAccentColor();
      saveSettings();
    });
  });

  $('autoPlayToggle').addEventListener('change', (e) => {
    PLAYER_CONFIG.autoPlay = e.target.checked;
    saveSettings();
  });
  $('nextEpisodeToggle').addEventListener('change', (e) => {
    PLAYER_CONFIG.nextEpisode = e.target.checked;
    saveSettings();
  });
  $('episodeSelectorToggle').addEventListener('change', (e) => {
    PLAYER_CONFIG.episodeSelector = e.target.checked;
    saveSettings();
  });

  $('clearProgressBtn').addEventListener('click', () => {
    localStorage.removeItem('flixhub_progress');
    loadContinueWatching();
    settingsModal.classList.remove('active');
  });

  $('regionSelect')?.addEventListener('change', (e) => {
    applyRegion(e.target.value, 'manual');
  });

  $('closePlayer').addEventListener('click', closePlayerModal);
  $('closeDetails').addEventListener('click', () => detailsModal.classList.remove('active'));

  detailsModal.addEventListener('click', (e) => {
    if (e.target === detailsModal) detailsModal.classList.remove('active');
  });
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
  });

  playerModal.addEventListener('click', (e) => {
    if (e.target === playerModal) closePlayerModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchOverlay.classList.remove('active');
      detailsModal.classList.remove('active');
      settingsModal.classList.remove('active');
      $('legalModal')?.classList.remove('active');
      closePlayerModal();
    }
  });

  window.addEventListener('scroll', () => {
    $('navbar').classList.toggle('scrolled', window.scrollY > 20);
  });

  const hero = $('hero');
  hero.addEventListener('mouseenter', stopHeroAutoplay);
  hero.addEventListener('mouseleave', startHeroAutoplay);
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initDOM();
  setupEvents();
  loadSettings();
  initConsent();
  setupProgressTracking();
  loadHeroBanner();
  loadContent();
});