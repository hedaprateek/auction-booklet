// Judged competitions — cooking, rangoli, dance and the rest.
//
// These are a different shape from an auction. There are no base prices and no
// teams; there are judges, weighted criteria, and a score to total up. Each
// preset carries the criteria a real judging sheet for that event would have,
// weighted out of 100, plus the vocabulary ("Entry" rather than "Lot") and the
// registration fields worth collecting.
//
// Everything here is a starting point — every criterion, weight and label stays
// editable in the app.

export const COMPETITIONS = [
  {
    id: 'cooking', label: 'Cooking / Bake-off', accent: '#b45309', noun: 'Entry',
    categories: ['Starter', 'Main course', 'Dessert', 'Baking'],
    criteria: [
      { name: 'Taste', max: 40 }, { name: 'Presentation', max: 25 },
      { name: 'Creativity', max: 20 }, { name: 'Hygiene', max: 15 },
    ],
    fields: ['Dish name', 'Main ingredients', 'Preparation time (min)', 'Serves'],
    blurb: 'Dish name printed under the entrant, so judges know what they are tasting.',
  },
  {
    id: 'rangoli', label: 'Rangoli / Floor art', accent: '#be123c', noun: 'Entry',
    categories: ['Freehand', 'Theme based', 'Group', 'Junior'],
    criteria: [
      { name: 'Design & creativity', max: 30 }, { name: 'Colour balance', max: 25 },
      { name: 'Neatness', max: 25 }, { name: 'Overall impact', max: 20 },
    ],
    fields: ['Theme', 'Materials used', 'Size (ft)', 'Team size'],
    blurb: 'Judged at the spot — print the sheets and walk the floor.',
  },
  {
    id: 'dance', label: 'Dance', accent: '#7c3aed', noun: 'Performance',
    categories: ['Classical', 'Folk', 'Western', 'Group'],
    criteria: [
      { name: 'Choreography', max: 30 }, { name: 'Rhythm & timing', max: 25 },
      { name: 'Expression', max: 25 }, { name: 'Costume & presentation', max: 20 },
    ],
    fields: ['Dance form', 'Track / song', 'Duration (min)', 'Number of performers'],
    blurb: 'Running order doubles as the stage list.',
  },
  {
    id: 'singing', label: 'Singing / Music', accent: '#0e7490', noun: 'Performance',
    categories: ['Solo', 'Duet', 'Group', 'Instrumental'],
    criteria: [
      { name: 'Pitch & melody', max: 30 }, { name: 'Rhythm', max: 25 },
      { name: 'Voice quality', max: 25 }, { name: 'Expression', max: 20 },
    ],
    fields: ['Song', 'Language', 'Duration (min)', 'Accompaniment'],
  },
  {
    id: 'fancydress', label: 'Fancy dress', accent: '#c2410c', noun: 'Entry',
    categories: ['Sub-junior', 'Junior', 'Senior'],
    criteria: [
      { name: 'Costume', max: 30 }, { name: 'Character portrayal', max: 30 },
      { name: 'Confidence', max: 20 }, { name: 'Presentation', max: 20 },
    ],
    fields: ['Character', 'Age', 'Class / group'],
  },
  {
    id: 'art', label: 'Drawing / Painting', accent: '#15803d', noun: 'Entry',
    categories: ['Pencil', 'Colour', 'Abstract', 'Junior'],
    criteria: [
      { name: 'Creativity', max: 30 }, { name: 'Technique', max: 30 },
      { name: 'Use of colour', max: 20 }, { name: 'Neatness', max: 20 },
    ],
    fields: ['Title', 'Medium', 'Theme'],
  },
  {
    id: 'mehndi', label: 'Mehndi / Henna', accent: '#9a3412', noun: 'Entry',
    categories: ['Traditional', 'Arabic', 'Bridal', 'Junior'],
    criteria: [
      { name: 'Design intricacy', max: 30 }, { name: 'Neatness', max: 25 },
      { name: 'Creativity', max: 25 }, { name: 'Coverage', max: 20 },
    ],
    fields: ['Style', 'Time taken (min)'],
  },
  {
    id: 'photography', label: 'Photography', accent: '#334155', noun: 'Entry',
    categories: ['Nature', 'Portrait', 'Street', 'Mobile'],
    criteria: [
      { name: 'Composition', max: 30 }, { name: 'Technical quality', max: 25 },
      { name: 'Creativity', max: 25 }, { name: 'Story', max: 20 },
    ],
    fields: ['Title', 'Location', 'Camera / phone'],
  },
  {
    id: 'sciencefair', label: 'Science fair / Project', accent: '#1d4ed8', noun: 'Project',
    categories: ['Physics', 'Biology', 'Environment', 'Working model'],
    criteria: [
      { name: 'Innovation', max: 30 }, { name: 'Scientific method', max: 25 },
      { name: 'Presentation', max: 25 }, { name: 'Practical use', max: 20 },
    ],
    fields: ['Project title', 'Class / group', 'Guide teacher', 'Team size'],
  },
  {
    id: 'speech', label: 'Debate / Elocution', accent: '#4338ca', noun: 'Speaker',
    categories: ['Junior', 'Senior', 'Open'],
    criteria: [
      { name: 'Content', max: 30 }, { name: 'Delivery', max: 25 },
      { name: 'Language', max: 20 }, { name: 'Time management', max: 15 },
      { name: 'Confidence', max: 10 },
    ],
    fields: ['Topic', 'Language', 'Duration (min)'],
  },
  {
    id: 'flower', label: 'Flower arrangement / Pookalam', accent: '#be185d', noun: 'Entry',
    categories: ['Individual', 'Group', 'Theme based'],
    criteria: [
      { name: 'Design', max: 30 }, { name: 'Colour harmony', max: 25 },
      { name: 'Creativity', max: 25 }, { name: 'Freshness', max: 20 },
    ],
    fields: ['Theme', 'Flowers used', 'Size (ft)', 'Team size'],
  },
  {
    id: 'generic-comp', label: 'Other judged competition', accent: '#0f766e', noun: 'Entry',
    categories: ['Junior', 'Senior', 'Open'],
    criteria: [
      { name: 'Creativity', max: 25 }, { name: 'Skill', max: 25 },
      { name: 'Presentation', max: 25 }, { name: 'Overall impact', max: 25 },
    ],
    fields: ['Title', 'Notes'],
  },
];

export const getCompetition = id => COMPETITIONS.find(c => c.id === id) || null;

export const isCompetition = id => COMPETITIONS.some(c => c.id === id);

/** Criteria totals should come to 100 — the app warns if edits break that. */
export const criteriaTotal = criteria =>
  criteria.reduce((s, c) => s + (Number(c.max) || 0), 0);
