# AI usage

| Date | Member | Tool | What we asked for | What we kept or changed | How we checked it |
|---|---|---|---|---|---|
| Nov 4, 2026 | M4 Althea | Claude | A framework for how to approach the mock-up | N/A | N/A |
| Nov 5, 2026 | M4 Althea | Claude | Restructuring and debugging the checkout, shop and owner pages | TODO | TODO |
| Nov 14, 2026 | M4 Althea | Claude | Restructuring and debugging the MySQL backend, keeping our routes and field names | Kept the `server/` folder. Left out the database files (Mav's part) | Had each backend file explained line by line and added comments |
| Nov 14, 2026 | M4 Althea | Claude | Fixing errors in the existing front-end pages | Not committed, since the pages belong to their owners. Shared the fixes with the team | Compared the pages before and after |
| Nov 15, 2026 | M4 Althea | Claude | Comments for every backend file, a note for Mav on the tables the backend expects, a Postman collection | Kept the comments and the note (`server/README.md`) | Reviewed each comment against the code |
| Nov 15, 2026 | M4 Althea | Claude | Help with Git: cloning, committing only my files, opening the PR | Removed `.DS_Store` and restored `checkout/owner.js`, which I wasn't supposed to change | Checked `git status` and `git diff --cached` before committing |
| Nov 15, 2026 | M1 Mav | Claude Code | Switching the backend from MySQL to MongoDB and building the routes from `docs/plan.md` | Kept the models, routes and one-transaction booking. Overruled the first slot-taken check, which returned 500 instead of 409 | Postman tests, including 5 bookings for the same slot at once |
| Nov 15, 2026 | M1 Mav | Claude Code | Connecting Max's pages to the API and checking the flow for bugs | Kept the fixes. Removed `auth.js`, which saved passwords in the browser | Clicked through every page at phone width and double-clicked "Pay securely" |
| Nov 16, 2026 | M1 Mav | Claude Code | Postman collection for Challenge 1, route table, schema and challenge write-ups | Rewrote the write-ups in our own simpler words | Ran the collection and took screenshots; compared the docs to the code |
