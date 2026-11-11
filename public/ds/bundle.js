/* @ds-bundle: {"format":4,"namespace":"Dash","components":[{"name":"Icon"},{"name":"Button"},{"name":"Select"},{"name":"Chip"},{"name":"DeltaBadge"},{"name":"Status"},{"name":"StatCard"},{"name":"Card"},{"name":"Legend"},{"name":"LineChart"},{"name":"BarChart"},{"name":"Gauge"},{"name":"SegmentBar"},{"name":"DataTable"},{"name":"DatePicker"},{"name":"Sidebar"},{"name":"ChatMessage"},{"name":"Composer"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState;

  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(' ');
  }
  function omit(p, keys) {
    var o = {};
    for (var k in p) if (keys.indexOf(k) < 0) o[k] = p[k];
    return o;
  }

  /* ---------- Icon ---------- */
  var ICONS = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
    database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    activity: 'M3 12h4l3-8 4 16 3-8h4',
    chart: 'M5 20v-8M12 20V5M19 20v-6',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18',
    layers: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    file: 'M6 3h8l4 4v14H6zM14 3v4h4',
    undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    chevronDown: 'M6 9l6 6 6-6',
    chevronLeft: 'M15 6l-6 6 6 6',
    chevronRight: 'M9 6l6 6-6 6',
    arrowUp: 'M12 19V5M6 11l6-6 6 6',
    arrowDown: 'M12 5v14M6 13l6 6 6-6',
    settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
    help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .9-1 1.6v.4M12 17h.01',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
    alert: 'M12 3.5 2.5 20h19zM12 10v4M12 17h.01',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
    thumbUp: 'M7 10v10H4V10zM7 10l4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7',
    sidebar: 'M4 4h16v16H4zM10 4v16',
    plus: 'M12 5v14M5 12h14',
    send: 'M5 12h14M13 6l6 6-6 6',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    menu: 'M4 7h16M4 12h16M4 17h16'
  };
  function Icon(p) {
    var size = p.size || 16;
    return h(
      'svg',
      {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: p.strokeWidth || 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': p.label ? undefined : true, 'aria-label': p.label, role: p.label ? 'img' : undefined,
        className: cx('sd-icon', p.className)
      },
      h('path', { d: ICONS[p.name] || '' })
    );
  }
  Icon.names = Object.keys(ICONS);

  /* ---------- Button ---------- */
  function Button(p) {
    var variant = p.variant || 'secondary';
    var size = p.size || 'md';
    var rest = omit(p, ['variant', 'size', 'icon', 'iconOnly', 'className', 'children']);
    return h(
      'button',
      Object.assign({ type: 'button' }, rest, {
        className: cx('sd-btn', 'sd-btn--' + variant, 'sd-btn--' + size, p.iconOnly && 'sd-btn--icon', p.className)
      }),
      p.icon ? h(Icon, { name: p.icon, size: size === 'sm' ? 14 : 16 }) : null,
      p.children
    );
  }

  /* ---------- Select ---------- */
  function Select(p) {
    var opts = p.options || [];
    var st = useState(p.defaultOpen || false), open = st[0], setOpen = st[1];
    var sv = useState(p.value != null ? p.value : (opts[0] && (opts[0].value || opts[0]))), val = sv[0], setVal = sv[1];
    var current = p.value != null ? p.value : val;
    function labelOf(v) {
      for (var i = 0; i < opts.length; i++) {
        var o = opts[i];
        if ((o.value || o) === v) return o.label || o;
      }
      return v;
    }
    return h(
      'div',
      { className: cx('sd-select', open && 'is-open', p.className) },
      h(
        'button',
        { type: 'button', className: 'sd-select__trigger', 'aria-haspopup': 'listbox', 'aria-expanded': open, onClick: function () { setOpen(!open); } },
        p.icon ? h(Icon, { name: p.icon, size: 14 }) : null,
        h('span', null, labelOf(current)),
        h(Icon, { name: 'chevronDown', size: 14, className: 'sd-select__chev' })
      ),
      open
        ? h(
            'ul',
            { className: 'sd-select__menu', role: 'listbox' },
            opts.map(function (o) {
              var v = o.value || o;
              return h(
                'li',
                {
                  key: v, role: 'option', 'aria-selected': v === current, tabIndex: 0,
                  className: cx('sd-select__opt', v === current && 'is-selected'),
                  onClick: function () { setVal(v); setOpen(false); if (p.onChange) p.onChange(v); }
                },
                o.label || o
              );
            })
          )
        : null
    );
  }

  /* ---------- Chip ---------- */
  function Chip(p) {
    var rest = omit(p, ['selected', 'leading', 'icon', 'className', 'children']);
    return h(
      'button',
      Object.assign({ type: 'button', 'aria-pressed': !!p.selected }, rest, { className: cx('sd-chip', p.selected && 'is-selected', p.className) }),
      p.icon ? h(Icon, { name: p.icon, size: 14 }) : null,
      p.leading || null,
      p.children
    );
  }

  /* ---------- DeltaBadge ---------- */
  function DeltaBadge(p) {
    var tone = p.tone || (String(p.value).charAt(0) === '-' ? 'negative' : 'positive');
    return h('span', { className: cx('sd-badge', 'sd-badge--' + tone, p.className) }, p.value != null ? p.value : p.children);
  }

  /* ---------- Status ---------- */
  var STATUS_TONE = { healthy: 'positive', degraded: 'warning', down: 'negative', idle: 'neutral' };
  var STATUS_LABEL = { healthy: 'Healthy', degraded: 'Degraded', down: 'Down', idle: 'Idle' };
  function Status(p) {
    var s = p.status || 'healthy';
    return h(
      'span',
      { className: cx('sd-status', 'sd-status--' + (STATUS_TONE[s] || 'neutral'), p.className) },
      h('span', { className: 'sd-status__dot', 'aria-hidden': true }),
      p.children || STATUS_LABEL[s] || s
    );
  }

  /* ---------- Trend arrow ---------- */
  function Trend(p) {
    return h(
      'span',
      { className: cx('sd-trend', 'sd-trend--' + (p.tone || 'positive')), 'aria-label': p.direction === 'down' ? 'down' : 'up', role: 'img' },
      h(Icon, { name: p.direction === 'down' ? 'arrowDown' : 'arrowUp', size: 10, strokeWidth: 2.4 })
    );
  }

  /* ---------- StatCard ---------- */
  function StatCard(p) {
    var dir = p.direction || (String(p.delta || '').charAt(0) === '-' ? 'down' : 'up');
    var tone = p.tone || (dir === 'down' ? 'negative' : 'positive');
    return h(
      'section',
      { className: cx('sd-card', 'sd-stat', p.className) },
      h('div', { className: 'sd-stat__head' },
        h('span', { className: 'sd-stat__label' }, p.label),
        p.delta ? h(DeltaBadge, { value: p.delta, tone: tone }) : null
      ),
      h('div', { className: 'sd-stat__value' },
        h('span', { className: 'metric-lg' }, p.value),
        p.delta ? h(Trend, { direction: dir, tone: tone }) : null
      ),
      p.note ? h('p', { className: 'sd-stat__note' }, p.note) : null
    );
  }

  /* ---------- Card ---------- */
  function Card(p) {
    return h(
      'section',
      { className: cx('sd-card', p.className), style: p.style },
      p.title || p.aside
        ? h('header', { className: 'sd-card__head' },
            h('div', null,
              p.title ? h('h3', { className: 'sd-card__title' }, p.title) : null,
              p.description ? h('p', { className: 'sd-card__desc' }, p.description) : null
            ),
            p.aside ? h('div', { className: 'sd-card__aside' }, p.aside) : null
          )
        : null,
      p.children
    );
  }

  /* ---------- Legend ---------- */
  function Legend(p) {
    return h(
      'ul',
      { className: cx('sd-legend', p.className) },
      (p.items || []).map(function (it) {
        return h('li', { key: it.label },
          h('span', { className: 'sd-legend__dot', style: { background: it.color || 'var(--accent)' } }),
          it.label
        );
      })
    );
  }

  /* ---------- LineChart ---------- */
  function smoothPath(pts) {
    if (!pts.length) return '';
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x + ',' + c1y + ' ' + c2x + ',' + c2y + ' ' + p2[0] + ',' + p2[1];
    }
    return d;
  }
  function LineChart(p) {
    var series = p.series || [];
    var height = p.height || 160;
    var W = 1000, H = 100;
    var all = [];
    series.forEach(function (s) { all = all.concat(s.data); });
    var min = p.min != null ? p.min : Math.min.apply(null, all);
    var max = p.max != null ? p.max : Math.max.apply(null, all);
    if (max === min) max = min + 1;
    function pt(v, i, n) { return [(i / (n - 1)) * W, H - ((v - min) / (max - min)) * H * 0.9 - H * 0.05]; }
    var ticks = p.yTicks || [];
    var m = p.marker;
    var main = series[0];
    var mp = m && main ? pt(main.data[m.index], m.index, main.data.length) : null;
    return h(
      'div',
      { className: cx('sd-line', p.className) },
      ticks.length ? h('div', { className: 'sd-line__y', style: { height: height } }, ticks.slice().reverse().map(function (t) { return h('span', { key: t }, t); })) : null,
      h('div', { className: 'sd-line__plot' },
        h('div', { className: 'sd-line__area', style: { height: height } },
          h('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', width: '100%', height: '100%', 'aria-hidden': true },
            ticks.map(function (t, i) {
              var y = ticks.length > 1 ? H - (i / (ticks.length - 1)) * H : H;
              return h('line', { key: i, x1: 0, x2: W, y1: y, y2: y, className: 'sd-line__grid', vectorEffect: 'non-scaling-stroke' });
            }),
            mp ? h('line', { x1: mp[0], x2: mp[0], y1: 0, y2: H, className: 'sd-line__cursor', vectorEffect: 'non-scaling-stroke' }) : null,
            series.slice().reverse().map(function (s, i) {
              var pts = s.data.map(function (v, j) { return pt(v, j, s.data.length); });
              return h('path', { key: i, d: smoothPath(pts), className: 'sd-line__path sd-line__path--' + (s.tone || 'accent'), vectorEffect: 'non-scaling-stroke' });
            })
          ),
          mp ? h('span', { className: 'sd-line__dot', style: { left: (mp[0] / W) * 100 + '%', top: (mp[1] / H) * 100 + '%' } }) : null,
          mp && (m.title || m.value)
            ? h('div', { className: 'sd-tooltip', style: { left: (mp[0] / W) * 100 + '%' } },
                m.title ? h('div', { className: 'sd-tooltip__title' }, m.title) : null,
                m.value ? h('div', { className: 'sd-tooltip__value' }, m.value) : null
              )
            : null
        ),
        p.labels ? h('div', { className: 'sd-line__x' }, p.labels.map(function (l, i) {
          return h('span', { key: i, className: p.activeLabel === i ? 'is-active' : undefined }, l);
        })) : null
      )
    );
  }

  /* ---------- BarChart ---------- */
  function BarChart(p) {
    var data = p.data || [];
    var max = p.max || Math.max.apply(null, data);
    var hl = p.highlight || [];
    var markers = p.markers || [];
    var mIdx = markers.map(function (m) { return m.index; });
    hl = hl.concat(mIdx);
    var height = p.height || 140;
    return h(
      'div',
      { className: cx('sd-bars', p.className) },
      h('div', { className: 'sd-bars__plot', style: { height: height } },
        data.map(function (v, i) {
          var mk = markers[mIdx.indexOf(i)];
          return h('div', { key: i, className: 'sd-bars__col' },
            mk && mk.pct ? h('span', { className: 'sd-bars__pct' }, mk.pct) : null,
            h('div', { className: cx('sd-bars__bar', hl.indexOf(i) >= 0 && 'is-hl'), style: { height: Math.max(2, (v / max) * 100) + '%' } })
          );
        })
      ),
      markers.length
        ? h('div', { className: 'sd-bars__labels' },
            markers.map(function (m, k) {
              return h('div', { key: k, style: { left: (m.index / data.length) * 100 + '%' } },
                h('span', { className: 'sd-bars__lbl' }, m.label),
                m.value != null ? h('span', { className: 'sd-bars__val' }, m.value) : null
              );
            })
          )
        : null,
      p.labels
        ? h('div', { className: 'sd-bars__x' }, p.labels.map(function (l, i) {
            return h('span', { key: i, className: p.activeLabel === i ? 'is-active' : undefined }, l);
          }))
        : null
    );
  }

  /* ---------- Gauge ---------- */
  function Gauge(p) {
    var max = p.max || 100;
    var f = Math.max(0, Math.min(1, (p.value || 0) / max));
    var r = 90, cxp = 100, cyp = 100;
    function at(t) { var a = Math.PI * (1 - t); return [cxp + r * Math.cos(a), cyp - r * Math.sin(a)]; }
    function arc(t0, t1) {
      var a = at(t0), b = at(t1);
      return 'M' + a[0] + ',' + a[1] + ' A' + r + ',' + r + ' 0 0 1 ' + b[0] + ',' + b[1];
    }
    var gap = 0.012;
    return h(
      'div',
      { className: cx('sd-gauge', p.className) },
      h('div', { className: 'sd-gauge__dial' },
        h('svg', { viewBox: '0 0 200 106', width: '100%', 'aria-hidden': true },
          f < 1 ? h('path', { d: arc(Math.min(1, f + gap), 1), className: 'sd-gauge__track' }) : null,
          f > 0 ? h('path', { d: arc(0, f), className: 'sd-gauge__fill' }) : null
        ),
        h('div', { className: 'sd-gauge__center' },
          h('span', { className: 'metric-xl' }, p.display != null ? p.display : p.value),
          p.caption ? h('span', { className: 'sd-gauge__cap' }, p.caption) : null
        )
      ),
      p.footerLabel
        ? h('div', { className: 'sd-gauge__foot' }, h('span', null, p.footerLabel), h('span', { className: 'sd-mono' }, p.footerValue))
        : null
    );
  }

  /* ---------- SegmentBar ---------- */
  function SegmentBar(p) {
    var segs = p.segments || [];
    return h(
      'div',
      { className: cx('sd-seg', p.className), role: 'img', 'aria-label': segs.map(function (s) { return (s.label || '') + ' ' + s.value; }).join(', ') },
      segs.map(function (s, i) {
        return h('span', { key: i, style: { flexGrow: s.value, background: s.color || 'var(--chart-' + (i + 1) + ')' } });
      })
    );
  }

  /* ---------- DataTable ---------- */
  function renderCell(v, col) {
    if (v == null) return '';
    if (typeof v !== 'object' || React.isValidElement(v)) return v;
    var tone = v.tone || (v.trend === 'down' ? 'negative' : 'positive');
    return h('span', { className: 'sd-cell' },
      v.dot ? h('span', { className: 'sd-legend__dot', style: { background: v.dot } }) : null,
      v.text,
      v.trend ? h(Icon, { name: v.trend === 'down' ? 'arrowDown' : 'arrowUp', size: 12, strokeWidth: 2, className: 'sd-cell__trend sd-cell__trend--' + tone }) : null
    );
  }
  function DataTable(p) {
    var cols = p.columns || [];
    return h(
      'div',
      { className: cx('sd-table-wrap', p.className) },
      h('table', { className: 'sd-table' },
        h('thead', null, h('tr', null, cols.map(function (c) {
          return h('th', { key: c.key, className: c.align === 'right' ? 'is-right' : undefined }, c.label);
        }))),
        h('tbody', null, (p.rows || []).map(function (r, i) {
          return h('tr', { key: r.id || i }, cols.map(function (c) {
            return h('td', { key: c.key, className: cx(c.mono && 'sd-mono', c.align === 'right' && 'is-right') }, renderCell(r[c.key], c));
          }));
        }))
      )
    );
  }

  /* ---------- DatePicker ---------- */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function DatePicker(p) {
    var now = new Date();
    var ms = useState({ y: p.year || now.getFullYear(), m: p.month != null ? p.month : now.getMonth() }), mon = ms[0], setMon = ms[1];
    var rs = useState({ s: p.start || null, e: p.end || null }), rng = rs[0], setRng = rs[1];
    var first = new Date(mon.y, mon.m, 1);
    var lead = (first.getDay() + 6) % 7;
    var days = new Date(mon.y, mon.m + 1, 0).getDate();
    var prevDays = new Date(mon.y, mon.m, 0).getDate();
    var cells = [];
    for (var i = 0; i < lead; i++) cells.push({ d: prevDays - lead + 1 + i, out: true });
    for (var d = 1; d <= days; d++) cells.push({ d: d });
    var tail = (7 - (cells.length % 7)) % 7;
    for (var t = 1; t <= tail; t++) cells.push({ d: t, out: true });
    function pick(d) {
      if (!rng.s || rng.e) setRng({ s: d, e: null });
      else if (d < rng.s) setRng({ s: d, e: rng.s });
      else setRng({ s: rng.s, e: d });
    }
    function shift(n) {
      var dt = new Date(mon.y, mon.m + n, 1);
      setMon({ y: dt.getFullYear(), m: dt.getMonth() });
    }
    return h(
      'div',
      { className: cx('sd-date', p.className) },
      p.presets ? h('div', { className: 'sd-date__presets' }, h(Select, { options: p.presets })) : null,
      h('div', { className: 'sd-date__nav' },
        h(Button, { variant: 'ghost', size: 'sm', iconOnly: true, icon: 'chevronLeft', 'aria-label': 'Previous month', onClick: function () { shift(-1); } }),
        h('span', { className: 'sd-date__month' }, MONTHS[mon.m] + ' ' + mon.y),
        h(Button, { variant: 'ghost', size: 'sm', iconOnly: true, icon: 'chevronRight', 'aria-label': 'Next month', onClick: function () { shift(1); } })
      ),
      h('div', { className: 'sd-date__grid', role: 'grid' },
        ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(function (w) { return h('span', { key: w, className: 'sd-date__wd' }, w); }),
        cells.map(function (c, i) {
          var edge = !c.out && (c.d === rng.s || c.d === rng.e);
          var inR = !c.out && rng.s && rng.e && c.d > rng.s && c.d < rng.e;
          return h('button', {
            key: i, type: 'button', disabled: c.out,
            className: cx('sd-date__day', c.out && 'is-out', edge && 'is-edge', inR && 'is-in'),
            onClick: function () { pick(c.d); }
          }, c.d);
        })
      ),
      h('div', { className: 'sd-date__foot' },
        h(Button, { variant: 'ghost', onClick: p.onCancel }, 'Cancel'),
        h(Button, { variant: 'primary', onClick: function () { if (p.onApply) p.onApply(rng); } }, 'Apply')
      )
    );
  }

  /* ---------- Sidebar ---------- */
  function NavItem(it) {
    return h('a', { href: it.href || '#', className: cx('sd-nav__item', it.active && 'is-active'), 'aria-current': it.active ? 'page' : undefined },
      it.icon ? h(Icon, { name: it.icon }) : null,
      h('span', null, it.label)
    );
  }
  function Sidebar(p) {
    function list(items) {
      return items.map(function (it, i) {
        if (it.section) return h('div', { key: 's' + i, className: 'sd-nav__section' }, it.section);
        return h(NavItem, Object.assign({ key: it.label + i }, it));
      });
    }
    return h(
      'aside',
      { className: cx('sd-sidebar', p.className) },
      h('div', { className: 'sd-sidebar__brand' },
        h('span', { className: 'sd-sidebar__name' }, p.brand || 'Dashboard'),
        h(Button, { variant: 'ghost', size: 'sm', iconOnly: true, icon: 'sidebar', 'aria-label': 'Collapse sidebar' })
      ),
      h('nav', { className: 'sd-nav' }, list(p.items || [])),
      p.footer ? h('nav', { className: 'sd-nav sd-nav--foot' }, list(p.footer)) : null
    );
  }

  /* ---------- ChatMessage ---------- */
  function ChatMessage(p) {
    var role = p.role || 'assistant';
    if (role === 'user') return h('div', { className: 'sd-msg sd-msg--user' }, h('div', { className: 'sd-msg__bubble' }, p.children));
    return h('div', { className: 'sd-msg sd-msg--assistant' },
      h('div', { className: 'sd-msg__body' }, p.children),
      p.actions === false ? null : h('div', { className: 'sd-msg__actions' },
        ['copy', 'thumbUp', 'refresh'].map(function (n) {
          return h(Button, { key: n, variant: 'outline', size: 'sm', iconOnly: true, icon: n, 'aria-label': n });
        })
      )
    );
  }

  /* ---------- Composer ---------- */
  function Composer(p) {
    var vs = useState(''), v = vs[0], setV = vs[1];
    return h(
      'form',
      { className: cx('sd-composer', p.className), onSubmit: function (e) { e.preventDefault(); if (p.onSubmit) p.onSubmit(v); setV(''); } },
      h('textarea', { rows: 1, placeholder: p.placeholder || 'How can I help you?', value: v, onChange: function (e) { setV(e.target.value); }, 'aria-label': 'Message' }),
      h('div', { className: 'sd-composer__row' },
        h('span', { className: 'sd-composer__mode' }, h(Icon, { name: 'sparkle', size: 14 }), p.mode || 'Assistant'),
        h('button', { type: p.busy ? 'button' : 'submit', className: 'sd-composer__send', 'aria-label': p.busy ? 'Stop' : 'Send' },
          p.busy ? h('span', { className: 'sd-composer__stop' }) : h(Icon, { name: 'arrowUp', size: 14, strokeWidth: 2 })
        )
      )
    );
  }

  var Dash = {
    Icon: Icon, Button: Button, Select: Select, Chip: Chip, DeltaBadge: DeltaBadge, Status: Status,
    StatCard: StatCard, Card: Card, Legend: Legend, LineChart: LineChart, BarChart: BarChart, Gauge: Gauge,
    SegmentBar: SegmentBar, DataTable: DataTable, DatePicker: DatePicker, Sidebar: Sidebar,
    ChatMessage: ChatMessage, Composer: Composer
  };
  window.Dash = Object.assign(window.Dash || {}, Dash);
})();
