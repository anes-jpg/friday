// bench/voice-check.mjs — CI Voice Persona & Persona Compliance Linter (§05 The Emotion Engine)
import { exit } from "node:process";

const BANNED = [
  "certainly",
  "happy to",
  "great question",
  "as an ai",
  "let me know if",
  "apologi",
  "absolutely!",
  "i hope this helps",
];

// Golden suite of 40 representative spoken lines from FRIDAY's two-channel output
const TEST_SUITE = [
  "On it.",
  "Done.",
  "That failed on the type check.",
  "Which window should I summarize?",
  "I'll move fourteen screenshots into Assets. Go ahead?",
  "Cancelled.",
  "Nothing to report on the standup today.",
  "Say that again?",
  "Still working on the index.",
  "Opened the design plan.",
  "Remembered that Kwame prefers Slack over WhatsApp.",
  "Based on your memory, desktop screenshots are archived into Assets.",
  "That build failed on the type check, not the tests.",
  "I found three matching files in your project directory.",
  "Here is the diff preview on screen.",
  "Running the allowlisted test suite now.",
  "All tests passed in three hundred milliseconds.",
  "Clipboard content updated.",
  "Active window is Visual Studio Code.",
  "Your daily standup summary is ready on screen.",
  "I need explicit confirmation to delete that folder.",
  "No actions available to undo.",
  "Successfully reverted the file rename.",
  "Transcribed.",
  "Daily Standup Digest executed cleanly.",
  "Notion task sync completed.",
  "Desktop cleaner archived twelve items.",
  "Two files were modified.",
  "Focus block started for forty-five minutes.",
  "Audio playback stopped.",
  "The requested skill is currently disabled in Settings.",
  "Skill enabled.",
  "Automations are currently paused.",
  "Microphone capture active.",
  "Ready.",
  "Your current daily spend is forty-two cents.",
  "Connected to the local SQLite vault.",
  "No unread priority emails.",
  "Meeting scheduled for nine thirty tomorrow.",
  "Here's what changed."
];

let failures = 0;

console.log("==========================================================");
console.log(" FRIDAY CI Voice Persona Compliance Test Suite (§05)     ");
console.log("==========================================================");
console.log(`Checking ${TEST_SUITE.length} spoken candidate utterances...\n`);

function countSentences(text) {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  return matches ? matches.length : 1;
}

for (let i = 0; i < TEST_SUITE.length; i++) {
  const line = TEST_SUITE[i];
  const lower = line.toLowerCase();
  const errors = [];

  // 1. Banned phrase check
  for (const banned of BANNED) {
    if (lower.includes(banned)) {
      errors.push(`Contains banned phrase "${banned}"`);
    }
  }

  // 2. Emoji check
  if (/\p{Extended_Pictographic}/u.test(line)) {
    errors.push("Contains emoji");
  }

  // 3. Markdown residue check (backticks, headers, bold, bullet)
  if (/[#*_`~[\]]/.test(line)) {
    errors.push("Contains markdown formatting characters");
  }

  // 4. Raw URLs or paths
  if (/https?:\/\/|[\\/]/.test(line)) {
    errors.push("Contains raw URL or file path delimiter");
  }

  // 5. Two-channel output constraint: maximum 2 sentences
  const sentences = countSentences(line);
  if (sentences > 2) {
    errors.push(`Exceeds maximum 2 sentences (found ${sentences})`);
  }

  if (errors.length > 0) {
    failures++;
    console.error(`❌ [Line ${i + 1}] "${line}"`);
    for (const err of errors) {
      console.error(`   - ${err}`);
    }
  }
}

if (failures === 0) {
  console.log(`\n✅ All ${TEST_SUITE.length} spoken utterances passed persona compliance:`);
  console.log("   - Zero banned phrases");
  console.log("   - Zero emojis or markdown residue");
  console.log("   - Zero spoken URLs or file paths");
  console.log("   - Strict 2-sentence maximum constraint obeyed");
  exit(0);
} else {
  console.error(`\n❌ Failed: ${failures} utterances violated persona constraints.`);
  exit(1);
}
