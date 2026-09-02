# FLIXHUB - Netflix Clone

A free, open-source Netflix clone website for watching movies and TV shows without paywalls or accounts.

## Features

- **Browse movies and TV shows** by category, genre, and trending status
- **Search functionality** with live suggestions from TMDB API
- **Continue watching** progress saved to localStorage
- **Player settings** (accent color, autoplay, episode selector)
- **Responsive design** works mobile and desktop
- **No paywall or account required** - just open and watch

## Tech Stack

- **HTML5** - Semantic structure
- **CSS3** - Custom design with Netflix-inspired dark theme
- **JavaScript** - Fetch API with TMDB and VidKing integration
- **localStorage** - Persistent watch progress tracking
- **TMDB API** - The Movie Database for content data
- **VidKing** - Video embedding service

## Project Structure

```
netflix-clone/
├── index.html      # Main HTML structure
├── app.js          # Core JavaScript logic
└── styles.css      # All styling and responsive design
```

## Setup & Running

1. **Get a TMDB API key** (free):
   - Go to https://www.themoviedb.org/settings/api
   - Sign up for an account
   - Create a new API key
   - Replace the `TMDB_API_KEY` constant in `app.js` with your key

2. **Open `index.html`** in any modern browser
   - No build step required
   - No local server needed (CORS allows direct file access for TMDB)

3. **Features available immediately**:
   - Browse trending movies/TV shows
   - Search titles and genres
   - Watch videos via VidKing embed
   - Save watch progress locally

## Configuration

### Player Settings (accessible via ⚙️ Settings)

- **Accent color**: Change the UI accent color (default Netflix red: `#e50914`)
- **Autoplay**: Auto-play next episode/episode
- **Episode selector**: Enable episode selection for TV shows
- **Next episode button**: Show next episode button

### API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `/trending/movie/day` | Trending movies hero banner |
| `/trending/${type}/week` | Weekly trending content |
| `/${type}/popular` | Popular movies/TV shows |
| `/discover/movie` | Movie discovery by genre |
| `/discover/tv` | TV show discovery by genre |
| `/search/multi` | Search across movies/TV |
| `/movie/${id}/images` | Get movie logos/banners |
| `/${id}` | Movie/TV show details |
| `/${id}/credits` | Cast and crew credits |

## How It Works

1. **Data fetching**: JavaScript fetches movie/TV data from TMDB API
2. **Content rendering**: Movies/TV shows rendered as cards with posters, titles, years, and ratings
3. **Video playback**: Videos embedded via VidKing service with configurable player settings
4. **Progress tracking**: Watch progress saved to browser localStorage (no account needed)
5. **Settings persisted**: Player settings (color, autoplay, etc.) saved to localStorage

## Notes

- This project uses **free TMDB API** - sign up at themoviedb.org
- Video playback uses **VidKing** embed service
- All watch progress is stored locally in the browser - clearing browser data will reset progress
- Designed for educational purposes - footer credits TMDB and VidKing
- No user accounts or authentication - completely anonymous usage

## Credits

- Data provided by [The Movie Database (TMDB)](https://www.themoviedb.org/)
- Video streaming via [VidKing](https://www.vidking.net)
- Designed as a clone for educational purposes