// TiengAnhKhong UI Kit — shared data and sub-components
// Loaded by index.html as a Babel script

const SAMPLE_ESSAY = `In today's rapidly changing world, many people believe that governments should invest more in public transportation rather than road infrastructure. While there are valid arguments on both sides, I strongly agree that prioritising public transport leads to greater long-term benefits for society.

To begin with, expanding public transportation significantly reduces traffic congestion in urban areas. When more commuters switch from private cars to buses and trains, the number of vehicles on the road decreases substantially. For example, cities such as Singapore and Tokyo have demonstrated that well-funded metro systems can move millions of passengers daily with minimal road congestion.

Furthermore, public transport is far more environmentally sustainable than road-based travel. A single bus can replace up to 40 private vehicles, leading to dramatic reductions in carbon emissions and air pollution. Given the urgent need to address climate change, governments have a responsibility to fund greener alternatives.

However, opponents argue that road infrastructure is essential for economic activity, particularly in rural areas where public transport is impractical. Goods must be transported by truck, and residents in remote communities rely entirely on personal vehicles. This is a legitimate concern, and a balanced approach — funding both systems — may be more realistic in practice.

In conclusion, while road infrastructure remains important, the environmental and social benefits of public transport make it the more worthwhile investment for modern governments. Strategic funding of interconnected rail and bus networks will serve the public interest for generations to come.`;

const ANNOTATIONS = [
  { start: 0, end: 3, text: 'rapidly changing world', type: 'LR', note: 'Overused collocation. Try "an era of rapid change" or "our accelerating world".' },
  { start: 4, end: 5, text: 'many people believe', type: 'TA', note: 'Vague attribution. Specify "urban planners" or "transport economists" for precision.' },
  { start: 6, end: 7, text: 'While there are valid arguments on both sides', type: 'CC', note: 'Formulaic concession. Consider integrating your counter-argument more naturally.' },
  { start: 10, end: 12, text: 'significantly reduces', type: 'GRA', note: 'Adverb placement is correct. Good use of present-tense generalisation.' },
];

const ESSAYS = [
  { id: 1, title: 'Public transport vs road infrastructure', task: 'Task 2', date: '14 Jun 2026', words: 287, overall: 7.0, TA: 7.0, CC: 6.5, LR: 7.5, GRA: 7.0 },
  { id: 2, title: 'The rise of remote work and its effects', task: 'Task 2', date: '8 Jun 2026', words: 312, overall: 6.5, TA: 6.5, CC: 6.0, LR: 6.5, GRA: 7.0 },
  { id: 3, title: 'Should zoos be banned?', task: 'Task 2', date: '1 Jun 2026', words: 256, overall: 6.0, TA: 6.0, CC: 5.5, LR: 6.5, GRA: 6.0 },
];

function ScoreBadge({ score }) {
  const color = score >= 7 ? '#3D7A5B' : score >= 5.5 ? '#8B6325' : '#8B3A35';
  const bg    = score >= 7 ? '#EEF4F0' : score >= 5.5 ? '#F7F1E6' : '#F5EDED';
  return React.createElement('span', {
    style: {
      fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500,
      padding: '3px 8px', borderRadius: '4px', background: bg, color,
      border: `1px solid ${color}30`,
    }
  }, score.toFixed(1));
}

function Tag({ criterion }) {
  const map = {
    TA:  { bg:'#EDF2F8', fg:'#2B5394', label:'Task Achievement' },
    CC:  { bg:'#F0EDF8', fg:'#4A2B94', label:'Coherence & Cohesion' },
    LR:  { bg:'#EDF8F2', fg:'#2B6644', label:'Lexical Resource' },
    GRA: { bg:'#F8F2ED', fg:'#7A3D1A', label:'Grammar' },
  };
  const c = map[criterion];
  return React.createElement('span', {
    style: {
      fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500,
      letterSpacing: '0.04em', padding: '2px 7px', borderRadius: '3px',
      background: c.bg, color: c.fg, whiteSpace: 'nowrap',
    }
  }, criterion);
}

function MiniRing({ score, label, size = 64 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const prog = (score / 9) * circ;
  const color = score >= 7 ? '#3D7A5B' : score >= 5.5 ? '#8B6325' : '#8B3A35';
  const cx = size / 2, cy = size / 2;
  return React.createElement('div', { style: { display:'flex', flexDirection:'column', alignItems:'center', gap: 4 } },
    React.createElement('svg', { width: size, height: size, viewBox:`0 0 ${size} ${size}`, style:{ transform:'rotate(-90deg)' } },
      React.createElement('circle', { cx, cy, r, fill:'none', stroke:'#E6E3D8', strokeWidth: 4 }),
      React.createElement('circle', { cx, cy, r, fill:'none', stroke: color, strokeWidth: 4, strokeLinecap:'round', strokeDasharray:`${prog} ${circ}` }),
      React.createElement('text', { x:cx, y:cy, textAnchor:'middle', dominantBaseline:'central', fill: color, fontFamily:'var(--font-mono)', fontSize: size*0.22, fontWeight: 500, style:{ transform:`rotate(90deg)`, transformOrigin:`${cx}px ${cy}px`} }, score.toFixed(1)),
    ),
    React.createElement('span', { style:{ fontFamily:'var(--font-sans)', fontSize:'10px', color:'var(--text-tertiary)', textAlign:'center', lineHeight:1.2, maxWidth: size } }, label),
  );
}

Object.assign(window, { SAMPLE_ESSAY, ANNOTATIONS, ESSAYS, ScoreBadge, Tag: Tag, MiniRing });
