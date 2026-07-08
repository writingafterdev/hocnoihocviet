// TiengAnhKhong UI Kit — screen views
// Requires shared.jsx to be loaded first

function Sidebar({ view, setView }) {
  const navItems = [
    { id:'dashboard', label:'Essays' },
    { id:'submit',    label:'New essay' },
    { id:'feedback',  label:'Feedback' },
  ];
  return React.createElement('nav', {
    style: {
      width: 220, flexShrink: 0, background: '#F2F0E9', borderRight: '1px solid #DEDAD0',
      display: 'flex', flexDirection: 'column', padding: '28px 0',
      height: '100vh', position: 'sticky', top: 0,
    }
  },
    React.createElement('div', { style:{ padding:'0 24px 28px', borderBottom:'1px solid #DEDAD0' } },
      React.createElement('div', { style:{ fontFamily:'var(--font-serif)', fontSize:'18px', fontWeight:500, color:'var(--text-primary)', letterSpacing:'-0.01em' } }, 'tienganhkhong'),
      React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'11px', color:'var(--text-tertiary)', marginTop:2, letterSpacing:'0.04em' } }, 'IELTS Writing Feedback'),
    ),
    React.createElement('div', { style:{ padding:'16px 12px', flex:1 } },
      navItems.map(item =>
        React.createElement('button', {
          key: item.id,
          onClick: () => setView(item.id),
          style: {
            display:'block', width:'100%', textAlign:'left',
            padding:'8px 12px', borderRadius:'6px', border:'none',
            fontFamily:'var(--font-sans)', fontSize:'14px', fontWeight: view===item.id ? 500 : 400,
            color: view===item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            background: view===item.id ? '#FFFFFF' : 'transparent',
            cursor:'pointer', marginBottom:2,
            boxShadow: view===item.id ? '0 1px 3px rgba(20,20,19,0.08)' : 'none',
            transition:'all 150ms',
          }
        }, item.label)
      )
    ),
    React.createElement('div', { style:{ padding:'0 24px', borderTop:'1px solid #DEDAD0', paddingTop:16 } },
      React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'12px', color:'var(--text-tertiary)' } }, 'Minh Anh Nguyen'),
      React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'11px', color:'var(--text-tertiary)', opacity:0.7 } }, 'Target: Band 7.0'),
    )
  );
}

function DashboardView({ setView }) {
  return React.createElement('main', { style:{ flex:1, padding:'48px 56px', overflowY:'auto', maxWidth:860 } },
    React.createElement('div', { style:{ marginBottom:40 } },
      React.createElement('h1', { style:{ fontFamily:'var(--font-serif)', fontSize:'28px', fontWeight:500, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:6 } }, 'Your essays'),
      React.createElement('p', { style:{ fontFamily:'var(--font-sans)', fontSize:'15px', color:'var(--text-secondary)' } }, '3 submissions · Target band 7.0'),
    ),
    React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:12 } },
      ESSAYS.map(essay =>
        React.createElement('div', {
          key: essay.id,
          onClick: () => setView('feedback'),
          style: {
            background:'#FFFFFF', border:'1px solid #DEDAD0', borderRadius:'10px',
            padding:'20px 24px', cursor:'pointer', display:'flex', alignItems:'center', gap:24,
            transition:'border-color 150ms',
          },
          onMouseEnter: e => e.currentTarget.style.borderColor='#A9A494',
          onMouseLeave: e => e.currentTarget.style.borderColor='#DEDAD0',
        },
          React.createElement('div', { style:{ flex:1 } },
            React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'15px', fontWeight:500, color:'var(--text-primary)', marginBottom:4 } }, essay.title),
            React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'12px', color:'var(--text-tertiary)', display:'flex', gap:12 } },
              React.createElement('span', null, essay.task),
              React.createElement('span', null, essay.date),
              React.createElement('span', null, `${essay.words} words`),
            )
          ),
          React.createElement('div', { style:{ display:'flex', gap:20, alignItems:'center' } },
            ['TA','CC','LR','GRA'].map(c =>
              React.createElement('div', { key:c, style:{ textAlign:'center' } },
                React.createElement('div', { style:{ fontFamily:'var(--font-mono)', fontSize:'13px', fontWeight:500, color:'var(--text-secondary)' } }, essay[c].toFixed(1)),
                React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'9px', color:'var(--text-tertiary)', letterSpacing:'0.04em' } }, c),
              )
            ),
            React.createElement('div', { style:{ width:1, height:32, background:'#DEDAD0', marginLeft:4 } }),
            React.createElement(ScoreBadge, { score: essay.overall }),
          )
        )
      )
    ),
    React.createElement('button', {
      onClick: () => setView('submit'),
      style: {
        marginTop:24, fontFamily:'var(--font-sans)', fontSize:'14px', fontWeight:500,
        background:'#141413', color:'#FAF9F5', border:'none', borderRadius:'8px',
        padding:'10px 20px', cursor:'pointer',
      }
    }, '+ New essay'),
  );
}

function SubmitView({ setView }) {
  const [text, setText] = React.useState('');
  const [task, setTask] = React.useState('Task 2');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return React.createElement('main', { style:{ flex:1, padding:'48px 56px', maxWidth:780, overflowY:'auto' } },
    React.createElement('h1', { style:{ fontFamily:'var(--font-serif)', fontSize:'28px', fontWeight:500, letterSpacing:'-0.02em', marginBottom:6 } }, 'Submit an essay'),
    React.createElement('p', { style:{ fontFamily:'var(--font-sans)', fontSize:'15px', color:'var(--text-secondary)', marginBottom:32 } }, 'Paste your IELTS writing and receive structured feedback.'),

    React.createElement('div', { style:{ display:'flex', gap:8, marginBottom:24 } },
      ['Task 1','Task 2'].map(t =>
        React.createElement('button', {
          key: t, onClick:()=>setTask(t),
          style:{
            fontFamily:'var(--font-sans)', fontSize:'13px', fontWeight: task===t ? 500 : 400,
            padding:'6px 14px', borderRadius:'6px', cursor:'pointer',
            background: task===t ? '#141413' : 'transparent',
            color: task===t ? '#FAF9F5' : 'var(--text-secondary)',
            border: task===t ? '1px solid #141413' : '1px solid #DEDAD0',
            transition:'all 150ms',
          }
        }, t)
      )
    ),

    React.createElement('div', { style:{ position:'relative' } },
      React.createElement('textarea', {
        placeholder: 'Paste or type your essay here…',
        value: text,
        onChange: e => setText(e.target.value),
        rows: 16,
        style: {
          width:'100%', fontFamily:'var(--font-sans)', fontSize:'15px', lineHeight:'1.7',
          color:'var(--text-primary)', background:'#FFFFFF', border:'1px solid #DEDAD0',
          borderRadius:'10px', padding:'20px', resize:'vertical', outline:'none',
          transition:'border-color 150ms',
        },
        onFocus: e => e.target.style.borderColor='#141413',
        onBlur:  e => e.target.style.borderColor='#DEDAD0',
      }),
      React.createElement('div', { style:{ position:'absolute', bottom:12, right:16, fontFamily:'var(--font-mono)', fontSize:'12px', color: words < 150 ? '#8B3A35' : words >= 250 ? '#3D7A5B' : '#8B6325' } },
        `${words} words`
      ),
    ),
    React.createElement('div', { style:{ marginTop:8, fontFamily:'var(--font-sans)', fontSize:'12px', color:'var(--text-tertiary)' } },
      task === 'Task 2' ? 'Minimum 250 words recommended.' : 'Minimum 150 words recommended.',
    ),
    React.createElement('div', { style:{ display:'flex', gap:12, marginTop:24 } },
      React.createElement('button', {
        onClick: () => setView('feedback'),
        style:{ fontFamily:'var(--font-sans)', fontSize:'14px', fontWeight:500, background:'#141413', color:'#FAF9F5', border:'none', borderRadius:'8px', padding:'11px 24px', cursor:'pointer' }
      }, 'Analyse essay'),
      React.createElement('button', {
        style:{ fontFamily:'var(--font-sans)', fontSize:'14px', color:'var(--text-secondary)', background:'transparent', border:'1px solid #DEDAD0', borderRadius:'8px', padding:'11px 20px', cursor:'pointer' }
      }, 'Save draft'),
    )
  );
}

function FeedbackView() {
  const essay = ESSAYS[0];
  const [activeAnnotation, setActiveAnnotation] = React.useState(null);
  const [openSection, setOpenSection] = React.useState('TA');

  const criteriaDetail = {
    TA:  { score: essay.TA,  label:'Task Achievement',        summary:'Your position is clear and consistent. All parts of the task are addressed, though supporting examples could be more specific and less generic.', suggestions:['Avoid phrases like "many people believe" — be more specific about who.','Extend your second argument with a concrete statistic or named example.','Your conclusion restates the position well but adds little new insight.'] },
    CC:  { score: essay.CC,  label:'Coherence & Cohesion',    summary:'Paragraphs are logically sequenced. Cohesive devices are used but sometimes feel mechanical — especially "Furthermore" and "To begin with".', suggestions:['Vary your discourse markers: try "This pattern is also visible in…" or "A further implication…"','Paragraph 4 shifts topic abruptly. Add a bridging sentence.'] },
    LR:  { score: essay.LR,  label:'Lexical Resource',        summary:'Vocabulary is generally varied and appropriate. A few overused collocations reduce the range. Paraphrasing of task keywords is effective.', suggestions:['"rapidly changing world" is overused — substitute a more specific phrase.','Good use of "substantially", "sustainable", and "strategic".','Avoid repeating "public transport" — use "mass transit" or "collective mobility".'] },
    GRA: { score: essay.GRA, label:'Grammatical Range & Accuracy', summary:'Range includes complex sentences, relative clauses, and passive voice. Some errors in article usage and subject-verb agreement.', suggestions:['Check: "A single bus can replace up to 40 private vehicles" — this is correct, but "up to 40" is quite vague.','Consistent and accurate tense use throughout.','One minor comma splice in paragraph 3.'] },
  };

  return React.createElement('main', { style:{ flex:1, display:'flex', overflowY:'auto' } },
    // Essay panel
    React.createElement('div', { style:{ flex:'0 0 52%', padding:'40px 40px 40px 48px', borderRight:'1px solid #DEDAD0', overflowY:'auto' } },
      React.createElement('div', { style:{ marginBottom:24 } },
        React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'11px', color:'var(--text-tertiary)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 } }, 'Task 2 · 287 words · 14 Jun 2026'),
        React.createElement('h2', { style:{ fontFamily:'var(--font-serif)', fontSize:'20px', fontWeight:500, letterSpacing:'-0.01em', color:'var(--text-primary)' } }, essay.title),
      ),
      React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'15px', lineHeight:'1.75', color:'var(--text-primary)', whiteSpace:'pre-wrap' } },
        SAMPLE_ESSAY
      ),
      React.createElement('div', { style:{ marginTop:24, padding:'14px 16px', background:'#F7F1E6', borderRadius:'8px', border:'1px solid #E2C9BF' } },
        React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'12px', fontWeight:500, color:'#7A3D1A', marginBottom:4 } }, 'Annotation preview'),
        React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'13px', color:'#5C2F10' } }, '"rapidly changing world" — Overused collocation. Try "an era of rapid change".'),
      ),
    ),
    // Score panel
    React.createElement('div', { style:{ flex:1, padding:'40px 36px', overflowY:'auto', background:'#FAF9F5' } },
      React.createElement('div', { style:{ display:'flex', gap:20, alignItems:'center', marginBottom:36, paddingBottom:24, borderBottom:'1px solid #DEDAD0' } },
        React.createElement(MiniRing, { score: essay.overall, label:'Overall', size:88 }),
        React.createElement('div', null,
          React.createElement('div', { style:{ fontFamily:'var(--font-serif)', fontSize:'22px', fontWeight:500, color:'var(--text-primary)', letterSpacing:'-0.01em' } }, `Band ${essay.overall.toFixed(1)}`),
          React.createElement('div', { style:{ fontFamily:'var(--font-sans)', fontSize:'13px', color:'var(--text-secondary)', marginTop:3, lineHeight:1.5 } }, 'Good range of vocabulary.\nArguments clear, evidence could be stronger.'),
        ),
      ),
      React.createElement('div', { style:{ display:'flex', gap:12, marginBottom:32 } },
        Object.entries(criteriaDetail).map(([key, c]) =>
          React.createElement(MiniRing, { key, score: c.score, label: key, size: 58 })
        )
      ),
      React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:8 } },
        Object.entries(criteriaDetail).map(([key, c]) =>
          React.createElement('div', { key, style:{ border:'1px solid #DEDAD0', borderRadius:'8px', overflow:'hidden', background:'#FFFFFF' } },
            React.createElement('button', {
              onClick: () => setOpenSection(openSection===key ? null : key),
              style: {
                width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'12px 16px', background:'none', border:'none', cursor:'pointer',
                fontFamily:'var(--font-sans)', fontSize:'13px', fontWeight:500, color:'var(--text-primary)',
              }
            },
              React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:10 } },
                React.createElement(Tag, { criterion: key }),
                React.createElement('span', null, c.label),
              ),
              React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:8 } },
                React.createElement(ScoreBadge, { score: c.score }),
                React.createElement('span', { style:{ color:'var(--text-tertiary)', fontSize:'12px' } }, openSection===key ? '▲' : '▼'),
              )
            ),
            openSection===key && React.createElement('div', { style:{ padding:'0 16px 16px', borderTop:'1px solid #F2F0E9' } },
              React.createElement('p', { style:{ fontFamily:'var(--font-sans)', fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6, margin:'12px 0 12px' } }, c.summary),
              React.createElement('ul', { style:{ margin:0, paddingLeft:16, display:'flex', flexDirection:'column', gap:6 } },
                c.suggestions.map((s,i) =>
                  React.createElement('li', { key:i, style:{ fontFamily:'var(--font-sans)', fontSize:'13px', color:'var(--text-primary)', lineHeight:1.5 } }, s)
                )
              )
            )
          )
        )
      )
    )
  );
}

Object.assign(window, { Sidebar, DashboardView, SubmitView, FeedbackView });
