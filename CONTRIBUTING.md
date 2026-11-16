Contributing to WattSpot

How Group 5 works in this repo. Every change goes through a pull request; nobody pushes to main.

The Git loop

Issue. Open a GitHub Issue for the task (a bug, a screen, a route). Assign yourself.

Branch. Start from an up-to-date main and name the branch g5/m-:

    git switch main
    git pull
    git switch -c g5/m4-checkout-validation

Commit. Small commits with clear messages that say what changed:

    git add 
    git commit -m "Validate email on checkout"

If AI helped, add a second line: -m "AI-assisted: Claude (what it helped with)".

    Push.

git push -u origin g5/m4-checkout-validation

Pull request. Title it [G5-M#] Short description, e.g. [G5-M4] Validate email on checkout. Fill in the PR template (what it does, how to test, checklist, AI assistance) and link the Issue (Closes #12).

Review. At least one teammate reviews and approves. Reviewers run it locally or on Render, leave comments, and request changes if something is wrong.

Merge. The Captain merges once it is approved. Delete the branch after merging.

Team rules

    1. No direct pushes to main. main is protected and needs one approving review.

    2. Never commit secrets. (.env) stays on your computer; share the database link privately, never in the repo or the group chat. Only .env.example (names, no values) is committed.

    3. Never commit node_modules/. Run npm install instead. .gitignore already excludes it.

    4. Don't run npm run seed -- --reset on the shared database: it deletes everyone's bookings.

    5. One feature per branch and PR, so reviews stay small and easy to follow.

    6. Pull before you branch so your work starts from the latest main.

    7. Edit only what your PR is about. If you need to change someone else's files, tell them first.

    8. Log meaningful AI use in AI-USAGE.md and on the PR's "AI assistance" line.

    9. Test before opening a PR: npm start, go through the flow you changed, and check the browser console for errors.

Branch and PR names
    Maverick Agbayani (M1): branches start with g5/m1-, PR titles with [G5-M1]

    Alysa Maxine Marquez (M3): branches start with g5/m3-, PR titles with [G5-M3]

    Althea Armendarez (M4): branches start with g5/m4-, PR titles with [G5-M4]

    Zaira Venice Farrales (M5): branches start with g5/m5-, PR titles with [G5-M5]