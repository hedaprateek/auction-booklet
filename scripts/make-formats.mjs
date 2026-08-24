// Writes the example input sheets in sample/formats/.
//   node scripts/make-formats.mjs
//
// Each one is a real, loadable file that shows a different shape of input.
// They are CSV so they render as tables on GitHub and open in any editor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.join(root, 'sample', 'formats');
fs.mkdirSync(dir, { recursive: true });

const FORMATS = {
  // The floor: a name is the only column AuctionBook truly needs.
  'minimal.csv': [
    ['Name', 'Category', 'Base Price'],
    ['Arjun Menon', 'Marquee', 50000],
    ['Deepak Naik', 'Batter', 25000],
    ['Faizan Ali', 'Bowler', 25000],
    ['Tanmay Joshi', 'All-rounder', 30000],
    ['Zoya Rahman', 'Wicket-keeper', 15000],
  ],

  'cricket.csv': [
    ['Lot', 'Player Name', 'Category', 'Base Price', 'Age', 'City', 'Batting Style', 'Bowling Style',
      'Matches', 'Runs', 'Wickets', 'Average', 'Strike Rate', 'Badge', 'Remarks'],
    [1, 'Arjun Menon', 'Marquee', 50000, 29, 'Kochi', 'Right-hand bat', '—', 84, 2412, 6, 34.4, 141.2, 'Marquee', 'Captained the Season 2 winners.'],
    [2, 'Vikram Rathore', 'Marquee', 50000, 31, 'Indore', 'Right-hand bat', 'Right-arm fast', 91, 640, 118, 12.8, 96.5, 'Marquee', 'Leading wicket-taker.'],
    [3, 'Deepak Naik', 'Batter', 25000, 24, 'Pune', 'Right-hand bat', '—', 46, 1290, 0, 30.7, 129.4, '', ''],
    [4, 'Sundar Raman', 'Bowler', 25000, 30, 'Chennai', 'Left-hand bat', 'Left-arm spin', 78, 344, 96, 11.0, 79.4, '', 'Career economy 6.1.'],
    [5, 'Pranav Deshmukh', 'Wicket-keeper', 30000, 26, 'Mumbai', 'Right-hand bat', '—', 74, 1866, 0, 29.6, 134.2, 'Keeper', '52 dismissals.'],
  ],

  'football.csv': [
    ['No', 'Player', 'Position', 'Base Price', 'Age', 'Height (cm)', 'Preferred Foot',
      'Appearances', 'Goals', 'Assists', 'Clean Sheets', 'Previous Club', 'Badge', 'Notes'],
    [1, 'Ravi Kumar', 'Forward', 40000, 25, 178, 'Right', 62, 41, 12, 0, 'Harbour FC', 'Marquee', 'Golden boot, Season 3.'],
    [2, 'Ismail Sait', 'Midfielder', 30000, 27, 174, 'Left', 88, 14, 33, 0, 'Old Town United', 'Captain', ''],
    [3, 'Nikhil Bose', 'Defender', 25000, 29, 186, 'Right', 95, 6, 4, 0, 'Mill Road SC', '', 'Never sent off.'],
    [4, 'Ajay Pillai', 'Goalkeeper', 25000, 31, 189, 'Right', 71, 0, 1, 28, 'Riverside AFC', '', ''],
    [5, 'Sameer Khan', 'Forward', 15000, 19, 171, 'Left', 9, 5, 2, 0, 'Academy', 'Under-19', 'Promoted from the youth side.'],
  ],

  'kabaddi.csv': [
    ['S.No', 'Player Name', 'Role', 'Base Price', 'Age', 'Height (cm)', 'Weight (kg)',
      'Matches', 'Raid Points', 'Tackle Points', 'Super Raids', 'Super Tackles', 'Badge', 'Remarks'],
    [1, 'Manjeet Rana', 'Raider', 45000, 26, 180, 78, 52, 412, 18, 21, 2, 'Marquee', 'Most raid points last season.'],
    [2, 'Bala Subramani', 'Defender', 30000, 28, 176, 84, 61, 22, 188, 0, 34, '', ''],
    [3, 'Harish Yadav', 'All-rounder', 35000, 24, 178, 80, 44, 176, 96, 9, 12, '', ''],
    [4, 'Iqbal Sheikh', 'Defender', 20000, 22, 182, 86, 18, 8, 61, 0, 11, 'Under-21', ''],
    [5, 'Prakash Dey', 'Raider', 20000, 20, 172, 71, 12, 88, 4, 4, 0, 'Under-21', 'Debut season.'],
  ],

  'esports.csv': [
    ['ID', 'Handle', 'Role', 'Base Price', 'Region', 'Main Agent', 'Rank',
      'Matches', 'K/D', 'ADR', 'HS %', 'Win Rate', 'Badge', 'About'],
    ['P01', 'nova_', 'Duelist', 40000, 'South', 'Jett', 'Radiant', 340, 1.34, 168, 28, '61%', 'Marquee', 'Two-time regional MVP.'],
    ['P02', 'kaze', 'Controller', 30000, 'West', 'Omen', 'Immortal 3', 298, 1.08, 141, 22, '57%', 'IGL', 'Calls for the current roster.'],
    ['P03', 'bytez', 'Sentinel', 25000, 'North', 'Killjoy', 'Immortal 2', 271, 1.02, 133, 19, '54%', '', ''],
    ['P04', 'mira.op', 'Initiator', 25000, 'East', 'Sova', 'Immortal 1', 244, 0.98, 129, 21, '52%', '', ''],
    ['P05', 'q7', 'Flex', 15000, 'South', 'Multiple', 'Ascendant 3', 96, 0.94, 120, 24, '49%', 'Rookie', 'First open circuit.'],
  ],

  // Nothing here is a sport. The engine does not care: unmapped columns
  // become stat tiles labelled with whatever the header says.
  'non-sport-quiz-league.csv': [
    ['Entry', 'Participant', 'Team Preference', 'Base Points', 'Department', 'Years at Firm',
      'Quizzes Played', 'Wins', 'Buzzer Accuracy', 'Specialist Subject', 'Badge', 'Bio'],
    [1, 'Meera Ranganathan', 'Any', 500, 'Finance', 7, 41, 19, '72%', 'History', 'Captain', 'Won the 2024 open.'],
    [2, 'Tom Abraham', 'Falcons', 400, 'Engineering', 3, 33, 11, '65%', 'Science', '', ''],
    [3, 'Divya Raghavan', 'Any', 400, 'Design', 5, 28, 12, '68%', 'Cinema', '', 'Never misses a film round.'],
    [4, 'Karan Sethi', 'Titans', 300, 'Sales', 2, 14, 4, '54%', 'Sport', 'Rookie', ''],
    [5, 'Anjali Nair', 'Any', 300, 'Legal', 9, 37, 15, '70%', 'Literature', '', ''],
  ],

  // What a Google Forms response sheet actually looks like: question-shaped
  // headers, a Timestamp, a collected email, a Drive link for the photo, and
  // admin answers nobody wants printed. AuctionBook hides the last group and
  // trims the questions down to usable labels.
  'google-form-responses.csv': [
    ['Timestamp', 'Email Address', 'Full name (as it should appear in the booklet)',
      'Which category are you registering for?', 'Your age', 'City / locality',
      'Batting style', 'Matches played (approx.)', 'Total runs (approx.)',
      'Wickets taken (approx.)', 'Upload a recent photo',
      'Anything the team owners should know about you?', 'Mobile number', 'T-shirt size'],
    ['24/02/2026 19:04:11', 'arjun.m@example.com', 'Arjun Menon', 'Marquee', 29, 'Kochi',
      'Right-hand bat', 84, 2412, 6, 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWx',
      'Captained the Season 2 winners.', '98xxxxxx01', 'L'],
    ['24/02/2026 19:11:52', 'd.naik@example.com', 'Deepak Naik', 'Batter', 24, 'Pune',
      'Right-hand bat', 46, 1290, 0, 'https://drive.google.com/open?id=2BcDeFgHiJkLmNoPqRsTuVwX',
      '', '98xxxxxx02', 'M'],
    ['24/02/2026 20:02:37', 's.raman@example.com', 'Sundar Raman', 'Bowler', 30, 'Chennai',
      'Left-hand bat', 78, 344, 96, 'https://drive.google.com/open?id=3CdEfGhIjKlMnOpQrStUvWxY',
      'Career economy 6.1.', '98xxxxxx03', 'L'],
    ['25/02/2026 08:47:03', 'z.rahman@example.com', 'Zoya Rahman', 'Wicket-keeper', 22, 'Kolkata',
      'Left-hand bat', 21, 402, 0, 'https://drive.google.com/open?id=4DeFgHiJkLmNoPqRsTuVwXyZ',
      '', '98xxxxxx04', 'S'],
  ],
};

const cell = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

for (const [name, grid] of Object.entries(FORMATS)) {
  fs.writeFileSync(path.join(dir, name), grid.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n');
  console.log(`${name.padEnd(32)} ${grid[0].length} columns, ${grid.length - 1} rows`);
}
