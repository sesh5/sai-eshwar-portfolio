(function(){
  /* Free-text answers are served by the `portfolio-ask` Supabase Edge Function
     (same project as NourishAI): Claude Haiku grounded in Sai's profile.
     The Anthropic key stays server-side; if the endpoint is unreachable the
     shell falls back to its built-in knowledge engine. */
  const AI_ENDPOINT='https://yxmcllgodbovhumujfkf.supabase.co/functions/v1/portfolio-ask';

  const overlay=document.getElementById('cliOverlay');
  const body=document.getElementById('cliBody');
  const input=document.getElementById('cliInput');
  let booted=false, busy=false;
  const hist=[]; let histIdx=-1;

  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function line(html,cls){
    const el=document.createElement('div');
    el.className='cli-line'+(cls?' '+cls:'');
    el.innerHTML=html;
    body.appendChild(el);
    body.scrollTop=body.scrollHeight;
    return el;
  }
  const gap=()=>line('','cli-gap');

  function chips(){
    const wrap=document.createElement('div');
    wrap.className='cli-chips';
    [['/whoami','the short answer'],['/projects','things he shipped'],['/experience','where he worked'],['/certs','proof on paper'],['/contact','ways to reach him'],['/help','all commands']]
      .forEach(([cmd,hint])=>{
        const b=document.createElement('button');
        b.className='cli-chip';
        b.innerHTML='<b>'+cmd+'</b> '+hint;
        b.onclick=()=>{ if(!busy){ input.value=cmd; submit(); } };
        wrap.appendChild(b);
      });
    body.appendChild(wrap);
    body.scrollTop=body.scrollHeight;
  }

  function boot(){
    line('<span class="c-txt">sai.cli</span> <span class="c-dim">v1.0.0</span>');
    line('<span class="c-dim">portfolio shell &middot; session '+Math.random().toString(36).slice(2,8)+'</span>');
    line('<span class="c-dim">~/sai-eshwar &middot; singapore</span>');
    gap();
    line('<span class="c-acc">psst</span>, I answer questions about Sai: his work, projects, certs, and when he can start. Try a chip below or just type.');
    chips();
  }

  function open(){
    overlay.classList.add('open');
    document.body.style.overflow='hidden';
    if(!booted){ boot(); booted=true; }
    setTimeout(()=>input.focus(),40);
  }
  function close(){
    overlay.classList.remove('open');
    document.body.style.overflow='';
  }

  /* ---------- knowledge ---------- */
  const LINKS={
    mail:'<a href="mailto:seshwarsai@gmail.com">seshwarsai@gmail.com</a>',
    li:'<a href="https://linkedin.com/in/sai-eshwar-s-b529931bb" target="_blank" rel="noopener">linkedin.com/in/sai-eshwar-s</a>',
    pub:'<a href="https://doi.org/10.1007/s43926-025-00226-1" target="_blank" rel="noopener">doi.org/10.1007/s43926-025-00226-1</a>',
    pub2:'<a href="https://doi.org/10.1134/S106373972660007X" target="_blank" rel="noopener">doi.org/10.1134/S106373972660007X</a>'
  };
  const CMDS={
    help:[
      '<span class="c-acc">commands</span>',
      '<span class="c-txt">/whoami</span>      who Sai is, in one screen',
      '<span class="c-txt">/projects</span>    everything he shipped',
      '<span class="c-txt">/experience</span>  Everstage &middot; University of Cyprus',
      '<span class="c-txt">/certs</span>       AWS &times;3 &middot; CSM &middot; Tech for PM',
      '<span class="c-txt">/education</span>   NUS MSc (in progress) &middot; B.E. ECE, first class with distinction',
      '<span class="c-txt">/publications</span> Springer Nature 2025 &middot; Russian Microelectronics 2026',
      '<span class="c-txt">/leadership</span>  NSS &middot; INVENTE &middot; INSTINCTS',
      '<span class="c-txt">/contact</span>     hire him',
      '<span class="c-txt">/clear</span>       wipe the screen &middot; <span class="c-txt">/exit</span> close',
      '',
      '<span class="c-dim">or skip the commands and just ask: &ldquo;what’s NourishAI?&rdquo;, &ldquo;why product management?&rdquo;, &ldquo;biggest impact?&rdquo;</span>'
    ],
    whoami:[
      '<span class="c-acc">Sai Eshwar</span> <span class="c-dim">&middot; product &middot; ai &middot; data &middot; NUS Singapore</span>',
      '',
      'Currently pursuing an <span class="c-txt">MSc in Management of Technology and Innovation</span> at NUS. Previously Senior Solution &amp; CX Specialist at <span class="c-txt">Everstage</span> (B2B SaaS, sales compensation, May 2024 &ndash; Jun 2026): owned enterprise implementations end to end: $500K+ ARR accounts, configurations touching 1,000+ payees per org, while the business scaled $5M &rarr; $10M ARR.',
      '',
      'Builder on the side: 10 shipped projects across AI, automation and data (<span class="c-txt">/projects</span>). Published researcher: two peer-reviewed journal papers (Springer Nature 2025, Russian Microelectronics 2026). AWS Certified AI Practitioner, Cloud Practitioner &amp; Machine Learning Engineer &ndash; Associate, Certified ScrumMaster&reg;, HelloPM Tech for PM.',
      '',
      '<span class="c-dim">Operating principle: find the friction people quietly live with, build the fix, measure what changed.</span>',
      '',
      '<span class="c-acc">available</span> credit-bearing internships, December 2026 to December 2027: Product Management, Data Analyst, Business Analyst. <span class="c-txt">/contact</span>'
    ],
    projects:[
      '<span class="c-acc">shipped</span> <span class="c-dim">&middot; ask about any of them by name</span>',
      '',
      '<span class="c-txt">PM Job Simulation</span> <span class="c-dim">Forage, 2026</span>: KPI selection and a 7-step stakeholder-deck plan for a mobile game losing players.',
      '<span class="c-txt">NourishAI</span> <span class="c-dim">2026</span>: food search that understands &ldquo;high-protein, under 500 cal, not fried&rdquo;. Claude + Supabase Edge Functions.',
      '<span class="c-txt">TN Election 2026 teardown</span> <span class="c-dim">2026</span>: 8,000+ ECI rows &rarr; the story of 163/234 seats flipping.',
      '<span class="c-txt">AI Voice Agent</span> <span class="c-dim">2025</span>: L1 support calls answered autonomously. ElevenLabs + RAG.',
      '<span class="c-txt">Fathom &times; Freshdesk</span> <span class="c-dim">2025</span>: zero-touch call documentation via N8N.',
      '<span class="c-txt">Content Arena</span> <span class="c-dim">2025</span>: YouTube competitor intel with normalised engagement signals.',
      '<span class="c-txt">Smart Granary System</span> <span class="c-dim">2024</span>: temperature/CO2 threshold monitoring to cut grain storage losses.',
      '<span class="c-txt">Posture Correcting Device</span> <span class="c-dim">2024</span>: Arduino Nano wearable that vibration-alerts on bad posture.',
      '<span class="c-txt">IoV Security / ASCON</span> <span class="c-dim">2023-24</span>: 99.95% DoS detection; became a Springer Nature paper.',
      '<span class="c-txt">Federated Learning, D2D</span> <span class="c-dim">2023</span>: research internship, University of Cyprus.',
      '<span class="c-txt">Crop Yield Predictor</span> <span class="c-dim">2023</span>: Random Forest at 98% validation accuracy.'
    ],
    experience:[
      '<span class="c-acc">experience</span>',
      '',
      '<span class="c-txt">Everstage Technologies</span> <span class="c-dim">&middot; Sr. Solution &amp; CX Specialist &middot; May 2024 &rarr; Jun 2026 &middot; Chennai</span>',
      '&#9657; End-to-end owner of enterprise comp implementations: $500K+ ARR clients, 1,000+ payees per org, primary liaison for international stakeholders.',
      '&#9657; Grew with the business as it scaled <span class="c-txt">$5M &rarr; $10M ARR</span>.',
      '&#9657; SQL + Python over Salesforce/HubSpot/Stripe data to find comp logic gaps; Apache Superset dashboards for MRR, CAC, TCV, quota attainment.',
      '&#9657; The bridge between product, engineering and customer success.',
      '',
      '<span class="c-txt">University of Cyprus</span> <span class="c-dim">&middot; Research Intern (onsite) &middot; Jun-Aug 2023 &middot; Nicosia</span>',
      '&#9657; Federated learning / distributed ML for D2D transmission mode selection; NS3 simulation, clustering, neural network in Python.'
    ],
    certs:[
      '<span class="c-acc">certifications</span> <span class="c-dim">&middot; all independently verifiable</span>',
      '',
      '<span class="c-txt">AWS Certified AI Practitioner</span> <span class="c-dim">2026</span>: <a href="https://www.credly.com/badges/a8e058bc-98f3-436e-8871-6b1605e75144/public_url" target="_blank" rel="noopener">Credly &#8599;</a>',
      '<span class="c-txt">Certified ScrumMaster&reg; (CSM)</span> <span class="c-dim">2026, active through 2028 &middot; ID 001835325</span>: <a href="https://www.scrumalliance.org/members/search" target="_blank" rel="noopener">Scrum Alliance &#8599;</a>',
      '<span class="c-txt">AWS Certified Cloud Practitioner</span> <span class="c-dim">2026</span>: <a href="https://www.credly.com/badges/c7dfbae0-b392-4c11-82e8-4fca44d26d8f/public_url" target="_blank" rel="noopener">Credly &#8599;</a>',
      '<span class="c-txt">Tech for PM</span> <span class="c-dim">HelloPM, 2026</span>: <a href="https://hellopm.co/certificate/?certificate_id=SJHMZV" target="_blank" rel="noopener">certificate &#8599;</a>',
      '<span class="c-txt">AWS Certified Machine Learning Engineer &ndash; Associate</span> <span class="c-dim">2026</span>: <a href="https://www.credly.com/badges/e38b7429-5690-4ea4-a306-36b3cab20553/public_url" target="_blank" rel="noopener">Credly &#8599;</a>'
    ],
    education:[
      '<span class="c-acc">education</span>',
      '',
      '<span class="c-txt">M.Sc. Management of Technology and Innovation</span> <span class="c-dim">&middot; National University of Singapore &middot; Aug 2026</span>',
      '&#9657; In progress.',
      '',
      '<span class="c-txt">B.E. Electronics &amp; Communication Engineering</span> <span class="c-dim">&middot; SSN College of Engineering &middot; 2020-2024</span>',
      '&#9657; CGPA 8.915/10: first class with distinction. Coursework: ML, computer vision, networks, network security.',
      '',
      '<span class="c-txt">Class 12, CBSE</span> <span class="c-dim">&middot; PSBB Sr. Sec. School, Chennai &middot; 95.2%</span>'
    ],
    publication:[
      '<span class="c-acc">publications</span> <span class="c-dim">&middot; two peer-reviewed journal papers</span>',
      '',
      '<span class="c-txt">&ldquo;Quantum-Resistant Microelectronic Cryptography for Securing Vehicular Networks&rdquo;</span>',
      '<span class="c-dim">Russian Microelectronics, vol. 55 no. 1 &middot; Pleiades Publishing (Springer Nature) &middot; Scopus indexed &middot; 2026</span>',
      LINKS.pub2,
      '',
      '<span class="c-txt">&ldquo;Improving Security in 5G Vehicular Networks Using ASCON and Machine Learning based NIDS&rdquo;</span>',
      '<span class="c-dim">Discover Internet of Things &middot; Springer Nature &middot; open access &middot; 2025</span>',
      LINKS.pub
    ],
    leadership:[
      '<span class="c-acc">leadership &amp; volunteering</span>',
      '',
      '&#9657; <span class="c-txt">NSS</span>: led a campus-wide health &amp; hygiene campaign reaching 200+ people; coordinated a beach-cleaning drive.',
      '&#9657; <span class="c-txt">INVENTE 6.0</span>: event supervisor; team of 10, flagship technical event, 150+ participants.',
      '&#9657; <span class="c-txt">INSTINCTS 2023</span>: organising committee for SSN’s annual cultural fest.'
    ],
    contact:[
      '<span class="c-acc">reach him</span> <span class="c-dim">&middot; email is fastest</span>',
      '<span class="c-dim">open to credit-bearing internships, Dec 2026 to Dec 2027 &middot; PM &middot; data analyst &middot; business analyst</span>',
      '',
      '&#9993;  '+LINKS.mail,
      'in  '+LINKS.li,
      '&#8595;  <a href="Sai_Eshwar_Resume.pdf" download>Sai_Eshwar_Resume.pdf</a>'
    ]
  };
  CMDS.publications=CMDS.publication;

  const TOPICS=[
    {k:['nourish','food','calorie','dish','swiggy','zomato','menu'],a:[
      '<span class="c-acc">NourishAI</span> <span class="c-dim">2026 &middot; ai search &middot; supabase</span>',
      '',
      '<span class="c-txt">Problem</span>: you can’t search Swiggy/Zomato by &ldquo;high-protein, under 500 cal, not fried&rdquo;; restaurant menus have no nutrition data at all.',
      '<span class="c-txt">Approach</span>: manufactured the missing data layer with a Generate &rarr; Enrich &rarr; Load LLM pipeline into Supabase Postgres, then a Supabase Edge Function: parseIntent() sends the sentence to Claude Haiku, gets structured rules back, runSearch() filters and ranks dishes. The API key never touches the browser.',
      '<span class="c-txt">Outcome</span>: type a craving in plain English, get ranked dish cards with calories, macros and tags.']},
    {k:['election','tamil','nadu','constituenc','codebasics','eci'],a:[
      '<span class="c-acc">Decoding the 2026 TN Election</span> <span class="c-dim">2026 &middot; data storytelling</span>',
      '',
      'Cleaned and reconciled candidate-level ECI results for all 234 constituencies across two cycles (8,000+ rows) in Python, then computed seat flips, vote-share swings and margins.',
      'Headline: <span class="c-txt">163 of 234 seats (69.7%) flipped party</span>; a new entrant took 35.1% of the statewide vote. Shipped 7 charts + an 11-slide stakeholder deck.']},
    {k:['voice','elevenlabs','call','support agent','l1','tier'],a:[
      '<span class="c-acc">AI Voice Agent for L1 Support</span> <span class="c-dim">2025 &middot; ElevenLabs &times; N8N</span>',
      '',
      'Built a voice agent that answers Tier-1 support calls autonomously: knowledge base curated from scratch, RAG pipeline grounding every answer in real product info. Cut inbound call volume and freed humans for calls needing judgment.']},
    {k:['fathom','freshdesk','n8n','webhook','automation','pipeline'],a:[
      '<span class="c-acc">Fathom &times; Freshdesk automation</span> <span class="c-dim">2025 &middot; N8N</span>',
      '',
      'Zero-touch pipeline: a call ends &rarr; webhook fires &rarr; the AI summary and recording land in the matching Freshdesk ticket, with conditional routing for edge cases. Post-call documentation became fully automatic.']},
    {k:['granary','grain','co2','storage','temperature threshold'],a:[
      '<span class="c-acc">Smart Granary System</span> <span class="c-dim">2024 &middot; iot &middot; embedded sensors</span>',
      '',
      'Tracks temperature and CO2 against defined thresholds to keep stored grain in optimal condition, catching the conditions that cause spoilage before manual monitoring ever would: reducing losses and cutting the monitoring effort down to near zero.']},
    {k:['posture','arduino','nano','gyroscope','accelerometer','wearable','vibration'],a:[
      '<span class="c-acc">Posture Correcting Device</span> <span class="c-dim">2024 &middot; arduino nano &middot; embedded c</span>',
      '',
      'A wearable built around an Arduino Nano with accelerometer and gyroscope sensors, monitoring spinal alignment in real time. Embedded C detects deviations from correct posture and triggers a vibration motor to alert the wearer: compact, low-power, designed for continuous use.']},
    {k:['arena','rival','youtube','creator','competitor'],a:[
      '<span class="c-acc">Content Arena</span> <span class="c-dim">2025 &middot; competitive intel</span>',
      '',
      'Answers &ldquo;who is my competition, really?&rdquo; for YouTube creators: discovers comparable channels and converts performance into structured, normalised engagement signals instead of raw subscriber counts.']},
    {k:['ascon','iov','5g','security','crypto','intrusion','vehic','snort'],a:[
      '<span class="c-acc">IoV Security with ASCON</span> <span class="c-dim">2023-24 &middot; published research</span>',
      '',
      'ASCON lightweight cipher on Raspberry Pi over MQTT; simulated DoS/MITM attacks with Snort + Kali; ensemble ML classifier on CICIDS2017 hit <span class="c-txt">99.95% DoS detection</span>. Published in Springer Nature (2025): '+LINKS.pub+'.']},
    {k:['cyprus','federated','d2d','ns3','research intern'],a:[
      '<span class="c-acc">Federated Learning for D2D</span> <span class="c-dim">2023 &middot; University of Cyprus, onsite</span>',
      '',
      'NS3-simulated decentralised wireless network; K-Means/OPTICS/Spectral/Ward clustering; neural network selecting transmission modes by energy, distance and signal quality.']},
    {k:['crop','farm','yield','random forest','agri'],a:[
      '<span class="c-acc">Crop Yield Predictor</span> <span class="c-dim">2023 &middot; ML</span>',
      '',
      'Random Forest over soil type, moisture, pH and crop history: <span class="c-txt">98% validation accuracy</span>, turned into actionable crop recommendations.']},
    {k:['forage','simulation','job sim','legends of aether','aether','kpi','retention','churn','dau','metric'],a:[
      '<span class="c-acc">Product Management Job Simulation</span> <span class="c-dim">Forage &middot; Sep 2026</span>',
      '',
      '<span class="c-txt">Task 1: understanding product performance.</span> Picked one KPI per business question for <i>Legends of Aether</i>, a strategy RPG with rising downloads and falling engagement: 7-day <span class="c-txt">retention</span> over DAU for new-player stickiness (DAU mixes new players with veterans and hides the drop-off), <span class="c-txt">DAU</span> for community size, <span class="c-txt">churn</span> for players already lost, <span class="c-txt">conversion rate</span> over ARPU for campaign purchases.',
      '<span class="c-txt">Task 2: planning a stakeholder presentation.</span> A 7-step plan with owners, outputs, dependencies and named approval points, splitting one deck into three audiences: development gets where players drop off, marketing gets which segments the campaign brought in, leadership gets the business risk.']},
    {k:['quantum','post-quantum','pleiades','russian microelectronics','lattice'],a:[
      '<span class="c-acc">&ldquo;Quantum-Resistant Microelectronic Cryptography for Securing Vehicular Networks&rdquo;</span>',
      '',
      '<span class="c-dim">Russian Microelectronics, vol. 55 no. 1 &middot; Pleiades Publishing (Springer Nature) &middot; Scopus indexed &middot; 2026</span>',
      LINKS.pub2]},
    {k:['everstage','comp','commission','superset','implementation','current job','work now'],a:CMDS.experience},
    {k:['why product','product manage','pm','why pm','transition'],a:[
      '<span class="c-acc">why product?</span>',
      '',
      'Two years owning enterprise implementations is product school in disguise: sitting with users, finding the real problem under the stated one, negotiating scope with engineering, and being accountable for outcomes.',
      'Sai closed the loop by building: 10 shipped projects where he did discovery, design, build and measurement himself: plus CSM and HelloPM’s Tech for PM to put structure under the instincts. The pattern across all of it: <span class="c-txt">find the friction, build the fix, measure what changed</span>.']},
    {k:['hire','why you','why should','stand out','different','impress'],a:[
      '<span class="c-acc">the pitch</span>',
      '',
      '&#9657; <span class="c-txt">Proof over claims</span>: $500K+ ARR accounts owned end to end, 1,000+ payees per config, a $5M&rarr;$10M ARR ride, two peer-reviewed journal papers, 10 shipped projects.',
      '&#9657; <span class="c-txt">Builds what he specs</span>: the discovery instincts of a CX specialist plus the hands to ship the prototype the same week (this CLI included).',
      '&#9657; <span class="c-txt">Certified on both halves</span>: AWS AI/Cloud/ML Engineer on the tech side, CSM + Tech for PM on the process side.',
      '',
      'Ask for specifics: <span class="c-txt">/projects</span> or <span class="c-txt">/experience</span>. Or skip ahead: <span class="c-txt">/contact</span>.']},
    {k:['impact','achievement','proud','biggest'],a:[
      '<span class="c-acc">biggest impact</span>',
      '',
      'At Everstage: owning comp implementations for $500K+ ARR enterprise accounts touching 1,000+ payees each, while the company scaled $5M &rarr; $10M ARR.',
      'On his own time: two peer-reviewed journal publications (Springer Nature 2025, Russian Microelectronics 2026), and a run of shipped AI products. Details: <span class="c-txt">/projects</span>.']},
    {k:['intern','available','availability','start','when can','notice','join','credit','hiring','role','looking for'],a:[
      '<span class="c-acc">availability</span>',
      '',
      'Open to <span class="c-txt">credit-bearing internships from December 2026 to December 2027</span>, through his NUS MSc.',
      'Roles: <span class="c-txt">Product Management</span>, <span class="c-txt">Data Analyst</span>, <span class="c-txt">Business Analyst</span>. Based in Singapore.',
      'Fastest route: '+LINKS.mail+' or grab the CV with <span class="c-txt">/contact</span>.']},
    {k:['where','based','location','city','chennai','singapore','relocate'],a:['Based in <span class="c-txt">Singapore</span>, originally from Chennai, India. Comfortable working with international stakeholders: he’s been the primary liaison for global enterprise clients at Everstage.']},
    {k:['email','contact','linkedin','reach','resume','cv'],a:CMDS.contact},
    {k:['cert','aws','scrum','csm','credly'],a:CMDS.certs},
    {k:['college','degree','cgpa','school','education','ssn','study','master','nus'],a:CMDS.education},
    {k:['publication','paper','springer','journal','doi','published','research paper'],a:CMDS.publication},
    {k:['volunteer','nss','invente','instincts','lead'],a:CMDS.leadership},
    {k:['project','shipped','built','portfolio'],a:CMDS.projects},
    {k:['who','about','yourself','intro'],a:CMDS.whoami},
    {k:['cli','terminal','this shell','how do you work','built this'],a:[
      'This shell is part of the portfolio: a zero-dependency terminal with a built-in knowledge engine, shipped as one HTML file. Sai builds his own tools; this one’s for you.',
      '<span class="c-dim">Try /help for everything I can do.</span>']},
    {k:['hello','hi ','hey','yo '],a:['Hey! I’m Sai’s portfolio shell. Ask me anything about his work: or start with <span class="c-txt">/whoami</span>.']}
  ];

  function localAnswer(q){
    const s=' '+q.toLowerCase()+' ';
    let best=null,score=0;
    for(const t of TOPICS){
      let n=0;
      for(const k of t.k){ if(s.includes(k)) n+=k.length; }
      if(n>score){ score=n; best=t; }
    }
    if(best) return best.a;
    return [
      '<span class="c-dim">Hmm, that one’s outside my knowledge base. I know Sai’s work, projects, certs, education and how to reach him.</span>',
      '<span class="c-dim">Try</span> <span class="c-txt">/help</span><span class="c-dim">, or ask something like &ldquo;what’s NourishAI?&rdquo; or &ldquo;why should we hire you?&rdquo;</span>'
    ];
  }

  async function aiAnswer(q){
    const r=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})});
    if(!r.ok) throw new Error('bad status '+r.status);
    const d=await r.json();
    if(!d.answer) throw new Error('no answer');
    return [esc(d.answer)];
  }

  async function print(lines){
    for(const l of lines){
      line(l);
      await new Promise(r=>setTimeout(r,26));
    }
  }

  async function submit(){
    if(busy) return;
    const raw=input.value.trim();
    if(!raw) return;
    input.value=''; histIdx=-1;
    if(hist[hist.length-1]!==raw) hist.push(raw);
    line(esc(raw),'cli-user');
    gap();
    busy=true;
    try{
      const cmd=raw.replace(/^\//,'').toLowerCase().split(/\s+/)[0];
      if(raw.startsWith('/')){
        if(cmd==='clear'){ body.innerHTML=''; boot(); busy=false; return; }
        if(cmd==='exit'||cmd==='quit'){ close(); busy=false; return; }
        if(CMDS[cmd]){ await print(CMDS[cmd]); }
        else await print(['<span class="c-red">command not found:</span> '+esc(raw),'<span class="c-dim">try /help</span>']);
      } else if(AI_ENDPOINT){
        const think=line('<span class="c-dim cli-think">thinking&hellip;</span>');
        try{ const a=await aiAnswer(raw); think.remove(); await print(a); }
        catch(e){ think.remove(); await print(localAnswer(raw)); }
      } else {
        await print(localAnswer(raw));
      }
    } finally {
      gap();
      busy=false;
      body.scrollTop=body.scrollHeight;
    }
  }

  input.addEventListener('keydown',e=>{
    if(e.key==='Enter') submit();
    else if(e.key==='ArrowUp'){ if(hist.length){ histIdx=histIdx<0?hist.length-1:Math.max(0,histIdx-1); input.value=hist[histIdx]; e.preventDefault(); } }
    else if(e.key==='ArrowDown'){ if(histIdx>=0){ histIdx++; if(histIdx>=hist.length){ histIdx=-1; input.value=''; } else input.value=hist[histIdx]; e.preventDefault(); } }
  });
  document.querySelectorAll('[data-cli]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();open();}));
  document.getElementById('cliCloseBtn').addEventListener('click',close);
  overlay.addEventListener('click',e=>{ if(e.target===overlay) close(); });
  addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); overlay.classList.contains('open')?close():open(); }
    else if(e.key==='Escape'&&overlay.classList.contains('open')) close();
  });
})();
