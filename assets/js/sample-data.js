// Demo data. Deliberately messy — mixed header styles, a personal column that
// should get hidden automatically, and blanks — so the auto-mapping is honest
// about what it does with a real-world sheet.

const P = (no, name, cat, base, age, city, style, m, runs, wkts, avg, sr, tag, note) =>
  ({ 'S.No': no, 'Player Name': name, 'Category': cat, 'Base Price': base, 'Age': age,
     'City': city, 'Batting Style': style, 'Matches': m, 'Runs': runs, 'Wickets': wkts,
     'Average': avg, 'Strike Rate': sr, 'Marquee': tag, 'Remarks': note, 'Mobile': '' });

export const SAMPLE = {
  settings: {
    preset: 'cricket',
    accent: '#166534',
    title: 'Riverside Premier League',
    subtitle: 'Season 4 · Sunday 14 March · Riverside Ground',
    footer: 'Riverside Sports Club · riversidespl.example',
    currency: '₹',
    numberFormat: 'indian',
    perPage: 4,
    teamsText: 'Riverside Royals, 500000\nHarbour Hawks, 500000\nMill Road Mavericks, 500000\nOld Town Titans, 500000',
    rulesText: `# Squad rules
Each team must sign a minimum of 11 and a maximum of 14 players.
At least 2 players from the Under-19 category must be in every squad.
# Bidding
Bidding starts at the listed base price. Increments are ₹2,500 up to ₹50,000 and ₹5,000 thereafter.
A team with an exhausted purse cannot re-enter the bidding.
# Unsold players
Unsold players return to the table in a final accelerated round.
The auctioneer's decision is final in all matters.`,
  },
  rows: [
    P(1, 'Arjun Menon', 'Marquee', 50000, 29, 'Kochi', 'Right-hand bat', 84, 2412, 6, 34.4, 141.2, 'Marquee', 'Captained the league-winning side in Season 2.'),
    P(2, 'Vikram Rathore', 'Marquee', 50000, 31, 'Indore', 'Right-arm fast', 91, 640, 118, 12.8, 96.5, 'Marquee', 'Leading wicket-taker across the last three seasons.'),
    P(3, 'Sana Iqbal', 'Marquee', 50000, 26, 'Hyderabad', 'Left-hand bat', 72, 2088, 14, 33.1, 138.9, 'Marquee', 'Opened in every game last season.'),
    P(4, 'Deepak Naik', 'Batter', 25000, 24, 'Pune', 'Right-hand bat', 46, 1290, 0, 30.7, 129.4, '', ''),
    P(5, 'Rohit Sabharwal', 'Batter', 25000, 33, 'Delhi', 'Left-hand bat', 103, 3011, 2, 32.0, 118.6, '', 'Most experienced batter in the pool.'),
    P(6, 'Imran Sheikh', 'Batter', 20000, 22, 'Lucknow', 'Right-hand bat', 19, 604, 0, 35.5, 145.7, '', ''),
    P(7, 'Kiran Prabhu', 'Batter', 20000, 27, 'Mangaluru', 'Right-hand bat', 55, 1402, 1, 28.6, 122.3, '', ''),
    P(8, 'Neel Bhatt', 'Batter', 15000, 20, 'Surat', 'Left-hand bat', 12, 318, 0, 26.5, 133.0, 'Under-19', 'Scored 96 on debut.'),
    P(9, 'Faizan Ali', 'Bowler', 25000, 28, 'Bhopal', 'Right-arm medium', 67, 210, 89, 8.4, 88.2, '', ''),
    P(10, 'Sundar Raman', 'Bowler', 25000, 30, 'Chennai', 'Left-arm spin', 78, 344, 96, 11.0, 79.4, '', 'Economy of 6.1 across his career.'),
    P(11, 'Harpreet Gill', 'Bowler', 20000, 25, 'Ludhiana', 'Right-arm fast', 41, 96, 58, 6.4, 91.0, '', ''),
    P(12, 'Manoj Tirkey', 'Bowler', 20000, 23, 'Ranchi', 'Right-arm off-spin', 33, 128, 44, 9.1, 84.7, '', ''),
    P(13, 'Yusuf Kadri', 'Bowler', 15000, 19, 'Nagpur', 'Left-arm fast', 8, 22, 13, 5.5, 76.0, 'Under-19', ''),
    P(14, 'Tanmay Joshi', 'All-rounder', 30000, 27, 'Nashik', 'Right-hand bat', 62, 1180, 51, 24.6, 131.8, '', 'Bats top four and bowls four overs.'),
    P(15, 'Reuben D’Souza', 'All-rounder', 30000, 29, 'Goa', 'Left-hand bat', 70, 1344, 47, 25.9, 127.4, '', ''),
    P(16, 'Anita Sharma', 'All-rounder', 25000, 24, 'Jaipur', 'Right-hand bat', 38, 702, 33, 23.4, 124.0, '', ''),
    P(17, 'Girish Kamath', 'All-rounder', 20000, 32, 'Udupi', 'Right-hand bat', 88, 1610, 62, 22.1, 116.9, '', ''),
    P(18, 'Sameer Qureshi', 'All-rounder', 15000, 21, 'Aligarh', 'Right-hand bat', 16, 288, 12, 20.6, 130.5, 'Under-19', ''),
    P(19, 'Pranav Deshmukh', 'Wicket-keeper', 30000, 26, 'Mumbai', 'Right-hand bat', 74, 1866, 0, 29.6, 134.2, 'Keeper', '52 dismissals in three seasons.'),
    P(20, 'Lalit Chauhan', 'Wicket-keeper', 20000, 30, 'Kanpur', 'Right-hand bat', 59, 1104, 0, 24.0, 119.8, 'Keeper', ''),
    P(21, 'Zoya Rahman', 'Wicket-keeper', 15000, 22, 'Kolkata', 'Left-hand bat', 21, 402, 0, 25.1, 126.4, 'Keeper', ''),
    P(22, 'Ajay Barman', 'Batter', 10000, 19, 'Guwahati', 'Right-hand bat', 6, 141, 0, 23.5, 121.6, 'Under-19', ''),
    P(23, 'Mohit Verma', 'Bowler', 10000, 18, 'Meerut', 'Right-arm medium', 4, 8, 6, 4.0, 66.7, 'Under-19', ''),
    P(24, 'Salim Ansari', 'All-rounder', 10000, 20, 'Bhiwandi', 'Left-hand bat', 11, 196, 9, 19.6, 128.1, 'Under-19', ''),
  ],
};
