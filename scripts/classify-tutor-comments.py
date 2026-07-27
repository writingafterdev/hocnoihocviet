# -*- coding: utf-8 -*-
import json, re, statistics, collections
BASE='/home/user/hocnoihocviet/tmp/corpus/'
SC='/tmp/claude-0/-home-user-hocnoihocviet/55863c74-9768-5053-beb3-1291b56c65ab/scratchpad/'
essays=json.load(open(BASE+'tutor-marked-essays.json'))
extra=json.load(open(BASE+'tutor-comments-no-essay.json'))
def norm(s): return re.sub(r'\s+',' ',(s or '')).strip().lower()

PRON = {'it','its','this','these','they','their','them','that','those','such','others','he','she','his','her',
        'this perspective','such an approach','because of that','the mentioned reasons','doing it','doing so'}

NA = [r'#error!', r'\bta\s*[:：]?\s*\d', r'\bcc\s*[:：]?\s*\d', r'\bgr\s*[:：]?\s*\d', r'\blx\s*[:：]?\s*\d',
      r'\bgra\s*[:：]?\s*\d', r'breakdown', r'b[aà]i t[oố]t', r'\bword count\b', r'\bs[oố] t[uừ]\b',
      r'ch[uú]c (em|b[aạ]n)', r'good job', r'well done', r'l[aầ]n sau', r'vi[eế]t xong th[iì] ph[aả]i [dđ][oọ]c l[aạ]i',
      r'n[eế]u c[oò]n th[oờ]i gian', r'em xin', r'ch[iị] [oơ]i', r'\bdone\b']

# ---- GRA ----
GRA = [(r'ng[uữ] ph[aá]p',3), (r'thi[eế]u [dđ][oộ]ng t[uừ]',3), (r'[dđ][oộ]ng t[uừ] ch[ií]nh',3), (r'fragment',3),
 (r'comma splice',3), (r'run-?on',3), (r'thi[eế]u ch[uủ] ng[uữ]',3), (r'ch[uủ] ng[uữ]',2), (r's[oố] nhi[eề]u',3),
 (r's[oố] [ií]t',3), (r'th[iì] (qk|htd|hth|qkd|hi[eệ]n t[aạ]i|qu[aá] kh[uứ]|t[uươ]ng lai)',3),
 (r's[oở] h[uữ]u c[aá]ch',3), (r'm[eệ]nh [dđ][eề]',2), (r'\bm[dđ]qh\b',2), (r'\bmddqh\b',2), (r'\bm[dđ] qh\b',2),
 (r'[dđ][aả]o ng[uữ]',3), (r'b[iị] [dđ][oộ]ng',2), (r'ch[uủ] [dđ][oộ]ng',2), (r'c[aâ]u ph[uứ]c',2),
 (r'd[aấ]u ph[aẩ]y',3), (r'ng[aắ]t c[aâ]u',3), (r'[dđ][oồ]ng d[aạ]ng',3), (r'song song',2), (r'parallel',2),
 (r'gi[oớ]i t[uừ]',3), (r'[dđ][eế]m [dđ][uượ]c',3), (r'uncountable',3), (r'countable',3),
 (r'sau .{0,14}ph[aả]i l[aà] v',3), (r'thi[eế]u to\b',3), (r'ph[aả]i c[oó] that',3), (r'thi[eế]u that',3),
 (r'sai tr[aậ]t t[uự]',3), (r'sai th[uứ] t[uự]',3), (r'th[uứ] t[uự] t[ií]nh t[uừ]',3), (r'\bv-?ing\b',2),
 (r'r[uú]t g[oọ]n',2), (r'v nguy[eê]n th[eể]',3), (r'sai c[aấ]u tr[uú]c',3), (r'\+ ?ving',3),
 (r'[dđ]i v[oớ]i adv',3), (r'\btr[aạ]ng ng[uữ]',2), (r'sau (due to|to|that) ?\+',3),
 (r'v[eế] 1 l[aà]',2), (r'not only.{0,20}but also',2), (r'thi[eế]u v[iị] ng[uữ]',3),
 (r'sb to do sth',3), (r'2 [dđ][oộ]ng t[uừ]',3), (r'hai [dđ][oộ]ng t[uừ]',3), (r'\bs\b ph[aả]i',2),
 (r'k(h[oô]ng)? c[oó] s\b',2), (r'c[aâ]u [dđ][kđ] lo[aạ]i',3), (r'ho[aà]n ch[iỉ]nh',1),
 (r'sau ["“]?(although|because|since|due to|to)["”]?',3), (r'\bd[uù]ng verb\b',2), (r'noun \(ch[uủ] ng[uữ]\)',3),
 (r'ph[aả]i l[aà] s[oố] nhi[eề]u',3), (r'nhi[eề]u ng[uư][oờ]i',2), (r'1 ng[uư][oờ]i',2), (r'thi[eế]u [dđ][oố]i t[uượ]ng .{0,10}so s[aá]nh',3), (r'2 m[dđ]qh',2), (r'danh t[uừ] (s[oố] nhi[eề]u|[dđ][aằ]ng sau)',2)]

# ---- COHESION ----
COHE = [(r'\bt[uừ] n[oố]i',3), (r'thi[eế]u (t[uừ]|c[uụ]m t[uừ]) n[oố]i',3), (r'connector',3), (r'linking',2),
 (r'\breferen?c',3), (r'\brefer\b',3), (r'ch[uư]a li[eê]n k[eế]t',3), (r'ch[uư]a k[eế]t n[oố]i',3),
 (r'link (l[aạ]i|c[aá]i n[aà]y|back|th[eê]m)',3), (r'ch[uư]a b[aắ]t m[aạ]ch',3),
 (r'ch[uư]a c[oó] t[uừ] n[oố]i',3), (r'd[uù]ng reference',3), (r'\bon the (other|one) hand',2),
 (r'k(h[oô]ng)? [dđ][uứ]ng [dđ][aầ]u c[aâ]u',2), (r'c[aâ]u tr[uướ]c',1), (r'c[aâ]u sau',1),
 (r'n[oố]i (v[oớ]i|vs|v[sớ]) c[aâ]u',2), (r'\bkh[oô]ng kh[oớ]p v[oớ]i c[aâ]u',3),
 (r'(this|these|they|their|them|it|such|that|others)[^a-z]{0,3}(n[aà]y )?(l[aà]|[oở] [dđ][aâ]y|ch[iỉ]) ?(g[iì]|ai|c[aá]i n[aà]o)',3),
 (r'l[aà] ai\b',2), (r'l[aà] refer',3), (r'[dđ][aạ]i t[uừ]',3), (r'ttsh',2), (r'\bm[oơ] h[oồ].{0,25}(refer|n[oố]i)',3),
 (r'ch[uư]a (r[oõ]|bt) .{0,10}(this|it|they|their|these)',3), (r'signpost',3), (r'ph[aả]i l[aà] (thirdly|secondly|firstly)',3), (r'idea 2',2), (r'\bmoreover\b',1), (r'\bs[oố] th[uứ] t[uự]',2)]

# ---- COHERENCE ----
COHR=[(r'th[uứ] t[uự] (body|[dđ]o[aạ]n|c[aá]c [yý])',3), (r'[dđ][oổ]i (c[aả] )?th[uứ] t[uự]',3),
 (r'(cho|[dđ][uư]a) (l[eê]n|xu[oố]ng) ([yý]|[dđ]o[aạ]n)',3), (r'\bflow\b',3),
 (r'b[oỏ] .{0,25}(xu[oố]ng|l[eê]n) [yý]',3), (r's[aắ]p x[eế]p',2), (r'chuy[eể]n (sang|xu[oố]ng|l[eê]n)',2),
 (r'sang [yý] sau',3), (r'sang [dđ]o[aạ]n',3), (r'[dđ]o[aạ]n n[aà]y .{0,30}[dđ]o[aạ]n (kia|d[uướ]i|tr[eê]n)',2),
 (r'interleav',3), (r'nh[aả]y (qua|sang) main idea',3), (r'topic sentence l[aạ]c',3),
 (r'l[aạ]c sang d[aạ]ng',3), (r'kh[oô]ng ph[uù] h[oợ]p [dđ][aặ]t trong body',3),
 (r'[dđ]o[aạ]n tr[eê]n l[aà] counter',2), (r'[dđ]o[aạ]n d[uướ]i',1)]

# ---- TASK RESPONSE ----
TR = [(r'l[aạ]c [dđ][eề]',3), (r'irrelevant',3), (r'li[eê]n quan g[iì]',3), (r'ch[uư]a (gi[aả]i th[ií]ch|[dđ][uủ])',3),
 (r'gi[aả]i th[ií]ch (th[eê]m|r[oõ]|k[iĩ]|[dđ]i)',3), (r'thi[eế]u gi[aả]i th[ií]ch',3), (r'gthich',3),
 (r'n[oó]i r[oõ]',2), (r'ns r[oõ]',2), (r'n[eê]u r[oõ]',2), (r'ghi r[oõ]',2), (r'l[aà]m r[oõ]',3),
 (r'r[oõ] [yý] h[oơ]n',2), (r'c[uụ] th[eể]',2), (r'v[ií] d[uụ]',3), (r'\bvd\b',3), (r'\bvdu\b',3), (r'example',3),
 (r'\bdevelop',3), (r'chung chung',3), (r'quy ch[uụ]p',3), (r'hedging',3), (r'l[aậ]p lu[aậ]n',3), (r'\bll\b',2),
 (r'nh[aả]y (c[oó]c|b[uướ]c|b[aậ]c|[yý]|bc)',3), (r'thi[eế]u b[uướ]c',3), (r'thi[eế]u m[aắ]t x[ií]ch',3),
 (r'm[aắ]c x[ií]ch',3), (r's[aá]o r[oỗ]ng',3), (r'm[oở] r[oộ]ng',3), (r'thuy[eế]t ph[uụ]c',3),
 (r'[dđ][eề] b[aà]i',3), (r'main (point|idea|focus)',3), (r'topic sentence',3), (r'conclusion',3),
 (r'k[eế]t b[aà]i',3), (r'm[oở] b[aà]i',3), (r'th[eế] th[iì] sao',3), (r't[aạ]i sao',3), (r'sao l[aạ]i',2),
 (r'\bwhy\b',2), (r'\bhow ?\??',2), (r'b[aằ]ng c[aá]ch n[aà]o',3), (r'ch[uư]a s[aâ]u',3),
 (r'kh?(h[oô]ng)? h[oợ]p l[yý]',2), (r'ph[iế]n di[eệ]n',3), (r'c[uự]c [dđ]oan',3), (r'khái quát hóa',3),
 (r'overgeneral',3), (r'cherry-?pick',3), (r'v[oô] c[aă]n c[uứ]',3), (r'y[eế]u l[aậ]p lu[aậ]n',3),
 (r'l[aà]m y[eế]u',3), (r'\bmain idea',3), (r'\bl[uậ]n [dđ]i[eể]m',3), (r'\bstick to',3),
 (r'kh[oô]ng kh[oớ]p',2), (r'\bh[eệ] qu[aả]',2), (r'hi[eể]n nhi[eê]n',3), (r'\bobvious',3),
 (r'r[aà]o [dđ]i[eề]u ki[eệ]n',3), (r'thi[eế]u [dđ]i[eề]u ki[eệ]n',3), (r'[dđ][uư]a ra [dđ][kđ]',3),
 (r'undeveloped',3), (r'unsupported',3), (r'tr[uừ] (tr|ta)\b',3), (r'\bm[aà]u h[oồ]ng',3),
 (r'\bso ?\?',3), (r'\bth[eế] th[iì]',2), (r'\bv[oô] ngh[iĩ]a',2), (r'\bn[eê]u .{0,15}ra ch[uứ]',3),
 (r'\bkh[uú]c n[aà]y',1), (r'\b[dđ][aâ]u ph[aả]i',3), (r'chx h[aẳ]n',3), (r'ch[uư]a h[aẳ]n',3), (r'n[uư][oớ]c n[aà]o',3), (r'ng[aà]nh (g[iì]|n[aà]o)',3), (r'\bai\?',2), (r'l[aặ]p [yý] v[oớ]i c[aâ]u',3), (r'\bh[eế]t k\?',3), (r'\bcó .{0,20} k\?',2), (r'\bsignpost',0), (r'ch[uư]a (r[oõ]|n[oó]i r[oõ]|ch[iỉ] ra)',2), (r'l[aà] g[iì]\?',2),
 (r'l[aà] nh[uữ]ng (c[aá]i )?g[iì]',2), (r'gồm nh[uữ]ng',2), (r'\bcó bằng chứng',3),
 (r'khẳng định sai',3), (r'sai logic',3), (r'l[oỗ]i logic',3), (r'l[eệ]ch logic',3), (r'\bl[oô] ?g[ií]ch',3),
 (r'ph[aả]n b[aá]c',3), (r'\btrừ [dđ]i[eể]m',3), (r'\bopinion unsupported',3), (r'\bt[oó]m g[oọ]n',2),
 (r'\bt[oó]m t[aắ]t',2), (r'\bkh[oô]ng [dđ][uú]ng .{0,15}(m[oọ]i|t[aấ]t c[aả]|n[uư][oớ]c n[aà]o)',3)]

# ---- LEXICAL ----
LEX = [(r'collocation',3), (r'collo\b',3), (r'sai ngh[iĩ]a',3), (r'k(h[oô]ng)? h[oợ]p ngh[iĩ]a',3),
 (r'informal',3), (r'formal',3), (r'academic',2), (r'sai t[uừ]',3), (r'd[uù]ng sai t[uừ]',3),
 (r'd[uù]ng sai',2), (r'l[aặ]p t[uừ]',3), (r'better ?:',3), (r'/better',3), (r'unnatural',3),
 (r'word-?by-?word',3), (r'v[aă]n n[oó]i',3), (r'thay b[aằ]ng',3), (r't[uự] nhi[eê]n h[oơ]n',3),
 (r'kh[oô]ng t[uự] nhi[eê]n',3), (r'd[uù]ng t[uừ]',2), (r't[uừ] n[aà]y',2), (r'd[aà]i d[oò]ng',3),
 (r'r[uườ]m r[aà]',3), (r'\bwordy\b',3), (r'v[oò]ng v[oè]o',3), (r'v[oò]ng vo',3), (r'g[oợ]i [yý]',2),
 (r'suggest',2), (r'di[eễ]n [dđ][aạ]t',3), (r'\bregister\b',3), (r't[oố]i ngh[iĩ]a',3), (r'th[uừ]a\b',3),
 (r'kh?(h[oô]ng)? c[aầ]n thi[eế]t',2), (r'paraphrase',3), (r'sai ch[ií]nh t[aả]',3), (r'spelling',3),
 (r'idiomatic',3), (r'cliche',3), (r's[aắ]c th[aá]i',3), (r'ngh[iĩ]a na n[aá]',3), (r'tr[uù]ng ngh[iĩ]a',3),
 (r'l[aặ]p [yý]',3), (r'k(h[oô]ng)? ai d[uù]ng',3), (r'ng[aắ]n g[oọ]n h[oơ]n',3),
 (r'[dđ]a d[aạ]ng (t[uừ]|c[aấ]u tr[uú]c)',2), (r'nominali',3), (r'[uư]u ti[eê]n (noun|danh t[uừ])',3),
 (r'd[uù]ng nhi[eề]u danh t[uừ]',3), (r'danh t[uừ] ?> ?[dđ][oộ]ng t[uừ]',3), (r'n[eê]n d[uù]ng',2),
 (r'c[oó] th[eể] d[uù]ng',2), (r'chuy[eể]n th[aà]nh',2), (r'[dđ][oổ]i th[aà]nh',2), (r'hay h[oơ]n',2),
 (r'ok(e)? h[oơ]n',2), (r'[dđ][uú]ng h[oơ]n',2), (r'ph[uù] h[oợ]p',2), (r'\bl[aặ]p\b',2), (r'\btr[uù]ng\b',2),
 (r'vi[eế]t l[aạ]i',2), (r'\btham kh[aả]o',2), (r'\bd[uù]ng .{0,15} m[oớ]i [dđ][uú]ng',3),
 (r'kh[oô]ng [dđ]i v[oớ]i',3), (r'k [dđ]i v[oớ]i',3), (r'k[oô]ng đi vs',3), (r'k [dđ]i vs',3),
 (r'\bnghe (qu[aá]|h[oơ]i)',3), (r'v[aă]n ch[uươ]ng',3), (r'\bmore formal',3), (r'\bt[uừ] m[oơ] h[oồ]',3),
 (r'\bt[uừ] n[aà]y ngh[iĩ]a',3), (r'kh[oô]ng ph[aả]i l[aà]',1), (r'\bch[uứ] kh[oô]ng ph[aả]i',2),
 (r'\bl[aà] .{2,25} ch[uứ] (kh[oô]ng|k)',3), (r'tuy[eệ]t [dđ][oố]i',2), (r'c[aả]m t[ií]nh',2),
 (r'\bph[uạ]m vi (t[uừ]|ngh[iĩ]a)',3), (r'ngh[iĩ]a (h[eẹ]p|r[oộ]ng)',3), (r'\bqu[aá] (h[eẹ]p|r[oộ]ng)',3),
 (r'\bunclear',2), (r'kh[oô]ng r[oõ] r[aà]ng',2), (r'\bkh[oô]ng d[uù]ng trong ng[uữ] c[aả]nh',3),
 (r'ng[uữ] c[aả]nh',2)]

def sc(rxs,t): return sum(w for r,w in rxs if re.search(r,t))

def classify(anchor, comment):
    t=norm(comment); a=norm(anchor)
    if not t: return 'non_assessable','empty'
    for r in NA:
        if re.search(r,t): return 'non_assessable','admin'
    SENT=[r'c[aâ]u (n[aà]y )?(qu[aá]|h[oơ]i |[dđ]ang )?(r[aấ]t )?d[aà]i', r't[aá]ch (ra|th[aà]nh|nh[oỏ]|2|1 ?c|c[aâ]u)',
      r'ng[aắ]t (t[uừ] [dđ][aâ]y|c[aâ]u|ra)', r'chunky', r'(gh[eé]p|n[oố]i) (2|hai) c[aâ]u',
      r'(gh[eé]p|n[oố]i) l[aạ]i th[aà]nh (1|m[oộ]t) c[aâ]u', r'\btoo long\b', r'break down n[oó]',
      r'qu[aá] nhi[eề]u [yý] trong 1 c[aâ]u', r'nhi[eề]u m[eệ]nh [dđ][eề] n[oố]i nhau',
      r'2 m[dđ]qh trg c[uù]ng 1 c[aâ]u', r'kh[oó] (theo d[oõ]i|[dđ][oọ]c)', r'break down',
      r'c[aả] 1 c[aâ]u (n[aà]y )?(dài|d[aà]i)']
    if re.search(r'thi[eế]u [dđ][oộ]ng t[uừ]|[dđ][oộ]ng t[uừ] ch[ií]nh|fragment|thi[eế]u ch[uủ] ng[uữ]',t):
        return 'grammatical_range_accuracy','cue'
    if re.search(r'^\s*(better ?:|/better|vi[eế]t l[aạ]i ?:|tham kh[aả]o ?:)',t) or re.search(r'\bbetter ?:',t):
        return 'lexical_resource','rewrite'
    if any(re.search(r,t) for r in SENT):
        return 'grammatical_range_accuracy','sentence_control'
    # explicit "not a grammar problem" guard
    if re.search(r'k(h[oô]ng)? sai (v[eề] m[aặ]t )?ng[uữ] ph[aá]p', t):
        return 'lexical_resource','not_grammar_guard'
    s={'grammatical_range_accuracy':sc(GRA,t),'cohesion':sc(COHE,t),'coherence':sc(COHR,t),
       'task_response':sc(TR,t),'lexical_resource':sc(LEX,t)}
    # pronoun-anchor boost for cohesion
    if a in PRON or (len(a.split())<=3 and a.split() and a.split()[0] in PRON):
        if re.search(r'(l[aà] (g[iì]|ai|c[aá]i n[aà]o)|ch[uư]a r[oõ]|m[oơ] h[oồ]|kh[oô]ng r[oõ]|ko r[oõ]|chx r[oõ]|thu[oộ]c v[eề] ai|ch[iỉ] ai|refer)',t):
            s['cohesion'] += 4
    best=max(s.values())
    if best==0:
        return ('task_response' if len(a.split())>=15 else 'lexical_resource'),'fallback'
    order=['coherence','cohesion','grammatical_range_accuracy','task_response','lexical_resource']
    for k in order:
        if s[k]==best: return k,'cue'

rows=[]
for ei,e in enumerate(essays):
    for c in e['comments']:
        cr,how=classify(c.get('anchoredText',''),c.get('comment',''))
        rows.append(dict(e=ei,a=c.get('anchoredText','') or '',c=c.get('comment','') or '',crit=cr,how=how,src='main'))
for c in extra:
    cr,how=classify(c.get('anchoredText','') or '',c.get('comment','') or '')
    rows.append(dict(e=-1,a=c.get('anchoredText','') or '',c=c.get('comment','') or '',crit=cr,how=how,src='extra'))
json.dump(rows,open(SC+'rows.json','w'),ensure_ascii=False)
main=[r for r in rows if r['src']=='main']
cnt=collections.Counter(r['crit'] for r in main)
print('MAIN n=',len(main))
for k,v in cnt.most_common(): print(f'  {k:30s} {v:4d} {100*v/len(main):5.1f}%')
print('fallback:',sum(1 for r in main if r['how']=='fallback'))
