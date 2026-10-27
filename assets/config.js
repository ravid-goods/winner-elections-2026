// Game configuration.
// FORM_ID / ENTRY_* come from the Google Form "pre-filled link":
//   https://docs.google.com/forms/d/e/<FORM_ID>/viewform?usp=pp_url&entry.<NAME_ID>=test&entry.<BET_ID>=test
window.WINNER = {
  FORM_ID: '1FAIpQLSfuQkjurjAFE8TXHLmmRTbdYbMuNMzvet4GQX4tHNaBuIx_cw',
  ENTRY_NAME: 'entry.864466412',    // the "שם" question
  ENTRY_BET: 'entry.1250603811',    // the "הימור" question

  // Polls close (and bets lock) at this Israel-time wall clock.
  CLOSE: { y: 2026, m: 10, d: 27, h: 22 },

  TOTAL: 120,
  MIN_SEATS: 4,     // a party gets 0 seats or at least this many

  BLOCS: {
    R: { label: 'ימין-קואליציה', color: 'var(--bloc-r)' },
    L: { label: 'שמאל-אופוזיציה', color: 'var(--bloc-l)' },
    A: { label: 'ערבים', color: 'var(--bloc-a)' }
  },
  BLOC_ORDER: ['R', 'L', 'A'],

  // Order matters: bets are stored as 15 numbers in this order.
  PARTIES: [
    { name: 'ישר', bloc: 'L' },
    { name: 'הליכוד', bloc: 'R' },
    { name: 'ביחד', bloc: 'L' },
    { name: 'הדמוקרטים', bloc: 'L' },
    { name: 'הרשימה המשותפת', bloc: 'A' },
    { name: 'ש״ס', bloc: 'R' },
    { name: 'עוצמה יהודית', bloc: 'R' },
    { name: 'יהדות התורה', bloc: 'R' },
    { name: 'ישראל ביתנו', bloc: 'L' },
    { name: 'הציונות הדתית וזהות', bloc: 'R' },
    { name: 'רע״מ', bloc: 'A' },
    { name: 'המילואימניקים והכלכלית', bloc: 'L' },
    { name: 'עמך ישראל', bloc: 'R' },
    { name: 'הציבור החרדי', bloc: 'R' },
    { name: 'נעם לישראל', bloc: 'R' }
  ]
};
