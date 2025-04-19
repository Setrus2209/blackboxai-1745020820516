# Instagram Engagement Automation App

This project automates Instagram engagement actions such as login, following users by hashtag, liking posts, and unfollowing users who don't follow back after 24 hours. It consists of a backend server using Puppeteer and an Express API, and a frontend web UI to control the automation.

## Features

- Instagram login automation
- Follow users by hashtag (#piracicaba used as example)
- Like posts of followed users
- Unfollow users who don't follow back after 24 hours
- Start/stop engagement via frontend UI
- Status and logs display in frontend

## Technologies Used

- Node.js with Express
- Puppeteer for browser automation
- Tailwind CSS, Google Fonts, Font Awesome for frontend styling

## Setup and Installation

1. Clone the repository.

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory to configure environment variables (optional):

```
PORT=3000
HEADLESS=true
```

- `PORT`: Port for the backend server (default 3000)
- `HEADLESS`: Set to `false` to run Puppeteer with visible browser for debugging (default `true`)

4. Start the backend server:

```bash
npm start
```

5. Open `frontend/index.html` in a web browser.

## Usage

1. Enter your Instagram username and password in the login form and submit.

2. After successful login, use the dashboard to start or stop the engagement automation.

3. Monitor status and logs in the dashboard.

## Notes

- This app uses Puppeteer to automate Instagram actions and may be subject to Instagram's usage policies and rate limits.

- Use responsibly and at your own risk.

## License

ISC
