const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================
// Loader
// ============================================
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  setTimeout(() => loader.classList.add('hidden'), reduceMotion ? 0 : 1000);
});

// ============================================
// Hero node field
// ============================================
(function heroField() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const terms = {
    db: [
      'SQL Server', 'T-SQL', 'Always On AG', 'DMVs', 'Execution Plans',
      'Index Tuning', 'Backup & Restore', 'Blocking Analysis', 'SQL Agent',
      'PostgreSQL', 'Azure SQL', 'Managed Instance', 'Disaster Recovery',
      'Query Optimization', 'Extended Events', 'Wait Stats', 'Deadlocks',
      'TempDB', 'Query Store', 'Statistics', 'Partitioning', 'Columnstore',
      'Replication', 'Log Shipping', 'DBCC CHECKDB', 'Index Fragmentation',
      'Isolation Levels', 'Transaction Log', 'Clustered Index', 'Buffer Pool',
      'Plan Cache', 'Parameter Sniffing', 'Latch Contention', 'Resource Governor',
      'Point-in-Time Restore', 'Failover Cluster', 'Cardinality Estimation',
      'Linked Servers', 'Backup Compression', 'Read Committed Snapshot',
      'sp_whoisactive', 'Ola Hallengren', 'Capacity Planning', 'Cumulative Updates',
      'TDE', 'RTO / RPO', 'Perfmon', 'SSIS', 'Maintenance Plans', 'Restore Testing'
    ],
    ai: [
      'Groq', 'Llama 3.3', 'Prompt Design', 'LLM Eval', 'Grounded Generation',
      'Anomaly Detection', 'Data Contracts', 'IsolationForest'
    ],
    eng: [
      'Python', 'FastAPI', 'SQLAlchemy', 'PowerShell', 'Docker', 'React',
      'CI/CD', 'Linux', 'Bash', 'Git'
    ]
  };

  // weighted so the field reads as a DBA's, while AI and full stack still surface
  const kindPool = ['db', 'db', 'db', 'db', 'db', 'db', 'db', 'ai', 'ai', 'eng', 'eng'];

  const colors = {
    db:  { dot: '212,166,85',  text: '212,166,85' },
    ai:  { dot: '123,163,201', text: '123,163,201' },
    eng: { dot: '95,191,146',  text: '95,191,146' }
  };

  const MAX_NODES = window.innerWidth < 700 ? 8 : 15;
  const LINK_DIST = 260;
  const nodes = [];
  const inUse = new Set();
  let dpr = 1;

  function pickTerm() {
    const kind = kindPool[Math.floor(Math.random() * kindPool.length)];
    const free = terms[kind].filter(t => !inUse.has(t));
    const pool = free.length ? free : terms[kind];
    const label = pool[Math.floor(Math.random() * pool.length)];
    inUse.add(label);
    return [label, kind];
  }

  function makeNode() {
    const [label, kind] = pickTerm();
    return {
      label, kind,
      x: 0.05 + Math.random() * 0.9,
      y: 0.05 + Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.00035,
      vy: (Math.random() - 0.5) * 0.00035,
      opacity: 0,
      born: performance.now(),
      life: 11000 + Math.random() * 9000
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  for (let i = 0; i < MAX_NODES; i++) {
    const n = makeNode();
    n.opacity = Math.random() * 0.8;
    n.born = performance.now() - Math.random() * n.life;
    nodes.push(n);
  }

  function draw(now) {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    ctx.clearRect(0, 0, w, h);

    nodes.forEach((n, i) => {
      const age = now - n.born;

      if (age > n.life - 2000) {
        n.opacity -= 0.006;
        if (n.opacity <= 0) {
          inUse.delete(n.label);
          nodes[i] = makeNode();
          return;
        }
      } else if (n.opacity < 1) {
        n.opacity = Math.min(1, n.opacity + 0.006);
      }

      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0.03 || n.x > 0.97) n.vx *= -1;
      if (n.y < 0.05 || n.y > 0.95) n.vy *= -1;
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = (a.x - b.x) * w;
        const dy = (a.y - b.y) * h;
        const dist = Math.hypot(dx, dy);
        if (dist >= LINK_DIST) continue;
        const alpha = Math.min(a.opacity, b.opacity) * (1 - dist / LINK_DIST) * 0.22;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(212,166,85,${alpha})`;
        ctx.lineWidth = 0.7;
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
      }
    }

    ctx.font = '10px "JetBrains Mono", monospace';
    nodes.forEach(n => {
      const x = n.x * w, y = n.y * h;
      const c = colors[n.kind];
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${c.dot},${0.55 * n.opacity})`;
      ctx.fill();
      ctx.fillStyle = `rgba(${c.text},${0.4 * n.opacity})`;
      label(n.label, x, y, w);
    });

    requestAnimationFrame(draw);
  }

  // keep labels inside the canvas so they never run off the right edge
  function label(text, x, y, w) {
    const flip = x + 8 + ctx.measureText(text).width > w - 10;
    ctx.textAlign = flip ? 'right' : 'left';
    ctx.fillText(text, flip ? x - 8 : x + 8, y + 3.5);
  }

  resize();
  window.addEventListener('resize', resize);

  if (reduceMotion) {
    drawStatic();
    window.addEventListener('resize', drawStatic);
  } else {
    requestAnimationFrame(draw);
  }

  function drawStatic() {
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px "JetBrains Mono", monospace';
    nodes.forEach(n => {
      const x = n.x * w, y = n.y * h;
      const c = colors[n.kind];
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${c.dot},0.45)`;
      ctx.fill();
      ctx.fillStyle = `rgba(${c.text},0.32)`;
      label(n.label, x, y, w);
    });
  }
})();

// ============================================
// Typewriter
// ============================================
(function typewriter() {
  const el = document.getElementById('twText');
  if (!el) return;

  const lines = [
    'tuning SQL Server so it stays up under load',
    'building AI tools that read live database telemetry',
    'auditing ETL batches before they reach production',
    'shipping FastAPI and React apps end to end'
  ];

  if (reduceMotion) {
    el.textContent = lines[0];
    return;
  }

  let line = 0, i = 0, deleting = false;

  (function tick() {
    const text = lines[line];
    el.textContent = text.slice(0, i);

    if (!deleting && i < text.length) {
      i++;
      setTimeout(tick, 45);
    } else if (!deleting) {
      deleting = true;
      setTimeout(tick, 1900);
    } else if (i > 0) {
      i--;
      setTimeout(tick, 18);
    } else {
      deleting = false;
      line = (line + 1) % lines.length;
      setTimeout(tick, 350);
    }
  })();
})();

// ============================================
// Scroll progress + back to top + active section
// ============================================
const scrollBar = document.getElementById('scroll-bar');
const backToTop = document.getElementById('back-to-top');
const navLinks = document.querySelectorAll('.nav-links a');
const navDots = document.querySelectorAll('.nav-dot');
const sectionIds = ['hero', 'about', 'skills', 'experience', 'projects', 'contact'];

function onScroll() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  scrollBar.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
  backToTop.classList.toggle('visible', window.scrollY > 500);

  let current = sectionIds[0];
  sectionIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && window.scrollY >= el.offsetTop - window.innerHeight / 2) current = id;
  });

  navDots.forEach(dot => dot.classList.toggle('active', dot.dataset.target === current));
  navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#' + current));
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
});

navDots.forEach(dot => {
  dot.addEventListener('click', () => {
    document.getElementById(dot.dataset.target).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});

// ============================================
// Mobile menu
// ============================================
(function menu() {
  const btn = document.getElementById('hamburger');
  const list = document.getElementById('navLinks');

  btn.addEventListener('click', () => {
    const open = list.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });

  list.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      list.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ============================================
// Skills filter
// ============================================
(function skillsFilter() {
  const buttons = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.skill-card');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      cards.forEach(card => {
        card.classList.toggle('hidden', filter !== 'all' && card.dataset.domain !== filter);
      });
    });
  });
})();

// ============================================
// Video modal
// ============================================
(function videoModal() {
  const modal = document.getElementById('video-modal');
  const video = document.getElementById('modal-video');
  const title = document.getElementById('modal-title');

  function open(src, label) {
    video.src = src;
    title.textContent = label || 'Demo Video';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    video.play().catch(() => {});
  }

  function close() {
    modal.classList.remove('active');
    video.pause();
    document.body.style.overflow = '';
    setTimeout(() => {
      if (!modal.classList.contains('active')) video.removeAttribute('src');
    }, 300);
  }

  document.querySelectorAll('[data-video]').forEach(btn => {
    btn.addEventListener('click', () => open(btn.dataset.video, btn.dataset.videoTitle));
  });

  document.getElementById('modal-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) close();
  });
})();

// ============================================
// Diagram zoom
// ============================================
(function imageZoom() {
  const images = document.querySelectorAll('.project-visual img');
  if (!images.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'zoom-overlay';
  const zoomed = document.createElement('img');
  overlay.appendChild(zoomed);
  document.body.appendChild(overlay);

  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  images.forEach(img => {
    img.addEventListener('click', () => {
      zoomed.src = img.src;
      zoomed.alt = img.alt;
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  overlay.addEventListener('click', close);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) close();
  });
})();

// ============================================
// Copy email
// ============================================
(function copyEmail() {
  const btn = document.getElementById('copyEmail');
  const toast = document.getElementById('toast');
  const address = 'firezer.demese@gmail.com';

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    } catch {
      window.location.href = 'mailto:' + address;
    }
  });
})();

// ============================================
// Scroll reveal
// ============================================
(function reveal() {
  const targets = document.querySelectorAll(
    '.about-grid, .about-stats, .skill-card, .timeline-item, .project-card, .contact-links, .contact-sub'
  );
  targets.forEach(el => el.classList.add('fade-in'));

  const observer = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => entry.target.classList.add('visible'), i * 70);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  targets.forEach(el => observer.observe(el));
})();
