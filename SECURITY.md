# Security policy

## Reporting a vulnerability
Please report security problems **privately**, not in a public issue:

1. On GitHub, open the **Security** tab of this repository and choose **Report a vulnerability** (private vulnerability reporting), or
2. contact the maintainer through the options on their GitHub profile: https://github.com/martin-awal

Include what you found, how to reproduce it, and what you think the impact is. This is a one-person hobby project: expect an answer within about a week and a fix when time allows.

## What is in scope
- The Kamus server (`server.py` and the Python modules): for example request handling, file serving, anything that lets one request read or write outside the intended files, or make the server fetch an address you control.
- The page and its scripts: cross-site scripting, unsafe handling of the sync config link or QR code, leaking cards or history.
- The optional Firebase sync: the shipped `firestore.rules`, and how the sign-in page behaves.

## Things to know
- Kamus is meant for **your own computer or your own tailnet/LAN**, with one trusted user. `--lan` serves it to everyone on the network without a login. Do not expose it to the open internet.
- Cards and history live in the browser. Anyone who can use your browser profile can read them. Back them up; they are not encrypted at rest.
- Firebase config values (apiKey, projectId) are not secrets by design; the Firestore security rules protect the data. If you change the rules, keep each user limited to `users/<their uid>/…`.
- KBBI and other third-party sources are fetched with the server's own network access, only when you choose them.
