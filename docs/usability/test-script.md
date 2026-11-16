# Kamus usability test: moderator script

Purpose: find where learners get stuck. We test the app, not the person. About 25 minutes per participant.
Who: 5 participants per device class (phone, then laptop/tablet) is enough to find most problems; learners of Indonesian at any level.
Automated tests (tests/ui) already check sizes, contrast, keyboard paths and step counts. They cannot tell whether the app makes sense to a person: that is what this session is for.

## Before you start
- Device: the participant's own phone or laptop if possible. Open Kamus in a fresh browser profile (no cards, no history).
- Ask permission to take notes (and to record the screen, if you do). No names in the notes: use P1, P2, ...
- Have `notes-template.md` open, one copy per participant.

## Say this (read it out)
"Thanks for helping. I am testing this app, not you: there are no wrong answers. Please think aloud: say what you are looking for, what you expect, and what surprises you. I will mostly stay quiet and I cannot help during a task, but I will answer everything afterwards. You can stop at any time."

## Rules for the moderator
- Do not explain the interface, point, or name buttons. If asked "what does this do?", answer "what do you think it does?".
- Ask about what they did, not what they would do. Avoid leading questions ("was that easy?"); prefer "what happened there?".
- Give up on a task after about 3 minutes of being stuck; note it as a failure and move on.
- Note the first thing they tap in each task, every wrong turn, and their words.

## Tasks (read each one aloud, one at a time)
1. **Look up.** "You saw the word *rumah* in a text. Find out what it means in English, and listen to how it is pronounced."
   Success: finds an English meaning and plays audio. Budget: 1 minute.
2. **Make a flashcard.** "You want to remember this word. Save it as a flashcard."
   Success: a card exists (Anki page shows it). Budget: 2 minutes.
3. **Review.** "Practise the cards you have saved, until the app says you are done for now."
   Success: finishes a review session and can say what the four answer buttons mean. Budget: 3 minutes.
4. **Malay or Indonesian?** "A Malaysian friend says *kereta* means car. Find out what it means in Indonesian."
   Success: finds the comparison (Learn page) and states the difference. Budget: 3 minutes.
5. **Make it yours.** "Switch the app to dark mode. Then find out how you would put the app on your home screen (or install it)."
   Success: dark mode on; finds the install instructions or button. Budget: 3 minutes.

Optional (if time): "Find out how the word *membaca* is built from a simpler word."

## After the tasks
- Hand over the SUS questionnaire (`sus.md`) and let them fill it in alone.
- Then ask the questions in `feedback-form.md`.
- Thank them; answer anything you could not answer during the tasks.

## After each session
- Fill in severities in the notes while it is fresh.
- After all sessions: list problems seen by 2+ participants first; those become issues.
