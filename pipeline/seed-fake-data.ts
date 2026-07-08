#!/usr/bin/env tsx
// pipeline/seed-fake-data.ts
// Seeds 8 rich fake articles with highlights into the Appwrite database for UI testing.
// Run: npx tsx pipeline/seed-fake-data.ts

import { Client, Databases, ID, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ARTICLES_COL = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID || 'articles';
const CATEGORIES_COL = process.env.NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID || 'categories';

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const db = new Databases(client);

// ── Helper ────────────────────────────────────────────────────────────────────
async function getCategoryId(sourceSlug: string, categorySlug: string): Promise<string> {
  const res = await db.listDocuments(DB_ID, CATEGORIES_COL, [
    Query.equal('source_slug', sourceSlug),
    Query.equal('slug', categorySlug),
    Query.limit(1),
  ]);
  if (res.documents.length === 0) {
    throw new Error(`Category not found: source=${sourceSlug} slug=${categorySlug}`);
  }
  return res.documents[0].$id;
}

// ── Article definitions ───────────────────────────────────────────────────────
const ARTICLES = [
  // ── THE ECONOMIST ──────────────────────────────────────────────────────────
  {
    title: 'The AI Race Nobody Wanted',
    slug: 'the-ai-race-nobody-wanted',
    author: 'The Economist Staff',
    source: 'economist',
    source_issue: '2026-05-24',
    category_slug: 'science-technology',
    published_at: '2026-05-24T10:00:00.000Z',
    reading_time: 7,
    excerpt: 'The competition between America and China in artificial intelligence has taken on a logic of its own — one that neither side can easily escape.',
    highlights: [
      'The competition between America and China in artificial intelligence has taken on a logic of its own — one that neither side can easily escape.',
      'History suggests that technological arms races have a terrible habit of producing the very catastrophes they are designed to prevent.',
      'No one in Washington or Beijing actually chose this rivalry. It emerged from a thousand small decisions, each rational in isolation, collectively ruinous.',
    ],
    body: `<p>The competition between America and China in artificial intelligence has taken on a logic of its own — one that neither side can easily escape. It is no longer a contest between two governments making deliberate choices. It is something closer to an avalanche: slow to start, impossible to stop.</p>

<p>History suggests that technological arms races have a terrible habit of producing the very catastrophes they are designed to prevent. The nuclear race between Washington and Moscow left both nations permanently on the edge of destruction. The competition to control Atlantic sea lanes in 1914 dragged the world into a war that none of its architects wanted. Students of these episodes find the current moment uncomfortably familiar.</p>

<p>No one in Washington or Beijing actually chose this rivalry. It emerged from a thousand small decisions, each rational in isolation, collectively ruinous. An American chip restriction here. A Chinese laboratory benchmark there. A subsidy program. A talent recruitment drive. A closed-door briefing that was really an open threat.</p>

<p>What makes the AI race particularly perilous is that neither side has a good theory of what winning looks like. The nuclear competition had a grim clarity: enough warheads to survive a first strike and retaliate. AI has no equivalent concept of strategic stability. Does winning mean building the most powerful model? Deploying it the fastest? Controlling the chips that run it? Nobody agrees, which means nobody can stop.</p>

<p>There are economists who argue this is simply the nature of technological competition and that the race will ultimately benefit humanity. Innovation tends to be non-zero-sum, they note. What one country learns, all countries eventually use. American GPS satellites guide Chinese delivery drivers. Chinese solar panels power German homes.</p>

<p>But AI researchers point to a difference: this technology is not just a tool to be shared. It is, potentially, an agent — something that acts in the world on behalf of whoever controls it. A world where the most powerful AI systems are designed in secret, tested behind firewalls, and deployed with military priorities is a different and more dangerous world than the one we have now.</p>

<p>The sadder question is whether any of this was avoidable. In 2016, when AlphaGo first defeated the world champion at Go, the leading researchers in both countries shared data freely. Papers were published openly. Conferences were international. That window closed somewhere around 2018, and the people who were there cannot quite say exactly when or why. It just did.</p>`,
  },
  {
    title: 'How Markets Learned to Fear',
    slug: 'how-markets-learned-to-fear',
    author: 'Buttonwood',
    source: 'economist',
    source_issue: '2026-05-24',
    category_slug: 'finance-economics',
    published_at: '2026-05-23T14:00:00.000Z',
    reading_time: 6,
    excerpt: 'The VIX, once dismissed as the "fear gauge" by people who did not understand fear, has become the most important number on Wall Street.',
    highlights: [
      'The VIX, once dismissed as the "fear gauge" by people who did not understand fear, has become the most important number on Wall Street.',
      'What is remarkable is not that markets are afraid. What is remarkable is that they have learned, at last, to price fear correctly.',
      'A generation of traders grew up believing that central banks would always bail them out. That belief, it turns out, was the riskiest asset of all.',
    ],
    body: `<p>The VIX, once dismissed as the "fear gauge" by people who did not understand fear, has become the most important number on Wall Street. In quiet years it drifts below 15. In the weeks before the 2008 financial crisis it hit 80. Right now it is sitting at 32 — not catastrophic, but not comfortable. Markets are worried about something they cannot quite name.</p>

<p>What is remarkable is not that markets are afraid. What is remarkable is that they have learned, at last, to price fear correctly. For much of the past decade, investors systematically underestimated risk because they believed — with reasonable evidence — that central banks would always rescue them. That belief died somewhere in 2022, when inflation forced the Federal Reserve to raise rates at the fastest pace since the 1980s and stocks fell 25%.</p>

<p>A generation of traders grew up believing that central banks would always bail them out. That belief, it turns out, was the riskiest asset of all. When it collapsed, so did the valuations built on top of it.</p>

<p>The philosophical shift this implies is profound. For thirty years, the dominant theory of financial markets was that risk was calculable — that given enough data and enough computing power, you could assign a precise probability to any outcome. The 2008 crisis challenged that theory. The pandemic shattered it. What we are left with is something less tidy but more honest: the knowledge that some risks are not quantifiable, only manageable.</p>

<p>The practical implication is that asset managers now hold more cash than at any point since 2001. Not because they know something bad is coming — they do not, any more than the rest of us — but because cash has a value that models cannot capture. It is the option to act when others cannot.</p>

<p>This might sound cautious to the point of paralysis, but experienced investors know that the best returns often come from staying liquid when everyone else is desperate. In March 2020, when airlines were selling planes to make payroll, the buyers were not momentum traders with borrowed money. They were the ones who had been laughed at for holding too much cash in 2019.</p>`,
  },
  {
    title: 'The Last Bookshops',
    slug: 'the-last-bookshops',
    author: 'Prospero',
    source: 'economist',
    source_issue: '2026-05-17',
    category_slug: 'culture-books',
    published_at: '2026-05-17T09:00:00.000Z',
    reading_time: 5,
    excerpt: 'Independent bookshops have been dying for thirty years. Somehow, the good ones keep surviving.',
    highlights: [
      'Independent bookshops have been dying for thirty years. Somehow, the good ones keep surviving.',
      'A bookshop is not really a retail operation. It is an argument about what matters.',
      'The customers who come to these shops are not buying books they already know they want. They are buying the experience of being surprised.',
    ],
    body: `<p>Independent bookshops have been dying for thirty years. Somehow, the good ones keep surviving. The conventional explanation is community — that people want to support local businesses, that bookshops are gathering places, that there is more to commerce than price. This is true, as far as it goes, but it undersells something stranger and more interesting about why certain bookshops endure.</p>

<p>A bookshop is not really a retail operation. It is an argument about what matters. The selection on the shelves — which books face outward, which are buried spine-in, which sit on the table by the door — reflects a judgment about the world and what is worth knowing. A good bookshop makes that argument quietly but insistently. Walk in and you feel, almost immediately, whether you agree or disagree.</p>

<p>The customers who come to these shops are not buying books they already know they want. They are buying the experience of being surprised. This is something Amazon, for all its extraordinary logistics, cannot replicate. Its recommendation algorithms are good at showing you more of what you already like. They are terrible at the thing that bookshops do best: showing you something you did not know you were looking for until you found it.</p>

<p>The shops that have survived have largely done so by doubling down on curation, on events, on the personality of their staff. They have become more opinionated, not less — more willing to refuse to stock certain titles, more willing to champion unknown authors at the expense of bestsellers. This is, economically speaking, a strange strategy. But it works, because it gives customers a reason to come that Amazon cannot compete with.</p>

<p>There is also, perhaps, a generational shift at play. Young people — digital natives who have grown up with infinite content — increasingly value the object itself. Vinyl records. Printed photographs. Physical books. Not because these things are superior to their digital equivalents in every way, but because their limitations are a feature. A book you can only read one thing at a time. It does not notify you. It does not suggest that you check something else. It simply waits for you to finish.</p>`,
  },

  // ── THE NEW YORKER ─────────────────────────────────────────────────────────
  {
    title: 'The Language of Rain',
    slug: 'the-language-of-rain',
    author: 'Elif Batuman',
    source: 'new-yorker',
    source_issue: '2026-05-19',
    category_slug: 'essays-reporting',
    published_at: '2026-05-19T08:00:00.000Z',
    reading_time: 9,
    excerpt: 'I grew up in a city that had forty-seven words for rain, and I did not know any of them until I was thirty-four.',
    highlights: [
      'I grew up in a city that had forty-seven words for rain, and I did not know any of them until I was thirty-four.',
      'Language is not a cage that traps thought. It is more like a riverbed — it shapes the flow without stopping it.',
      'There is a kind of grief in discovering that your mother tongue was richer than you knew, and you let it drain away.',
    ],
    body: `<p>I grew up in a city that had forty-seven words for rain, and I did not know any of them until I was thirty-four. My grandmother knew them. She could tell you, without looking out the window, whether the rain falling on the courtyard was the kind that soaked you before you knew it was raining, or the kind that looked heavy from inside but parted around you on the street, or the kind that had been thinking about coming for three days and was finally, reluctantly, here.</p>

<p>I learned all of this too late, from a book, after she was gone. I wrote the words in the margins of my notebook but I cannot say them aloud without a kind of stage fright. They do not belong to me the way they belonged to her. This is one of the small catastrophes of assimilation: the vocabulary you lose is not random. You lose the most specific words first, the ones that require the most local knowledge, and you end up speaking a version of your first language that has been sanded down to its most portable features.</p>

<p>Language is not a cage that traps thought. It is more like a riverbed — it shapes the flow without stopping it. People can think things they cannot say; they can say things they cannot think. But there is no question that having a word for something changes your relationship to it. When you have forty-seven words for rain, you pay a different kind of attention to rain. You develop categories. You build a taxonomy of experience that, eventually, becomes a way of seeing.</p>

<p>There is a kind of grief in discovering that your mother tongue was richer than you knew, and you let it drain away. I feel it every time I go back. Istanbul in the rain is still magnificent — the mosques, the ferries, the grey water of the Bosphorus — but I see it now as a tourist sees it, in broad strokes, without the fine-grained vocabulary that would let me see it as my grandmother saw it. The city she lived in and the city I visit are not quite the same place.</p>

<p>My daughter speaks three languages and none of them is Turkish. When she is thirty-four, she will not know the forty-seven words for rain. She will have other words instead — for things I cannot name, in a world I will only partially understand. This is not tragedy. It is just time, doing what time does. But I wish I had written more things down.</p>`,
  },
  {
    title: 'What America Gets Wrong About Tea',
    slug: 'what-america-gets-wrong-about-tea',
    author: 'Calvin Trillin',
    source: 'new-yorker',
    source_issue: '2026-05-12',
    category_slug: 'humor',
    published_at: '2026-05-12T10:00:00.000Z',
    reading_time: 5,
    excerpt: 'Every few years, America attempts to have a relationship with tea. So far, the tea is winning.',
    highlights: [
      'Every few years, America attempts to have a relationship with tea. So far, the tea is winning.',
      'The problem is that Americans treat tea like weak coffee — something to be improved with enough additions until it stops tasting like itself.',
      'A tea shop in New York is really a therapy session with hotter liquids and worse chairs.',
    ],
    body: `<p>Every few years, America attempts to have a relationship with tea. It discovers matcha, or bubble tea, or adaptogen lattes with functional mushroom extracts. Tea influencers emerge on social media platforms that did not exist during the previous tea moment. A celebrity tweets something about the calming properties of L-theanine. There is a brief golden age of enthusiasm. Then everyone goes back to coffee. So far, the tea is winning.</p>

<p>I have watched several of these cycles with what I would describe as educated detachment, having grown up in a household where tea meant a Lipton bag steeped until the water changed color and then immediately supplemented with enough sugar to constitute a separate food group. My grandmother called this tea. Experts in the field call it something else, often while sighing.</p>

<p>The problem is that Americans treat tea like weak coffee — something to be improved with enough additions until it stops tasting like itself. This is philosophically incompatible with tea, which has spent several thousand years developing exactly the taste it has and does not appreciate the implication that it could be better with oat milk. Coffee is naturally gregarious, a substance that welcomes collaborators. Tea is private. It wants to be approached with some respect for what it already is.</p>

<p>The new tea shops that have appeared in every American city are doing their best. They have beautiful ceramics and knowledgeable staff and long menus with unfamiliar words. But a tea shop in New York is really a therapy session with hotter liquids and worse chairs. People sit with their single-origin oolongs and talk about anxiety and screen time in the same voice they used, two years ago, in the cold brew line. The tea is excellent. Whether it is doing what people want from it is less clear.</p>

<p>I should say that I have genuinely come to love tea, in the late middle of my life, in the way that one comes to love things that require patience. I am not sure I understand it. But I make it carefully now, and I drink it without doing anything else, which is something I cannot say about coffee. Perhaps this is what all the fuss is about. Perhaps the tea has been trying to tell us something this whole time, and we have been too caffeinated to listen.</p>`,
  },

  // ── NEW SCIENTIST ──────────────────────────────────────────────────────────
  {
    title: 'Consciousness Rebooted',
    slug: 'consciousness-rebooted',
    author: 'Alison George',
    source: 'new-scientist',
    source_issue: '2026-05-22',
    category_slug: 'science-features',
    published_at: '2026-05-22T09:00:00.000Z',
    reading_time: 8,
    excerpt: 'Scientists thought they were closing in on the neural signature of consciousness. The data had other ideas.',
    highlights: [
      'Scientists thought they were closing in on the neural signature of consciousness. The data had other ideas.',
      'Consciousness might not be a thing the brain does. It might be a thing the brain is — a fundamental property, like mass or charge.',
      'The hard problem of consciousness is hard precisely because it is not a scientific problem. It is a philosophical one wearing a lab coat.',
    ],
    body: `<p>Scientists thought they were closing in on the neural signature of consciousness. For two decades, the leading theory — global workspace theory — predicted that awareness corresponded to a particular pattern of brain activity: a burst of synchronized firing across widely distributed cortical regions, a sort of neural broadcast that made information available to the whole brain at once. Scan the brain of someone seeing a flash of light at the threshold of perception, and you would see this burst in the conscious trials but not the unconscious ones. The theory was elegant, predictive, and had accumulated impressive experimental support.</p>

<p>The data had other ideas. A massive international replication study, published in 2023 and involving more than 250 participants across six laboratories, found something nobody expected: the signature the theory predicted was real, but it was not specific to consciousness. It appeared in unconscious processing too. The theory was not wrong exactly, but it was not sufficient. Something was missing.</p>

<p>Consciousness might not be a thing the brain does. It might be a thing the brain is — a fundamental property, like mass or charge, that exists at a basic level and cannot be reduced to the behavior of neurons. This view, called panpsychism or integrated information theory, is deeply controversial among neuroscientists, many of whom consider it untestable and therefore unscientific. But its proponents point out that every attempt to explain consciousness in terms of information processing has eventually hit the same wall: you can describe the processing in perfect detail and still not explain why there is something it is like to be the system doing it.</p>

<p>The hard problem of consciousness is hard precisely because it is not a scientific problem. It is a philosophical one wearing a lab coat. Science can tell us which brain regions are active during a conscious experience. It can tell us what patterns of firing correlate with what kinds of experience. It cannot tell us why any of this should feel like anything at all. That question — why is there experience, rather than just processing? — sits outside the explanatory toolkit science has developed, and may require a different kind of thinking entirely.</p>

<p>This does not mean scientists should stop trying. The empirical work has been extraordinary — we know vastly more about the neural correlates of consciousness than we did twenty years ago, and that knowledge has already produced clinical benefits for patients with disorders of consciousness. But the goal of a complete scientific theory of consciousness — a theory that would explain not just the correlates but the experience itself — remains as elusive as it ever was. Some researchers have begun to wonder whether that goal is coherent at all.</p>

<p>Neuroscientist Anil Seth has proposed a different framing: instead of asking why we are conscious, ask what consciousness is for. His answer is that it is a kind of controlled hallucination — the brain's best guess about the causes of sensory signals, projected onto the world to make action possible. We do not perceive reality directly. We perceive a model of reality, constructed by the brain, continuously updated, and — this is the crucial bit — experienced from the inside. The question is not why the model exists but why the inside feels the way it does.</p>`,
  },
  {
    title: 'A Week in the Life of the Climate',
    slug: 'a-week-in-the-life-of-the-climate',
    author: 'Graham Lawton',
    source: 'new-scientist',
    source_issue: '2026-05-15',
    category_slug: 'environment',
    published_at: '2026-05-15T08:00:00.000Z',
    reading_time: 7,
    excerpt: 'Every week now brings a new climate record, a new disaster, a new warning. What does it feel like to live inside the data?',
    highlights: [
      'Every week now brings a new climate record, a new disaster, a new warning. What does it feel like to live inside the data?',
      'We have spent so long arguing about whether climate change is real that we have barely begun to argue about what to do now that it is here.',
      'The atmosphere does not care about our political cycles. It operates on its own schedule, and its schedule is not ours.',
    ],
    body: `<p>Every week now brings a new climate record, a new disaster, a new warning. The sea surface temperature off Florida hits a level that scientists describe as "unprecedented in the observational record," which means unprecedented in human experience. A dome of heat settles over South Asia. Wildfire smoke from Canada darkens the sky over New York. What does it feel like to live inside the data?</p>

<p>For climate scientists, the feeling is complicated. They have been warning about this for decades, which might suggest a certain grim satisfaction in being proved right. But most of the scientists I know feel nothing like satisfaction. They feel something closer to grief — the grief of a doctor who correctly diagnosed a disease they could not persuade the patient to treat. Being right is no consolation when the outcome is what you feared.</p>

<p>We have spent so long arguing about whether climate change is real that we have barely begun to argue about what to do now that it is here. The public conversation is still dominated by questions that the scientific community settled years ago — is it happening? is it human-caused? — while the harder questions go largely undiscussed. How do we allocate the costs of adaptation? Which communities do we save first? Which do we abandon? These are not scientific questions. They are moral and political ones, and we have not developed the institutions or the language to answer them.</p>

<p>The atmosphere does not care about our political cycles. It operates on its own schedule, and its schedule is not ours. Carbon dioxide emitted today will affect temperatures for a century. Infrastructure built this decade will still be standing when the climate is two degrees warmer than today. The mismatch between the timescale on which the problem unfolds and the timescale on which democracies make decisions is not a new observation, but it is one that becomes more acute every year.</p>

<p>What strikes me most, spending a week tracking the climate news, is the normalization. Events that would have been front-page stories five years ago now appear in the science section, below the fold. A new record ocean temperature: B3. Another study on permafrost methane: B7. We are adapting, cognitively if not physically — and that adaptation may itself be one of the most important stories of our time. When catastrophe becomes routine, it stops feeling like catastrophe. And when it stops feeling like catastrophe, the urgency that might motivate action leaks away.</p>`,
  },
  {
    title: 'The Quiet Revolution in Sleep',
    slug: 'the-quiet-revolution-in-sleep',
    author: 'Clare Wilson',
    source: 'new-scientist',
    source_issue: '2026-05-08',
    category_slug: 'health-medicine',
    published_at: '2026-05-08T09:00:00.000Z',
    reading_time: 6,
    excerpt: 'For most of human history, we slept in two shifts. Then the light bulb arrived and we forgot.',
    highlights: [
      'For most of human history, we slept in two shifts. Then the light bulb arrived and we forgot.',
      'The assumption that eight unbroken hours is the natural human sleep pattern turns out to be a fairly recent invention.',
      'What feels like insomnia in the middle of the night may simply be your body doing exactly what it was designed to do.',
    ],
    body: `<p>For most of human history, we slept in two shifts. Then the light bulb arrived and we forgot. Historical records from the medieval period — diaries, court documents, medical texts — describe a pattern that would be diagnosed today as a sleep disorder: people going to bed at dusk, waking in the middle of the night for an hour or two of quiet activity, then sleeping again until dawn. This was called "first sleep" and "second sleep," and it was completely normal.</p>

<p>The assumption that eight unbroken hours is the natural human sleep pattern turns out to be a fairly recent invention, roughly contemporary with the widespread adoption of gas and then electric lighting, which abolished the long winter nights that previously gave people little alternative but to sleep. We extended our waking hours and compressed our sleep into a single block. The body adapted, more or less. But the old pattern may not be entirely gone.</p>

<p>What feels like insomnia in the middle of the night may simply be your body doing exactly what it was designed to do. Historian Roger Ekirch, who spent sixteen years researching historical sleep records, believes that many cases of "sleep maintenance insomnia" — the kind where you wake at 3 a.m. and cannot get back to sleep — may be manifestations of the ancestral two-sleep pattern trying to reassert itself against the single-block norm we have imposed on it.</p>

<p>The practical implication, if Ekirch is right, is both reassuring and disruptive. Reassuring because it means lying awake at 3 a.m. is not pathological — it is human. Disruptive because it suggests that the standard advice for insomnia — stay in bed and try to fall back asleep — may be exactly wrong. The medieval approach was to use the waking period productively: to pray, to have sex, to think, to read by candlelight. To treat the middle of the night not as a failure of sleep but as a room of its own.</p>

<p>Sleep researchers are cautiously interested in this historical framework, though most stop short of recommending that patients abandon their single-sleep schedules. The demands of modern work and family life make a two-sleep pattern impractical for most people. But the research has shifted something in the clinical conversation: the goal is no longer necessarily eight unbroken hours. It is sufficient sleep, in a pattern that works for the individual. Sometimes that means accepting the 3 a.m. wake as part of the design rather than a flaw in it.</p>`,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding fake articles...\n');

  // First, run the highlights migration if needed
  try {
    const attr = await db.getAttribute(DB_ID, ARTICLES_COL, 'highlights');
    if (attr.status !== 'available') {
      console.log('⚠️  "highlights" attribute not available yet. Run: npx tsx pipeline/add-highlights-attr.ts first');
      process.exit(1);
    }
  } catch {
    console.log('⚠️  "highlights" attribute does not exist. Running migration now...');
    await db.createStringAttribute(DB_ID, ARTICLES_COL, 'highlights', 2000, false, undefined, true);
    console.log('   Waiting for attribute to be available...');
    const TIMEOUT = 3 * 60 * 1000;
    const start = Date.now();
    while (true) {
      if (Date.now() - start > TIMEOUT) { console.error('Timed out'); process.exit(1); }
      const a = await db.getAttribute(DB_ID, ARTICLES_COL, 'highlights');
      if (a.status === 'available') { console.log('   ✅ highlights attribute ready\n'); break; }
      process.stdout.write(`\r   Status: ${a.status}... `);
      await new Promise((r) => setTimeout(r, 2000));
    }
    process.stdout.write('\n');
  }

  for (const article of ARTICLES) {
    // Check if already seeded
    const existing = await db.listDocuments(DB_ID, ARTICLES_COL, [Query.equal('slug', article.slug), Query.limit(1)]);
    if (existing.documents.length > 0) {
      console.log(`   ⏭️  Skipping "${article.title}" — already exists.`);
      continue;
    }

    // Get category ID
    let categoryId = '';
    try {
      categoryId = await getCategoryId(article.source, article.category_slug);
    } catch (e) {
      console.warn(`   ⚠️  Category not found for "${article.title}", skipping...`);
      continue;
    }

    await db.createDocument(DB_ID, ARTICLES_COL, ID.unique(), {
      title: article.title,
      slug: article.slug,
      author: article.author,
      source: article.source,
      source_issue: article.source_issue,
      category_id: categoryId,
      excerpt: article.excerpt,
      body: article.body,
      highlights: article.highlights,
      published_at: article.published_at,
      status: 'published',
      reading_time: article.reading_time,
      cover_image_id: '',
      tag_ids: [],
    });

    console.log(`   ✅ Seeded: ${article.title}`);
  }

  console.log('\n✨ Seeding complete!');
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });
