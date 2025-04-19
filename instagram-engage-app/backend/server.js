// Load environment variables from .env if present
require('dotenv').config();

const express = require('express');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const headless = process.env.HEADLESS !== 'false'; // default true

app.use(cors());
app.use(bodyParser.json());

let browser;
let page;
let isEngaging = false;
let followedUsers = new Map(); // username -> follow timestamp

// Helper function to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Instagram login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    browser = await puppeteer.launch({ headless });
    page = await browser.newPage();
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

    // Accept cookies if prompted
    try {
      await page.waitForSelector('button[type="button"]', { timeout: 3000 });
      const buttons = await page.$$('button[type="button"]');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.toLowerCase().includes('accept')) {
          await btn.click();
          break;
        }
      }
    } catch (e) {
      // No cookie prompt
    }

    await page.waitForSelector('input[name="username"]', { visible: true });
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Check if login successful by checking presence of home icon or profile icon
    const loggedIn = await page.evaluate(() => {
      return !!document.querySelector('nav a[href="/accounts/activity/"]') || !!document.querySelector('nav a[href="/' + window._sharedData.config.viewer.username + '/"]');
    });

    if (!loggedIn) {
      await browser.close();
      return res.status(401).json({ error: 'Login failed. Check credentials.' });
    }

    res.json({ message: 'Login successful' });
  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({ error: error.message });
  }
});

// Start engagement route
app.post('/start', async (req, res) => {
  if (!page) {
    return res.status(400).json({ error: 'Not logged in' });
  }
  if (isEngaging) {
    return res.status(400).json({ error: 'Engagement already running' });
  }
  isEngaging = true;

  // Start engagement logic asynchronously
  engageUsers().catch(console.error);

  res.json({ message: 'Engagement started' });
});

// Stop engagement route
app.post('/stop', (req, res) => {
  if (!isEngaging) {
    return res.status(400).json({ error: 'Engagement not running' });
  }
  isEngaging = false;
  res.json({ message: 'Engagement stopped' });
});

// Status route
app.get('/status', (req, res) => {
  res.json({
    isEngaging,
    followedCount: followedUsers.size,
  });
});

// Helper function to check if user follows back
async function checkFollowsBack(username) {
  try {
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle2' });
    // Click on followers link
    const followersLink = await page.$('a[href$="/followers/"]');
    if (!followersLink) return false;
    await followersLink.click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
    // Check if logged in user is in followers list
    const followsBack = await page.evaluate((username) => {
      const followers = Array.from(document.querySelectorAll('div[role="dialog"] ul li'));
      return followers.some(follower => {
        const userLink = follower.querySelector('a');
        return userLink && userLink.textContent === username;
      });
    }, username);
    // Close dialog
    const closeButton = await page.$('div[role="dialog"] button.wpO6b');
    if (closeButton) await closeButton.click();
    return followsBack;
  } catch (e) {
    console.error('Error checking follows back:', e);
    return false;
  }
}

// Engagement logic
async function engageUsers() {
  while (isEngaging) {
    // Search for users from Piracicaba by hashtag or location
    // For demo, search by hashtag #piracicaba
    await page.goto('https://www.instagram.com/explore/tags/piracicaba/', { waitUntil: 'networkidle2' });

    // Get post links on the page
    const postLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('article a'));
      return anchors.map(a => a.href);
    });

    for (const postLink of postLinks) {
      if (!isEngaging) break;

      await page.goto(postLink, { waitUntil: 'networkidle2' });

      // Get username of post owner
      const username = await page.evaluate(() => {
        const el = document.querySelector('header a');
        return el ? el.textContent : null;
      });

      if (!username || followedUsers.has(username)) {
        continue;
      }

      // Follow user
      const followButton = await page.$('header button');
      if (followButton) {
        const btnText = await page.evaluate(el => el.textContent.toLowerCase(), followButton);
        if (btnText === 'follow') {
          await followButton.click();
          followedUsers.set(username, Date.now());
          console.log(`Followed ${username}`);

          // Like the post
          const likeButton = await page.$('section span button svg[aria-label="Like"]');
          if (likeButton) {
            await likeButton.click();
            console.log(`Liked post of ${username}`);
          }

          // Wait random delay between actions
          await delay(5000 + Math.random() * 5000);
        }
      }
    }

    // Unfollow users who didn't follow back after 24 hours
    const now = Date.now();
    for (const [user, followTime] of followedUsers.entries()) {
      if (now - followTime > 24 * 60 * 60 * 1000) {
        // Check if user follows back
        const followsBack = await checkFollowsBack(user);
        if (!followsBack) {
          // Go to user profile
          await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'networkidle2' });
          const unfollowButton = await page.$('header button');
          if (unfollowButton) {
            const btnText = await page.evaluate(el => el.textContent.toLowerCase(), unfollowButton);
            if (btnText === 'following') {
              await unfollowButton.click();
              // Confirm unfollow if prompted
              try {
                await page.waitForSelector('button.-Cab_', { timeout: 3000 });
                await page.click('button.-Cab_');
              } catch (e) {}
              followedUsers.delete(user);
              console.log(`Unfollowed ${user} after 24h no follow back`);
            }
          }
          await delay(3000 + Math.random() * 3000);
        }
      }
    }

    // Wait before next cycle
    await delay(60000);
  }
}

app.listen(port, () => {
  console.log(`Instagram engagement app listening at http://localhost:${port}`);
});
