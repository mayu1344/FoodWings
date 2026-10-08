/* Landing page: rotating offer chip, dish search suggestions, "what's on your mind", how-it-works stepper */
(function () {
  F.$('#logo').innerHTML = F.logoSvg();

  // rotating offer chip
  const OFFERS = ['Free delivery on your first order', 'WELCOME50 · 50% off up to ₹100', 'FLAT75 · ₹75 off above ₹299', 'Pay by card, UPI or cash'];
  let oi = 0;
  setInterval(() => { oi = (oi + 1) % OFFERS.length; F.$('#offer').innerHTML = '<span>' + F.esc(OFFERS[oi]) + '</span>'; }, 2600);

  // dish search with suggestions (dishes from the seed menu)
  const DISHES = [
    ['Chicken Dum Biryani', 'Spice Route Biryani House', 1], ['Mutton Biryani', 'Spice Route Biryani House', 1], ['Veg Biryani', 'Spice Route Biryani House', 1],
    ['Chicken 65', 'Spice Route Biryani House', 1], ['Gulab Jamun', 'Spice Route Biryani House', 1],
    ['Masala Dosa', 'Udupi Grand Veg', 2], ['Idli Vada', 'Udupi Grand Veg', 2], ['Rava Idli', 'Udupi Grand Veg', 2], ['Filter Coffee', 'Udupi Grand Veg', 2],
    ['Margherita Pizza', 'Slice Street Pizza', 3], ['Farmhouse Pizza', 'Slice Street Pizza', 3], ['Chicken Tikka Pizza', 'Slice Street Pizza', 3], ['Garlic Bread', 'Slice Street Pizza', 3]
  ];
  const q = F.$('#q'), box = F.$('#sugg');
  let sel = -1, hits = [];
  const draw = () => {
    const v = q.value.trim().toLowerCase();
    if (!v) { box.classList.add('hide'); return; }
    hits = DISHES.filter((d) => d[0].toLowerCase().includes(v) || d[1].toLowerCase().includes(v)).slice(0, 6);
    box.classList.remove('hide');
    box.innerHTML = hits.length
      ? hits.map((d, i) => '<a href="customer.html#/r/' + d[2] + '" class="' + (i === sel ? 'on' : '') + '">' + F.photo(F.dishImg(d[0]), d[0], 'thumb') +
        '<span class="col" style="gap:0"><span>' + F.esc(d[0]) + '</span><span class="muted small">' + F.esc(d[1]) + '</span></span></a>').join('')
      : '<div class="empty" style="padding:18px">No dishes match "' + F.esc(q.value) + '"</div>';
  };
  q.addEventListener('input', () => { sel = -1; draw(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(hits.length - 1, sel + 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    if (e.key === 'Enter') { const h = hits[sel < 0 ? 0 : sel]; if (h) location.href = 'customer.html#/r/' + h[2]; }
    if (e.key === 'Escape') box.classList.add('hide');
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) box.classList.add('hide'); });

  // what's on your mind
  const MIND = [['Biryani', 'biryani'], ['Dosa', 'dosa'], ['Idli', 'idli'], ['Pizza', 'pizza'], ['North Indian', 'north-indian'], ['Desserts', 'desserts'], ['Chinese', 'chinese'], ['Thali', 'rolls'], ['Salads', 'salad'], ['Coffee', 'tea']];
  const mind = F.$('#mind');
  mind.innerHTML = MIND.map((m, i) => '<button type="button" data-i="' + i + '" class="up" style="animation-delay:' + i * 0.04 + 's">' + F.photo(F.img(m[1]), m[0]) + m[0] + '</button>').join('');
  mind.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    F.$$('button', mind).forEach((x) => x.classList.toggle('on', x === b));
    const m = MIND[b.dataset.i];
    setTimeout(() => { location.href = 'customer.html#/home?f=' + encodeURIComponent(m[0]); }, 350);
  });

  // how it works
  const STEPS = [['Pick a restaurant', 'See what is open near your address, with ratings and delivery time.'],
    ['Pay safely', 'Card details go only to the payment gateway. We never store your CVV.'],
    ['Kitchen cooks', 'The restaurant accepts and a nearby rider is assigned automatically.'],
    ['Track to your door', 'Watch every step live until the rider hands it over.']];
  const st = F.$('#steps');
  st.innerHTML = STEPS.map((s, i) => '<div class="card step" data-i="' + i + '"><b class="n">' + (i + 1) + '</b><h3 style="font-size:20px;margin-bottom:6px">' + s[0] + '</h3><span class="muted">' + s[1] + '</span></div>').join('');
  let si = 0;
  const mark = () => F.$$('.step', st).forEach((x, i) => x.classList.toggle('on', i === si));
  mark();
  setInterval(() => { si = (si + 1) % STEPS.length; mark(); }, 2600);
})();
