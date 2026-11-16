# WattSpot — GC2 baseline
We took these numbers on the deployed site so we have something to compare our Final Project against. There's no target score here—just where things stand at GC2.

Althea Armendarez (M4) ran the tests on November 16, 2026 using Chrome 157.0.8103.52 (arm64, macOS) on Ateneo (ARSA-NET)Wi-Fi. Everything was measured on [https://wattspot-test.onrender.com](https://wattspot-test.onrender.com), focusing on the All Stations list screen (/app/directory.html) and its GET /api/stations route. All runs were done in an Incognito window with extensions off, cache disabled, network throttling off, and the server already warmed up since Render's free tier goes to sleep when idle.

## 1. Lighthouse (DevTools → Lighthouse → Navigation, Mobile)
Running Lighthouse on [https://wattspot-test.onrender.com/app/directory.html](https://wattspot-test.onrender.com/app/directory.html) gave us 100 for Performance, 98 for Accessibility, and 100 for Best Practices. First Contentful Paint, Largest Contentful Paint, and Speed Index all came in at 2.0 s, with 10 ms Total Blocking Time and 0 Cumulative Layout Shift.

Screenshots: [Analysis of Performance](<Baselinescreenshots/Analysis of Performance.png>), [Analysis of Performance (2)](<Baselinescreenshots/Analysis of Performance(1).png>)

## 2. First load of the List screen (DevTools → Network, All, cache disabled)
On a fresh uncached load, the page finished in 378 ms across 6 requests, transferring 8.6 kB (25.2 kB total resources). Those 6 requests were directory.html, styles.css, common.js, directory.js, GET /api/stations, and favicon.ico.

## 3. List route response time (GET /api/stations, Network tab, server warm)
With the server warm, GET /api/stations took 149 ms, 143 ms, and 145 ms across three runs (≈ 146 ms average).

Screenshots: [run 1](<Baselinescreenshots/List Route Response Time - 1.png>), [run 2](<Baselinescreenshots/List Route Response Time - 2.png>), [run 3](<Baselinescreenshots/List Route Response Time - 3.png>)

## 4. Known issues
First, cold starts on Render's free tier are slow. Render puts the server to sleep when nobody is using it, so the first person to open the site after a quiet stretch waits up to a minute. Since we woke the server up beforehand, our numbers above don't show that delay.

Second, a few pages fetch the same data more than once. The home page calls GET /api/stations twice on a single load, while the station page calls availability four times and stations twice, adding unnecessary work for the server and slowing down the page.

Third, we only tested on fast Wi-Fi, and accessibility isn't quite at 100. Because everything ran on Ateneo Wi-Fi without throttling, a driver on mobile data will see slower load times. Lighthouse also flagged Accessibility at 98 on the List screen, so we still have at least one issue left to fix there.
