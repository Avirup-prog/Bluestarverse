# Bluestar — Poet Portfolio Website

A personal poetry portfolio with a built-in writing space, Hindi/English support, animations, and a password-protected admin area.

---

## Project Structure

```
bluestar/
├── index.html          ← Main website
├── css/
│   └── style.css       ← All styles + animations
└── js/
    ├── data.js         ← Sample works (edit this to change initial poems)
    └── app.js          ← All interactions, canvas, cursor, auth
```

---

## Before You Deploy

### 1. Change the password
Open `js/app.js` and find this line near the top:

```js
var SECRET_PASSWORD = "bluestar2024";
```

Change `"bluestar2024"` to any password she wants.

### 2. Edit the sample works (optional)
Open `js/data.js` to edit or remove the sample poems/stories. Each work looks like:

```js
{
  title: 'Poem Title',
  type: 'poem',        // 'poem', 'story', or 'blog'
  lang: 'en',          // 'en' or 'hi'
  date: 'March 2024',
  excerpt: 'First line or short excerpt...',
  content: `Full poem content here.
  
  Use backtick strings for multi-line content.`
}
```

### 3. Add a real photo (optional)
In `index.html`, find the About section's `<div class="about-img">` and replace the `✦` glyph with an `<img>` tag.

---

## Deploy to Vercel (Free) — Recommended

1. Create a free account at [vercel.com](https://vercel.com)
2. Install Vercel CLI:
   ```
   npm install -g vercel
   ```
3. Open your terminal inside the `bluestar/` folder and run:
   ```
   vercel
   ```
4. Follow the prompts — it will give you a live URL like `bluestar.vercel.app`

That's it! Every time you update the files and run `vercel` again, the site updates.

---

## Deploy to Netlify (Alternative)

1. Go to [netlify.com](https://netlify.com) and create a free account
2. Drag and drop the `bluestar/` folder into the Netlify dashboard
3. Done — you'll get a URL like `bluestar.netlify.app`

---

## Add a Custom Domain (Optional, ~₹800/year)

After deploying to Vercel or Netlify, you can connect a custom domain:
- Buy a domain from [Namecheap](https://namecheap.com), [GoDaddy](https://godaddy.com), or [Google Domains](https://domains.google)
- In Vercel/Netlify dashboard → Domains → Add domain
- Follow their DNS setup guide (takes ~10 minutes)

---

## Making Posts Permanent (Next Step)

Currently, when the page refreshes, new posts written from the Write page are lost (unless they're in data.js). To make posts save permanently, you'll need a database.

**Easiest free option: Supabase**
1. Create free account at [supabase.com](https://supabase.com)
2. Create a table called `works` with columns: title, type, lang, date, excerpt, content
3. Add the Supabase JS SDK and replace the `works` array with database calls

Let me know when you're ready for this step and I'll write the integration code!

---

## Features

- ✦ Animated starfield + nebula background
- ✦ Custom cursor with trail
- ✦ Loading screen animation
- ✦ Scroll-triggered reveal animations
- ✦ Interactive poem cards with full-content modal
- ✦ Hindi (Devanagari) + English support
- ✦ Password-protected writing space
- ✦ Live word count in editor
- ✦ Animated stats counter
- ✦ Animated publish/delete in admin
- ✦ Mobile responsive with hamburger menu
- ✦ Sticky nav with scroll effect
- ✦ Toast notifications
- ✦ Filter works by type or language
