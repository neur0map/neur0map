// Builds the profile sheets (profile/*.svg) and the README that shows them.
// profile.json is yours to edit; ryoku.json is the same for the whole team.
// GITHUB_TOKEN is optional. Without it the numbers come from data.json.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const DIR = new URL('./', import.meta.url)
const read = (path) => readFileSync(new URL(path, DIR))
const ME = JSON.parse(read('profile.json'))
const RY = JSON.parse(read('ryoku.json'))
const USER = ME.user
const RAW = `https://raw.githubusercontent.com/${USER}/${USER}/${ME.branch || 'main'}/profile/`
const W = 880
const PAD = 36

// colours from ryoku-site app/assets/css/tokens.css
const C = {
  paper: '#000000',
  ink: '#cdc4ba',
  dim: '#b0a9a0',
  muted: '#958f87',
  faint: '#807a73',
  line: 'rgba(205,196,186,.26)',
  soft: 'rgba(205,196,186,.13)',
  strong: 'rgba(205,196,186,.42)',
  sun: '#ce5e32',
}
const EASE = 'cubic-bezier(.215,.61,.355,1)'

// fonts are embedded since an SVG shown through <img> can't load other files
const FACES = {
  fr: ['nm-fr', 'fr-400.woff2', 'normal', 'fr-400'],
  fri: ['nm-fri', 'fr-italic-400.woff2', 'italic', 'fr-italic-400'],
  sg: ['nm-sg', 'sg-400.woff2', 'normal', 'sg-400'],
  sgl: ['nm-sgl', 'sg-300.woff2', 'normal', 'sg-300'],
  sm: ['nm-sm', 'sm-400.woff2', 'normal', 'sm-400'],
  jp: ['nm-jp', 'jp-700.woff2', 'normal', 'jp-700'],
}
const fontData = Object.fromEntries(Object.entries(FACES).map(([k, [, file]]) => [k, read(`fonts/${file}`).toString('base64')]))
const METRICS = JSON.parse(read('fonts/metrics.json'))

// width and height of each portrait in art/
const PORTRAITS = { hero: [1100, 1473], power: [820, 1098], forge: [820, 1098] }
const portrait = PORTRAITS[ME.portrait] ? ME.portrait : 'hero'
const b64 = (path) => read(path).toString('base64')
const ART = { portrait: b64(`art/${portrait}.png`), torii: b64('art/torii.png'), mark: b64('art/mark.svg') }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const r = (n, d = 1) => +Number(n).toFixed(d)
const fmt = (n) => Number(n || 0).toLocaleString('en-US')

function measure(text, face, size, tracking = 0) {
  const adv = METRICS[FACES[face][3]].advance
  let w = 0
  for (const ch of String(text)) w += (adv[ch] ?? adv.n ?? 0.55) * size + tracking
  return w - tracking
}

// mono labels have .14em letter spacing
const monoW = (text, size = 10) => measure(text, 'sm', size, size * 0.14)

function wrap(text, face, size, width) {
  const lines = ['']
  for (const word of String(text).split(' ')) {
    const cur = lines[lines.length - 1]
    const next = cur ? `${cur} ${word}` : word
    if (measure(next, face, size) > width && cur) lines.push(word)
    else lines[lines.length - 1] = next
  }
  return lines
}

// largest font size between min and max that fits text into width
const fit = (text, face, max, width, min = 10) => Math.max(min, Math.min(max, width / measure(text, face, 1)))

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const seedOf = (s) => createHash('sha1').update(s).digest().readUInt32BE(0)
const delay = (s) => `animation-delay:${r(s, 2)}s`

// drawn as paths because these glyphs aren't in the font subsets
const icon = {
  star(cx, cy, s = 4.6, fill = C.sun) {
    const pts = []
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const rad = i % 2 ? s * 0.42 : s
      pts.push(`${r(cx + rad * Math.cos(a), 2)},${r(cy + rad * Math.sin(a), 2)}`)
    }
    return `<path fill="${fill}" d="M${pts.join('L')}Z"/>`
  },
  upRight: (x, y, s = 9) => `<path class="sunl" d="M${r(x)},${r(y + s)}L${r(x + s)},${r(y)}M${r(x + s * 0.32)},${r(y)}H${r(x + s)}V${r(y + s * 0.68)}"/>`,
  swap: (x, y, w = 14) => `<path class="sunl" d="M${r(x)},${r(y - 3)}H${r(x + w)}M${r(x + w - 3.5)},${r(y - 6.5)}L${r(x + w)},${r(y - 3)}L${r(x + w - 3.5)},${r(y + 0.5)}M${r(x + w)},${r(y + 3)}H${r(x)}M${r(x + 3.5)},${r(y - 0.5)}L${r(x)},${r(y + 3)}L${r(x + 3.5)},${r(y + 6.5)}"/>`,
  chevron: (x, y) => `<path class="sunl" d="M${r(x)},${r(y - 3.5)}l3.5,3.5l-3.5,3.5"/>`,
  check: (x, y, s = 8, cls = 'sunl') => `<path class="${cls}" d="M${r(x)},${r(y)}l${r(s * 0.36)},${r(s * 0.36)}l${r(s * 0.64)},-${r(s * 0.74)}"/>`,
  arrowRight: (x, y, w = 22) => `<path class="sunl" d="M${r(x)},${r(y)}h${w}m-5,-5l5,5l-5,5"/>`,
  tri: (x, y, fill = C.sun) => `<path fill="${fill}" d="M${r(x)},${r(y - 3.5)}l4.5,3.5l-4.5,3.5Z"/>`,
}

// reveals end on the visible state, so with reduced motion (animation: none)
// nothing stays hidden
const BASE_CSS = `
@keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
.rise{animation:rise .62s ${EASE} both;transform-box:fill-box}
@keyframes fade{from{opacity:0}to{opacity:1}}
.fade{animation:fade .9s ${EASE} both}
@keyframes draw{from{stroke-dashoffset:var(--len)}to{stroke-dashoffset:0}}
.draw{stroke-dasharray:var(--len);animation:draw 1.1s ${EASE} both}
@keyframes odo{from{transform:translateY(0)}to{transform:translateY(var(--to))}}
.odo{transform:translateY(var(--to));animation:odo 1.6s cubic-bezier(.16,1,.3,1) both}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
.blink{animation:blink 1.1s steps(1) infinite}
@keyframes nudge{0%,72%,100%{transform:none}82%{transform:translate(2px,-2px)}}
.nudge{animation:nudge 3.4s ease-in-out infinite}
@keyframes spin{to{transform:rotate(1turn)}}
@media(prefers-reduced-motion:reduce){*{animation:none!important}}`

function svg({ h, w = W, faces, css = '', defs = '', body, label }) {
  const fontCss = faces.map((k) => {
    const [family, , style] = FACES[k]
    return `@font-face{font-family:${family};src:url(data:font/woff2;base64,${fontData[k]}) format("woff2");font-style:${style}}`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<defs>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
${defs}
</defs>
<style>${fontCss}
.m{font-family:nm-sm,ui-monospace,monospace;fill:${C.muted}}.m:not([font-size]){font-size:10px}.m:not([letter-spacing]){letter-spacing:.14em}
.d{font-family:nm-fr,Georgia,serif;fill:${C.ink}}
.i{font-family:nm-fri,Georgia,serif;font-style:italic;fill:${C.muted}}
.s{font-family:nm-sg,system-ui,sans-serif;fill:${C.dim}}
.l{font-family:nm-sgl,system-ui,sans-serif;fill:${C.ink}}
.j{font-family:nm-jp,sans-serif;fill:${C.ink}}
.ink{fill:${C.ink}}.dim{fill:${C.dim}}.mut{fill:${C.muted}}.fnt{fill:${C.faint}}.sun{fill:${C.sun}}
.hair{fill:none;stroke:${C.line};stroke-width:1}.soft{fill:none;stroke:${C.soft};stroke-width:1}.strong{fill:none;stroke:${C.strong};stroke-width:1}
.sunl{fill:none;stroke:${C.sun};stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
${BASE_CSS}
${css}
</style>
<rect width="${w}" height="${h}" rx="2" fill="${C.paper}"/>
${body}
<rect width="${w}" height="${h}" rx="2" filter="url(#grain)" opacity=".055" pointer-events="none"/>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="2" class="soft"/>
</svg>\n`
}

function head(index, title, folio, arrow = false) {
  const fx = arrow ? W - PAD - 15 : W - PAD
  return `<text class="m" x="${PAD}" y="30"><tspan class="sun">${index}</tspan>  ${esc(title.toUpperCase())}</text>
<text class="m fnt" x="${fx}" y="30" text-anchor="end">${esc(folio.toUpperCase())}</text>
${arrow ? `<g class="nudge">${icon.upRight(W - PAD - 9, 21.5, 8)}</g>` : ''}
<line class="hair" x1="${PAD}" x2="${W - PAD}" y1="42.5" y2="42.5"/>`
}

function specRow(y, label, value, right, t, valueSvg) {
  const lw = monoW(label)
  const avail = right - PAD - lw - 36
  const size = valueSvg ? 14 : fit(value, 'sg', 14, avail, 11)
  const vw = valueSvg ? valueSvg.width : measure(value, 'sg', size)
  const x1 = PAD + lw + 12
  const x2 = right - vw - 12
  const len = Math.max(0, x2 - x1)
  return `<g class="rise" style="${delay(t)}"><text class="m" x="${PAD}" y="${y}">${esc(label)}</text></g>
<line class="soft draw" style="--len:${r(len)};${delay(t + 0.05)}" x1="${r(x1)}" x2="${r(x2)}" y1="${y - 3.5}" y2="${y - 3.5}"/>
<g class="rise" style="${delay(t + 0.12)}">${valueSvg ? valueSvg.svg : `<text class="s ink" x="${right}" y="${y}" font-size="${r(size)}" text-anchor="end">${esc(value)}</text>`}</g>`
}

let clipSeq = 0
const odoWidth = (text, face, size) => [...text].reduce((w, ch) => w + (/\d/.test(ch) ? measure('0', face, size) : measure(ch, face, size)), 0)
function odometer(x, y, value, size, t, face = 'sgl', cls = 'l') {
  const text = fmt(value)
  const digitW = measure('0', face, size)
  const lh = r(size * 1.18)
  let cx = x
  let out = ''
  ;[...text].forEach((ch, i) => {
    if (!/\d/.test(ch)) {
      out += `<text class="${cls}" x="${r(cx)}" y="${y}" font-size="${size}">${esc(ch)}</text>`
      cx += measure(ch, face, size)
      return
    }
    const d = +ch
    const id = `odo${++clipSeq}`
    const strip = [...'01234567890123456789'].map((n, k) =>
      `<text class="${cls}" x="${r(cx + digitW / 2)}" y="${r(y + k * lh)}" font-size="${size}" text-anchor="middle">${n}</text>`).join('')
    out += `<clipPath id="${id}"><rect x="${r(cx - 1)}" y="${r(y - size)}" width="${r(digitW + 2)}" height="${r(size * 1.3)}"/></clipPath>
<g clip-path="url(#${id})"><g class="odo" style="--to:${-(10 + d) * lh}px;${delay(t + i * 0.06)}">${strip}</g></g>`
    cx += digitW
  })
  return { svg: out, width: cx - x }
}

function barcode(x, y, w, h, seed) {
  const rand = rng(seedOf(seed))
  let cx = x
  let out = ''
  while (cx < x + w) {
    const bw = rand() < 0.62 ? 1 : rand() < 0.7 ? 2 : 3
    if (cx + bw > x + w) break
    out += `<rect x="${r(cx)}" y="${y}" width="${bw}" height="${h}" fill="${C.ink}" opacity="${rand() < 0.15 ? 0.45 : 0.85}"/>`
    cx += bw + (rand() < 0.5 ? 1 : 2)
  }
  return out
}

const motto = (x, y, size, t) => {
  const jw = measure('力と美のために', 'jp', size)
  return `<g class="rise" style="${delay(t)}"><text class="j" x="${x}" y="${y}" font-size="${size}">力と美のために</text>
<text class="i" x="${r(x + jw + 12)}" y="${y}" font-size="${size}">for the sake of power and beauty</text></g>`
}

// each value falls back to data.json on its own, so one failed request
// doesn't blank the rest
const cacheUrl = new URL('data.json', DIR)
const cached = existsSync(cacheUrl) ? JSON.parse(readFileSync(cacheUrl)) : {}

async function fetchData() {
  const headers = { 'User-Agent': `${USER}-profile`, Accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const gh = async (path) => {
    const res = await fetch(`https://api.github.com/${path}`, { headers })
    if (!res.ok) throw new Error(`${path}: ${res.status}`)
    return res
  }
  const tasks = {
    ryoku: async () => {
      const x = await (await gh(`repos/${RY.repo}`)).json()
      return { stars: x.stargazers_count, forks: x.forks_count }
    },
    contributors: async () => {
      const list = []
      for (let page = 1; ; page++) {
        const batch = await (await gh(`repos/${RY.repo}/contributors?per_page=100&page=${page}`)).json()
        list.push(...batch)
        if (batch.length < 100) break
      }
      const people = list.filter((c) => c.type !== 'Bot')
      const me = people.find((c) => c.login.toLowerCase() === USER.toLowerCase())
      return { count: people.length, mine: me ? me.contributions : 0 }
    },
    commits: async () => {
      const res = await gh(`repos/${RY.repo}/commits?per_page=1`)
      const last = (res.headers.get('link') || '').match(/[?&]page=(\d+)>; rel="last"/)
      return last ? +last[1] : (await res.json()).length
    },
    languages: async () => (await gh(`repos/${RY.repo}/languages`)).json(),
    release: async () => {
      const res = await fetch(RY.release)
      if (!res.ok) throw new Error(`${RY.release}: ${res.status}`)
      const j = await res.json()
      return { release: j.release, name: j.name }
    },
    work: async () => Object.fromEntries(await Promise.all((ME.work || []).map(async (w) => {
      const x = await (await gh(`repos/${w.repo}`)).json()
      return [w.repo, { stars: x.stargazers_count, language: x.language }]
    }))),
  }
  const keys = Object.keys(tasks)
  const settled = await Promise.allSettled(keys.map((k) => tasks[k]()))
  const out = {}
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') out[keys[i]] = s.value
    else {
      console.warn(`${keys[i]}: ${s.reason.message}; using the cached value`)
      out[keys[i]] = cached[keys[i]]
    }
  })
  return out
}

const D = await fetchData()
writeFileSync(cacheUrl, JSON.stringify(D, null, 2) + '\n')
const workStats = (repo) => (D.work && D.work[repo]) || { stars: 0, language: null }
const liveValue = (token) => ({ '@commits': D.contributors?.mine ?? 0 })[token]

function cover(index) {
  const H = 452
  const LEFT = 470
  let body = `<text class="m" x="${PAD}" y="30"><tspan class="j" font-size="11" letter-spacing="0">力</tspan>  RYOKU TEAM</text>
<text class="m fnt" x="${W - PAD}" y="30" text-anchor="end">${esc(USER.toUpperCase())} · SHEET ${index}</text>
<line class="hair" x1="${PAD}" x2="${W - PAD}" y1="42.5" y2="42.5"/>`

  const size = r(fit(USER, 'fr', 92, LEFT - PAD - 6, 40))
  const sunAt = ME.sun ? USER.indexOf(ME.sun) : -1
  let x = PAD - 3
  ;[...USER].forEach((ch, i) => {
    body += `<text class="d rise${i === sunAt ? ' sun' : ''}" style="${delay(0.08 + i * 0.05)}" x="${r(x)}" y="146" font-size="${size}" letter-spacing="-.01em">${esc(ch)}</text>`
    x += measure(ch, 'fr', size) - size * 0.01
  })
  body += motto(PAD, 182, 15, 0.55)

  ;(ME.rows || []).slice(0, 4).forEach(([label, value], i) => {
    const y = 232 + i * 34
    let valueSvg = null
    if (typeof value === 'string' && value.startsWith('@')) {
      const n = liveValue(value)
      const w = odoWidth(fmt(n), 'sg', 14)
      valueSvg = { width: w, svg: odometer(LEFT - w, y, n, 14, 0.9 + i * 0.12, 'sg', 's ink').svg }
    }
    body += specRow(y, label, valueSvg ? '' : value, LEFT, 0.7 + i * 0.12, valueSvg)
    body += `<line class="soft" x1="${PAD}" x2="${LEFT}" y1="${y + 13.5}" y2="${y + 13.5}"/>`
  })

  let plate = null
  if (ME.now === '@release' && D.release) plate = ['CURRENT RELEASE', `Ryoku ${D.release.name} ${D.release.release}`]
  else if (ME.now && !String(ME.now).startsWith('@')) plate = ['NOW', ME.now]
  if (plate) {
    const by = 384
    body += `<g class="fade" style="${delay(1.3)}">
<rect x="${PAD + 0.5}" y="${by + 0.5}" width="${LEFT - PAD - 1}" height="44" rx="2" class="hair"/>
<rect x="${PAD + 0.5}" y="${by + 0.5}" width="2" height="44" fill="${C.sun}"/>
<circle class="blink" cx="${PAD + 20}" cy="${by + 22}" r="3.2" fill="${C.sun}"/>
<text class="m" x="${PAD + 32}" y="${by + 19}">${esc(plate[0])}</text>
<text class="s ink" x="${PAD + 32}" y="${by + 35}" font-size="${r(fit(plate[1], 'sg', 13, LEFT - PAD - 48, 10))}">${esc(plate[1])}</text>
</g>`
  }

  const [pw, ph] = PORTRAITS[portrait]
  const bw = 300
  const bh = r((bw * ph) / pw)
  const bx = W - PAD - bw - 8
  const byy = H - bh
  const cx = bx + bw * 0.52
  const cy = 232
  const rad = 178
  const circ = r(2 * Math.PI * rad)
  const defs = `<mask id="figure" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><image href="data:image/png;base64,${ART.portrait}" x="${bx}" y="${byy}" width="${bw}" height="${bh}"/></mask>
<clipPath id="scan"><rect class="scan" x="${bx}" y="${byy - 30}" width="${bw}" height="26"/></clipPath>
<linearGradient id="scanfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sun}" stop-opacity="0"/><stop offset="1" stop-color="${C.sun}" stop-opacity="1"/></linearGradient>
<clipPath id="sheet"><rect width="${W}" height="${H}" rx="2"/></clipPath>`
  body += `<g clip-path="url(#sheet)">
<circle class="hair draw" style="--len:${circ};${delay(0.4)}" cx="${r(cx)}" cy="${cy}" r="${rad}" transform="rotate(-90 ${r(cx)} ${cy})"/>
<g class="fade" style="${delay(0.3)}"><rect x="${bx}" y="${byy}" width="${bw}" height="${bh}" fill="${C.ink}" mask="url(#figure)" opacity=".92"/></g>
<g clip-path="url(#scan)"><rect x="${bx}" y="${byy}" width="${bw}" height="${bh}" fill="${C.sun}" mask="url(#figure)"/></g>
<rect class="scanl" x="${bx - 20}" y="${byy - 4}" width="${bw + 40}" height="1.2" fill="url(#scanfade)" opacity=".9"/>
<g class="orbit" style="transform-origin:${r(cx)}px ${cy}px"><circle cx="${r(cx)}" cy="${cy - rad}" r="3.4" fill="${C.sun}"/></g>
</g>
<text class="j mut" x="${W - 22}" y="212" font-size="13" text-anchor="middle">力</text>
<circle cx="${W - 22}" cy="232" r="1.6" fill="${C.faint}"/>
<text class="j mut" x="${W - 22}" y="262" font-size="13" text-anchor="middle">美</text>`

  // CSS instead of SMIL so reduced motion stops these too; at rest the scan
  // band and line sit off the figure
  const lineDrop = r(H + 30 - byy)
  const css = `@keyframes scan{0%{transform:none}62%,100%{transform:translateY(${r(H - byy + 30)}px)}}.scan{animation:scan 7.5s linear 1.6s infinite}
@keyframes scanl{0%{transform:none}62%,100%{transform:translateY(${lineDrop}px)}}.scanl{transform:translateY(${lineDrop}px);animation:scanl 7.5s linear 1.6s infinite}
.orbit{animation:spin 32s linear infinite}`
  const role = (ME.rows || []).find(([l]) => l === 'ROLE')
  return svg({ h: H, faces: ['fr', 'fri', 'sg', 'sm', 'jp'], css, defs, body, label: `${USER}${role ? `, ${role[1]}` : ''}. For the sake of power and beauty.` })
}

function project(index) {
  const LEFT = 470
  let body = head(index, 'the project', RY.repo, true)
  body += `<g class="rise" style="${delay(0.05)}"><image href="data:image/svg+xml;base64,${ART.mark}" x="${PAD}" y="66" width="56" height="48.5"/></g>`
  const tw = measure('Ryoku', 'fr', 64) - 0.64
  body += `<g class="rise" style="${delay(0.12)}"><text class="d" x="${PAD + 68}" y="112" font-size="64" letter-spacing="-.01em">Ryoku</text>
<text class="d mut" x="${r(PAD + 68 + tw + 3)}" y="82" font-size="20">™</text></g>`
  body += motto(PAD, 146, 13, 0.22)
  const about = wrap(RY.about, 'sg', 14, LEFT - PAD)
  about.forEach((l, i) => {
    body += `<text class="s rise" style="${delay(0.3 + i * 0.06)}" x="${PAD}" y="${180 + i * 21}" font-size="14">${esc(l)}</text>`
  })
  const rowTop = 180 + about.length * 21 + 26

  let css = ''
  RY.rows.forEach(([label, value], i) => {
    const y = rowTop + i * 30
    let valueSvg = null
    if (value.startsWith('@swap ')) {
      const [a, b] = value.slice(6).split('|')
      const aw = measure(a, 'sg', 14)
      const bwid = measure(b, 'sg', 14)
      const width = aw + 26 + bwid
      const sx = LEFT - width
      valueSvg = {
        width,
        svg: `<g class="swapA"><text class="s ink" x="${r(sx)}" y="${y}" font-size="14">${esc(a)}</text></g>
<g class="swapI">${icon.swap(sx + aw + 6, y - 4.5)}</g>
<g class="swapB"><text class="s ink" x="${r(sx + aw + 26)}" y="${y}" font-size="14">${esc(b)}</text></g>`,
      }
      // the arrow moves by the width difference so it stays between the names
      const trade = (name, dx) => `@keyframes ${name}{0%,40%{transform:none;opacity:1}45%{opacity:.2}50%,90%{transform:translateX(${r(dx)}px);opacity:1}95%{opacity:.2}100%{transform:none;opacity:1}}.${name}{animation:${name} 6s ${EASE} infinite;animation-delay:2s}\n`
      css += trade('swapA', width - aw) + trade('swapB', -(aw + 26))
      css += `@keyframes swapI{0%,40%{transform:none}50%,90%{transform:translateX(${r(bwid - aw)}px) rotate(180deg)}100%{transform:none}}.swapI{transform-box:fill-box;transform-origin:center;animation:swapI 6s ${EASE} infinite;animation-delay:2s}\n`
    }
    body += specRow(y, label, valueSvg ? '' : value, LEFT, 0.45 + i * 0.1, valueSvg)
    body += `<line class="soft" x1="${PAD}" x2="${LEFT}" y1="${y + 11.5}" y2="${y + 11.5}"/>`
  })

  const vy = rowTop + RY.rows.length * 30 + 4
  const vitals = [[D.ryoku?.stars, 'STARS'], [D.ryoku?.forks, 'FORKS'], [D.contributors?.count, 'CONTRIBUTORS'], [D.commits, 'COMMITS']]
  const vw = (LEFT - PAD) / vitals.length
  vitals.forEach(([n, label], i) => {
    const x = PAD + i * vw
    body += `<rect x="${r(x) + 0.5}" y="${vy + 0.5}" width="${r(vw) - 1}" height="55" class="hair"/>`
    body += odometer(x + 12, vy + 30, n || 0, 24, 1.0 + i * 0.1).svg
    body += `<text class="m fnt" x="${r(x + 12)}" y="${vy + 47}" font-size="9">${label}</text>`
  })

  // When the rail moves to an edition with different colours, this plays the
  // site's edition switch (ryoku-site docs/design-system.md): a flood spreads
  // from the edition name, the plate changes colour under it, then it fades.
  const tx = 506
  const rw = W - PAD - tx
  const ty = 60
  const codeY = vy
  const codeH = 34
  const railY = vy - 40
  const th = railY - 34 - ty
  const iw = r((th * 1600) / 893)
  const ix = r(tx + rw / 2 - iw / 2)
  const eds = RY.editions
  const N = eds.length
  const slot = rw / N
  const signal = (e) => e.hue || C.sun
  const stock = (e) => [e.paper || C.paper, e.ink || C.ink]
  const sameStock = (a, b) => String(stock(a)) === String(stock(b))
  // in seconds; GROW and FADE are the site's 460 and 280 ms
  const SLOT = 3
  const TRAVEL = 0.5
  const GROW = 0.46
  const FADE = 0.28
  const CYCLE = SLOT * N
  const pc = (t) => r((t / CYCLE) * 100, 3)
  // head back to the first edition early so its flood ends before the loop does
  const back = CYCLE - GROW - FADE
  const home = back + TRAVEL
  const arrive = (k) => k * SLOT
  const leave = (k) => (k + 1 < N ? (k + 1) * SLOT - TRAVEL : back)

  let pip = `0%,${pc(leave(0))}%{transform:none;fill:${signal(eds[0])}}`
  for (let k = 1; k < N; k++) pip += `${pc(arrive(k))}%,${pc(leave(k))}%{transform:translateX(${r(k * slot)}px);fill:${signal(eds[k])}}`
  css += `@keyframes pip{${pip}${pc(home)}%,100%{transform:none;fill:${signal(eds[0])}}}.pip{animation:pip ${CYCLE}s cubic-bezier(.6,0,.2,1) infinite}\n`
  const Q = 0.15
  eds.forEach((e, k) => {
    const on = e.stable ? C.ink : signal(e)
    const off = e.stable ? C.muted : C.faint
    const frames = k
      ? `0%,${pc(arrive(k) - Q)}%{fill:${off}}${pc(arrive(k))}%,${pc(leave(k))}%{fill:${on}}${pc(leave(k) + Q)}%,100%{fill:${off}}`
      : `0%,${pc(leave(0))}%{fill:${on}}${pc(leave(0) + Q)}%,${pc(home - Q)}%{fill:${off}}${pc(home)}%,100%{fill:${on}}`
    css += `@keyframes ed${k}{${frames}}.ed${k}{fill:${k ? off : on};animation:ed${k} ${CYCLE}s linear infinite}\n`
  })

  const drops = []
  for (let k = 1; k < N; k++) if (!sameStock(eds[k], eds[k - 1])) drops.push([k, leave(k - 1)])
  if (N > 1 && !sameStock(eds[N - 1], eds[0])) drops.push([0, back])
  let floods = ''
  drops.forEach(([k, start], j) => {
    const ox = r(tx + k * slot + (slot - 12) / 2)
    const oy = railY + 2
    const R = r(Math.hypot(Math.max(ox - tx, tx + rw - ox), oy - ty) + 2)
    floods += `<g class="fl${j}" style="transform-origin:${ox}px ${oy}px"><circle cx="${ox}" cy="${oy}" r="${R}" fill="${stock(eds[k])[0]}" fill-opacity=".8"/>
<circle cx="${ox}" cy="${oy}" r="${R + 6}" fill="none" stroke="${signal(eds[k])}" stroke-opacity=".9" stroke-width="1.4" vector-effect="non-scaling-stroke"/></g>`
    css += `@keyframes fl${j}{0%,${pc(start)}%{transform:scale(0);opacity:1;animation-timing-function:${EASE}}${pc(start + GROW)}%{transform:none;opacity:1;animation-timing-function:linear}${pc(start + GROW + FADE)}%,100%{transform:none;opacity:0}}.fl${j}{transform:scale(0);animation:fl${j} ${CYCLE}s infinite}\n`
  })
  // swap the plate's colours while the flood covers it, so the switch isn't seen
  const swaps = drops.map(([k, start]) => [start + GROW, stock(eds[k])]).sort((a, b) => a[0] - b[0])
  ;[0, 1].forEach((i) => {
    let cur = stock(eds[0])[i]
    let frames = `0%{fill:${cur}}`
    for (const [t, s] of swaps) {
      frames += `${r(pc(t) - 0.01, 3)}%{fill:${cur}}${pc(t)}%{fill:${s[i]}}`
      cur = s[i]
    }
    css += `@keyframes stk${i}{${frames}100%{fill:${cur}}}.stk${i}{animation:stk${i} ${CYCLE}s linear infinite}\n`
  })

  const defs = `<mask id="torii" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="700"><image href="data:image/png;base64,${ART.torii}" x="${ix}" y="${ty}" width="${iw}" height="${th}"/></mask>
<clipPath id="col"><rect x="${tx}" y="${ty}" width="${rw}" height="${th}"/></clipPath>
<clipPath id="code"><rect x="${tx}" y="${codeY - 2}" width="${rw}" height="${codeH + 4}"/></clipPath>`
  const stableN = eds.filter((e) => e.stable).length
  let rail = `<text class="m fnt" x="${tx}" y="${railY - 12}" font-size="9">STABLE</text>`
  if (stableN < N) rail += `<text class="m fnt" x="${r(tx + stableN * slot)}" y="${railY - 12}" font-size="9">EXPERIMENTAL</text>`
  eds.forEach((e, k) => {
    rail += `<text class="m ed${k}" x="${r(tx + k * slot)}" y="${railY + 6}" font-size="${r(Math.min(10, fit(e.name, 'sm', 10, slot - 10)), 2)}">${esc(e.name)}</text>`
  })
  rail += `<rect x="${tx}" y="${railY + 13}" width="${r(rw)}" height="1" fill="${C.soft}"/><rect class="pip" x="${tx}" y="${railY + 12}" width="${r(slot - 12)}" height="2" fill="${signal(eds[0])}"/>`
  body += `<g clip-path="url(#col)"><rect class="stk0" x="${tx}" y="${ty}" width="${rw}" height="${th}" fill="${stock(eds[0])[0]}"/>
<g class="fade" style="${delay(0.35)}"><rect class="stk1" x="${ix}" y="${ty}" width="${iw}" height="${th}" fill="${stock(eds[0])[1]}" mask="url(#torii)" opacity=".86"/></g>
${floods}</g>
<line class="hair" x1="${tx}" x2="${W - PAD}" y1="${ty + th + 8.5}" y2="${ty + th + 8.5}"/>
<g class="fade" style="${delay(0.7)}">${rail}</g>
<g class="fade" style="${delay(0.85)}">${barcode(tx, codeY, rw, codeH, RY.repo)}</g>
<g clip-path="url(#code)"><rect class="read" x="${tx}" y="${codeY - 2}" width="2" height="${codeH + 4}" fill="${C.sun}"/></g>
<text class="m fnt" x="${tx}" y="${vy + 47}" font-size="9">GPL-3.0</text>
<text class="m fnt" x="${W - PAD}" y="${vy + 47}" font-size="9" text-anchor="end">RYOKU.DEV</text>`
  css += `@keyframes read{0%{transform:translateX(0);opacity:0}6%{opacity:1}58%{transform:translateX(${r(rw)}px);opacity:1}62%,100%{transform:translateX(${r(rw)}px);opacity:0}}.read{animation:read 5.5s cubic-bezier(.45,0,.4,1) infinite;animation-delay:1.4s}`

  const ly = vy + 55 + 40
  const langs = Object.entries(D.languages || {}).sort((a, b) => b[1] - a[1])
  const top = langs.slice(0, 5)
  const rest = langs.slice(5).reduce((s, [, v]) => s + v, 0)
  if (rest) top.push(['Other', rest])
  const sum = top.reduce((s, [, v]) => s + v, 0) || 1
  body += `<text class="m" x="${PAD}" y="${ly - 12}" font-size="9">WRITTEN IN</text>
<text class="m fnt" x="${W - PAD}" y="${ly - 12}" font-size="9" text-anchor="end">BY BYTES, FROM GITHUB</text>`
  let lx = PAD
  const bw = W - PAD * 2
  top.forEach(([lang, v], i) => {
    const w = (v / sum) * bw
    css += `@keyframes lg${i}{from{transform:scaleX(0)}to{transform:none}}.lg${i}{transform-box:fill-box;transform-origin:left;animation:lg${i} .9s ${EASE} both;animation-delay:${r(1.2 + i * 0.12, 2)}s}`
    body += `<rect class="lg${i}" x="${r(lx)}" y="${ly}" width="${r(Math.max(1, w - 2))}" height="6" fill="${i === 0 ? C.sun : C.ink}" fill-opacity="${i === 0 ? 1 : r(Math.max(0.18, 0.8 - i * 0.13), 2)}"/>`
    const label = `${lang.toUpperCase()} ${Math.round((v / sum) * 100)}%`
    if (w > monoW(label, 9) + 10) body += `<text class="m rise" style="${delay(1.4 + i * 0.12)}" x="${r(lx)}" y="${ly + 22}" font-size="9">${esc(lang.toUpperCase())} <tspan class="fnt">${Math.round((v / sum) * 100)}%</tspan></text>`
    lx += w
  })

  return svg({ h: ly + 40, faces: ['fr', 'sg', 'sgl', 'sm', 'jp', 'fri'], css, defs, body, label: `Ryoku: ${RY.about} ${fmt(D.ryoku?.stars)} stars, ${fmt(D.contributors?.count)} contributors.` })
}

function desktop(index) {
  const fx = PAD
  const fy = 60
  const fw = W - PAD * 2
  const fh = r((fw * 9) / 16)
  const shots = RY.shots
  const N = shots.length
  const SLOT = 4.2
  const CYCLE = SLOT * N
  const pct = (k) => (k * 100) / N
  const fadeP = (0.7 / CYCLE) * 100
  let css = ''
  let layers = ''
  shots.forEach((s, k) => {
    const data = b64(`art/showroom/${s.file}`)
    if (k > 0) {
      css += `@keyframes shot${k}{0%,${r(pct(k) - fadeP)}%{opacity:0}${r(pct(k))}%,${r(100 - fadeP)}%{opacity:1}100%{opacity:0}}.shot${k}{opacity:0;animation:shot${k} ${CYCLE}s linear infinite}`
    }
    layers += `<image class="${k ? `shot${k}` : ''}" href="data:image/webp;base64,${data}" x="${fx}" y="${fy}" width="${fw}" height="${fh}" preserveAspectRatio="xMidYMid slice"/>`
  })
  const defs = `<clipPath id="frame"><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="2"/></clipPath>`
  let body = head(index, 'the desktop', 'showroom', true)
  body += `<g class="fade" style="${delay(0.1)}" clip-path="url(#frame)">${layers}</g>
<rect x="${fx + 0.5}" y="${fy + 0.5}" width="${fw - 1}" height="${fh - 1}" rx="2" class="strong"/>`

  const cy = fy + fh + 30
  const cw = fw / N
  shots.forEach((s, k) => {
    const x = fx + k * cw
    // steps(1) holds each value until the next keyframe, so every caption needs
    // its own off frame. With motion off only the first one is lit.
    const lit = (name, off, on) => `@keyframes ${name}{0%{fill:${k ? off : on}}${r(pct(k))}%{fill:${on}}${r(pct(k + 1))}%{fill:${off}}100%{fill:${off}}}.${name}{fill:${k ? off : on};animation:${name} ${CYCLE}s steps(1) infinite}\n`
    css += lit(`cap${k}`, C.muted, C.ink) + lit(`idx${k}`, C.faint, C.sun)
    css += `@keyframes trk${k}{0%,${r(pct(k))}%{transform:scaleX(0)}${r(pct(k + 1))}%{transform:scaleX(1)}${r(Math.min(100, pct(k + 1) + 0.01))}%,100%{transform:scaleX(0)}}.trk${k}{transform-box:fill-box;transform-origin:left;transform:scaleX(${k ? 0 : 1});animation:trk${k} ${CYCLE}s linear infinite}`
    body += `<rect x="${r(x)}" y="${cy - 14}" width="${r(cw - 16)}" height="1" fill="${C.soft}"/><rect class="trk${k}" x="${r(x)}" y="${cy - 14.5}" width="${r(cw - 16)}" height="2" fill="${C.sun}"/>
<text class="m idx${k}" x="${r(x)}" y="${cy + 6}">${String(k + 1).padStart(2, '0')}</text>
<text class="d cap${k}" x="${r(x + 30)}" y="${cy + 8}" font-size="18">${esc(s.title)}</text>
<text class="i" x="${r(x + 30)}" y="${cy + 27}" font-size="12">${esc(s.note)}</text>`
  })
  body += `<text class="m fnt" x="${W - PAD}" y="${cy + 54}" font-size="9" text-anchor="end">THE SHELL TAKES ITS COLOURS FROM THE WALLPAPER</text>`
  return svg({ h: cy + 72, faces: ['fr', 'fri', 'sm'], css, defs, body, label: `The Ryoku desktop: ${shots.map((s) => s.title).join(', ')}.` })
}

// the command spans the full width so the long install URL fits on one line
function get(index) {
  const { iso, convert } = RY.get
  let body = head(index, 'get ryoku', 'install guide', true)
  const rx = 404
  const rw = W - PAD - rx
  const row = (top, path, t) => {
    const base = top + 32
    const lines = wrap(path.note, 'sg', 12.5, rw)
    let out = `<g class="rise" style="${delay(t)}"><text class="m" x="${PAD}" y="${top}">${esc(path.label)}</text>
<text class="d" x="${PAD}" y="${base}" font-size="26">${esc(path.title)}</text></g>`
    lines.forEach((l, i) => {
      out += `<text class="s mut rise" style="${delay(t + 0.1 + i * 0.06)}" x="${rx}" y="${base - (lines.length - 1 - i) * 18}" font-size="12.5">${esc(l)}</text>`
    })
    return out
  }
  body += row(74, iso, 0.1)
  body += `<line class="hair draw" style="--len:${W - 2 * PAD};${delay(0.25)}" x1="${PAD}" x2="${W - PAD}" y1="132.5" y2="132.5"/>`
  body += row(164, convert, 0.3)
  const by = 218
  const bh = 44
  const tx = PAD + 28
  const cmd = convert.command
  const fs = r(fit(cmd, 'sm', 12, W - 2 * PAD - 52, 9), 2)
  const cw = measure(cmd, 'sm', fs)
  const n = cmd.length
  const dur = r(Math.max(8, n / 11), 1)
  // with motion off the caret rests at the end instead of over the first letter
  const css = `@keyframes type{0%,6%{transform:scaleX(0)}46%,92%{transform:scaleX(1)}100%{transform:scaleX(0)}}.type{transform-box:fill-box;transform-origin:left;animation:type ${dur}s steps(${n}) infinite}
@keyframes caret{0%,6%{transform:none}46%,92%{transform:translateX(${r(cw)}px)}100%{transform:none}}.caret{transform:translateX(${r(cw)}px);animation:caret ${dur}s steps(${n}) infinite,blink 1s steps(1) infinite}`
  const defs = `<clipPath id="cmd"><rect class="type" x="${tx}" y="${by + 10}" width="${r(cw + 1)}" height="24"/></clipPath>`
  body += `<g class="fade" style="${delay(0.45)}"><rect x="${PAD + 0.5}" y="${by + 0.5}" width="${W - 2 * PAD - 1}" height="${bh - 1}" rx="2" class="strong"/>
${icon.chevron(PAD + 14, by + bh / 2)}
<text class="m ink" clip-path="url(#cmd)" x="${tx}" y="${r(by + bh / 2 + fs * 0.36)}" font-size="${fs}" letter-spacing="0">${esc(cmd)}</text>
<rect class="caret" x="${tx}" y="${r(by + bh / 2 - fs * 0.55)}" width="${r(fs * 0.55)}" height="${r(fs * 1.1)}" fill="${C.ink}"/></g>`
  return svg({ h: by + bh + 26, faces: ['fr', 'sg', 'sm'], css, defs, body, label: `Get Ryoku. ${iso.label.toLowerCase()}: ${iso.title.toLowerCase()}. ${convert.label.toLowerCase()}: ${cmd}` })
}

// icons for the focus cells, picked by name in profile.json
const GLYPHS = {
  tiles(cx, cy) {
    const vw = 72
    const vh = 48
    const x0 = cx - vw / 2
    const y0 = cy - vh / 2
    const col = 30
    let strip = ''
    for (let i = 0; i < 6; i++) {
      strip += `<rect x="${x0 + 4 + i * col}" y="${y0 + 6}" width="26" height="${vh - 12}" rx="1.5" fill="none" stroke="${i === 2 ? C.sun : C.ink}" stroke-opacity="${i === 2 ? 1 : 0.55}"/>
<rect x="${x0 + 8 + i * col}" y="${y0 + 11}" width="14" height="2" fill="${C.ink}" fill-opacity=".35"/>`
    }
    return {
      svg: `<clipPath id="vp"><rect x="${x0}" y="${y0}" width="${vw}" height="${vh}"/></clipPath>
<rect x="${x0 + 0.5}" y="${y0 + 0.5}" width="${vw - 1}" height="${vh - 1}" rx="2" class="strong"/>
<g clip-path="url(#vp)"><g class="strip">${strip}</g></g>
<rect x="${x0 + 22}" y="${y0 + vh + 7}" width="28" height="2" rx="1" fill="${C.ink}" fill-opacity=".25"/><rect class="dot" x="${x0 + 22}" y="${y0 + vh + 7}" width="9" height="2" rx="1" fill="${C.ink}"/>`,
      css: `@keyframes strip{0%,18%{transform:none}28%,48%{transform:translateX(-${col}px)}58%,78%{transform:translateX(-${col * 2}px)}88%,100%{transform:none}}.strip{animation:strip 7s cubic-bezier(.6,0,.2,1) infinite}
@keyframes dot{0%,18%{transform:none}28%,48%{transform:translateX(9.5px)}58%,78%{transform:translateX(19px)}88%,100%{transform:none}}.dot{animation:dot 7s cubic-bezier(.6,0,.2,1) infinite}`,
    }
  },
  install(cx, cy) {
    const w = 74
    const h = 50
    const x0 = cx - w / 2
    const y0 = cy - h / 2
    let logs = ''
    let css = ''
    ;[30, 44, 22].forEach((lw, i) => {
      logs += `<rect class="log${i}" x="${x0 + 8}" y="${y0 + 9 + i * 7}" width="${lw}" height="2" fill="${C.ink}" fill-opacity=".45"/>`
      css += `@keyframes log${i}{0%,${8 + i * 18}%{opacity:0}${12 + i * 18}%,88%{opacity:1}94%,100%{opacity:0}}.log${i}{animation:log${i} 6s linear infinite}`
    })
    return {
      svg: `<rect x="${x0 + 0.5}" y="${y0 + 0.5}" width="${w - 1}" height="${h - 1}" rx="2" class="strong"/>
${logs}
<rect x="${x0 + 8}" y="${y0 + h - 12}" width="${w - 30}" height="3" fill="${C.ink}" fill-opacity=".18"/>
<rect class="bar" x="${x0 + 8}" y="${y0 + h - 12}" width="${w - 30}" height="3" fill="${C.ink}"/>
<g class="ok">${icon.check(x0 + w - 17, y0 + h - 11, 9)}</g>`,
      css: `${css}@keyframes bar{0%,6%{transform:scaleX(0)}62%,88%{transform:scaleX(1)}94%,100%{transform:scaleX(0)}}.bar{transform-box:fill-box;transform-origin:left;animation:bar 6s steps(4) infinite}
@keyframes ok{0%,64%{opacity:0}68%,88%{opacity:1}94%,100%{opacity:0}}.ok{animation:ok 6s linear infinite}`,
    }
  },
  seal(cx, cy) {
    const s = 42
    const x0 = cx - s / 2 - 6
    const y0 = cy - s / 2
    const sx = x0 + s - 2
    const sy = y0 + s - 4
    return {
      svg: `<rect x="${x0 + 0.5}" y="${y0 + 0.5}" width="${s}" height="${s}" rx="2" class="strong"/>
<line x1="${x0 + s / 2}" x2="${x0 + s / 2}" y1="${y0 + 1}" y2="${y0 + 16}" stroke="${C.ink}" stroke-opacity=".5"/>
<rect x="${x0 + s / 2 - 8}" y="${y0 + 16}" width="16" height="7" rx="1" fill="none" stroke="${C.ink}" stroke-opacity=".5"/>
<g class="stamp"><circle cx="${sx}" cy="${sy}" r="10" fill="${C.sun}"/>${icon.check(sx - 4.5, sy, 9, 'tick')}</g>`,
      css: `.tick{fill:none;stroke:${C.paper};stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
@keyframes stamp{0%,28%{opacity:0;transform:scale(1.7)}36%{opacity:1;transform:scale(.94)}40%,86%{opacity:1;transform:none}94%,100%{opacity:0;transform:none}}.stamp{transform-box:fill-box;transform-origin:center;animation:stamp 5.5s cubic-bezier(.2,.8,.2,1) infinite}`,
    }
  },
  radar(cx, cy) {
    const R = 30
    let svg = `<circle class="soft" cx="${cx}" cy="${cy}" r="${R}"/><circle class="soft" cx="${cx}" cy="${cy}" r="${R / 2}"/>
<line class="soft" x1="${cx - R}" x2="${cx + R}" y1="${cy}" y2="${cy}"/><line class="soft" x1="${cx}" x2="${cx}" y1="${cy - R}" y2="${cy + R}"/>
<linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.ink}" stop-opacity="0"/><stop offset="1" stop-color="${C.ink}" stop-opacity=".32"/></linearGradient>
<g class="arm" style="transform-origin:${cx}px ${cy}px">
<path d="M${cx},${cy}L${cx + R},${cy}A${R},${R} 0 0 0 ${r(cx + R * Math.cos(-0.7))},${r(cy + R * Math.sin(-0.7))}Z" fill="url(#sweep)"/>
<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${C.ink}" stroke-opacity=".7"/></g>`
    let css = '.arm{animation:spin 4s linear infinite}'
    ;[[-12, -10, 0.18], [14, -16, 0.42], [9, 13, 0.66]].forEach(([dx, dy, a], i) => {
      css += `@keyframes blip${i}{0%,${r(a * 100 - 1)}%{opacity:0}${r(a * 100)}%{opacity:1}${r(a * 100 + 30)}%,100%{opacity:.08}}.blip${i}{animation:blip${i} 4s linear infinite}`
      svg += `<circle class="blip${i}" cx="${cx + dx}" cy="${cy + dy}" r="2.4" fill="${i === 1 ? C.sun : C.ink}"/>`
    })
    return { svg, css }
  },
}

function whoami(index) {
  const lines = wrap(ME.bio, 'sg', 16, W - PAD * 2 - 40)
  let body = head(index, 'whoami', `${USER} · sheet ${index}`)
  lines.forEach((line, i) => {
    body += `<text class="s rise" style="${delay(0.1 + i * 0.07)}" x="${PAD}" y="${82 + i * 27}" font-size="16">${esc(line)}</text>`
  })
  const focus = ME.focus || []
  const top = 82 + lines.length * 27 + 8
  if (!focus.length) return svg({ h: top + 10, faces: ['sg', 'sm'], body, label: `whoami: ${ME.bio}` })
  const cw = (W - PAD * 2 - 8 * (focus.length - 1)) / focus.length
  const ch = 118
  let css = ''
  focus.forEach((f, i) => {
    const x = PAD + i * (cw + 8)
    const g = (GLYPHS[f.glyph] || GLYPHS.tiles)(x + cw - 58, top + 66)
    css += g.css
    body += `<g class="rise" style="${delay(0.45 + i * 0.12)}">
<rect x="${r(x) + 0.5}" y="${top + 0.5}" width="${r(cw) - 1}" height="${ch - 1}" rx="2" class="hair"/>
<text class="m" x="${r(x + 14)}" y="${top + 24}">${esc(f.title)}</text>
${wrap(f.text, 'sg', 12, cw - 118).map((l, k) => `<text class="s mut" x="${r(x + 14)}" y="${top + 52 + k * 17}" font-size="12">${esc(l)}</text>`).join('')}
${g.svg}
</g>`
  })
  return svg({ h: top + ch + 28, faces: ['sg', 'sm'], css, body, label: `whoami: ${ME.bio}` })
}

// panels for the work rows, picked by name with `art` in profile.json
const ARTS = {
  bars(w, x, y, bw, bh) {
    const rows = w.rows || []
    const max = Math.max(...rows.map(([, n]) => n), 1)
    let svg = ''
    let css = ''
    rows.forEach(([src, n], i) => {
      const yy = y + 20 + i * 15
      const len = Math.max(4, (Math.log10(n + 1) / Math.log10(max + 1)) * (bw - 128))
      svg += `<text class="m" x="${x + 14}" y="${yy}" font-size="9" letter-spacing=".06em">${esc(src)}</text>
<rect class="g${i}" x="${x + 66}" y="${yy - 6}" width="${r(len)}" height="5" fill="${i === 0 ? C.sun : C.ink}" fill-opacity="${i === 0 ? 0.9 : 0.6}"/>
<text class="m g${i}t" x="${x + bw - 14}" y="${yy}" font-size="9" text-anchor="end" letter-spacing=".04em">${fmt(n)}</text>`
      css += `@keyframes g${i}{0%,${8 + i * 7}%{transform:scaleX(0)}${22 + i * 7}%,86%{transform:scaleX(1)}96%,100%{transform:scaleX(0)}}.g${i}{transform-box:fill-box;transform-origin:left;animation:g${i} 8s cubic-bezier(.2,.8,.2,1) infinite}
@keyframes g${i}t{0%,${18 + i * 7}%{opacity:0}${24 + i * 7}%,86%{opacity:1}94%,100%{opacity:0}}.g${i}t{animation:g${i}t 8s linear infinite}`
    })
    return { svg, css }
  },
  terminal(w, x, y) {
    const mx = x + 14
    const cmd = w.cmd || ''
    const cw = 9 * 0.612 + 0.54
    const n = cmd.length
    let svg = `${icon.chevron(mx, y + 19)}
<clipPath id="ty"><rect class="ty" x="${mx + 10}" y="${y + 10}" width="${r(n * cw)}" height="16"/></clipPath>
<text class="m ink" clip-path="url(#ty)" x="${mx + 10}" y="${y + 22}" font-size="9" letter-spacing=".06em">${esc(cmd)}</text>
<rect class="cur" x="${mx + 10}" y="${y + 14}" width="5" height="10" fill="${C.ink}"/>`
    ;(w.out || []).slice(0, 3).forEach(([a, b, c], i) => {
      const yy = y + 46 + i * 18
      const tw = measure(a + b, 'sm', 9, 0.54)
      svg += `<g class="o${i}"><rect x="${mx}" y="${yy - 10}" width="${r(tw + 10)}" height="14" rx="1.5" fill="none" stroke="${i === 0 ? C.sun : C.line}"/>
<text class="m ink" x="${mx + 5}" y="${yy}" font-size="9" letter-spacing=".06em">${esc(a)}<tspan class="${i === 0 ? 'sun' : 'mut'}">${esc(b)}</tspan></text>
<text class="m" x="${r(mx + tw + 18)}" y="${yy}" font-size="9" letter-spacing=".04em">${esc(c)}</text></g>`
    })
    const css = `@keyframes ty{0%,6%{transform:scaleX(0)}34%,90%{transform:scaleX(1)}100%{transform:scaleX(0)}}.ty{transform-box:fill-box;transform-origin:left;animation:ty 7s steps(${n}) infinite}
@keyframes cur{0%,6%{transform:none}34%,90%{transform:translateX(${r(n * cw)}px)}100%{transform:none}}.cur{transform:translateX(${r(n * cw)}px);animation:cur 7s steps(${n}) infinite,blink 1s steps(1) infinite}
@keyframes o0{0%,40%{opacity:0;transform:translateY(4px)}46%,90%{opacity:1;transform:none}96%,100%{opacity:0}}.o0{animation:o0 7s ${EASE} infinite}
@keyframes o1{0%,48%{opacity:0;transform:translateY(4px)}54%,90%{opacity:1;transform:none}96%,100%{opacity:0}}.o1{animation:o1 7s ${EASE} infinite}
@keyframes o2{0%,56%{opacity:0;transform:translateY(4px)}62%,90%{opacity:1;transform:none}96%,100%{opacity:0}}.o2{animation:o2 7s ${EASE} infinite}`
    return { svg, css }
  },
  ssh(w, x, y, bw) {
    const mx = x + 14
    const cmd = `ssh ${w.host || 'ryoku.dev'}`
    const cw = 9 * 0.612 + 0.54
    const n = cmd.length
    const items = (w.items || []).slice(0, 3)
    let svg = `${icon.chevron(mx, y + 19)}
<clipPath id="sy"><rect class="sy" x="${mx + 10}" y="${y + 10}" width="${r(n * cw)}" height="16"/></clipPath>
<text class="m ink" clip-path="url(#sy)" x="${mx + 10}" y="${y + 22}" font-size="9" letter-spacing=".06em">${esc(cmd)}</text>
<rect class="scur" x="${mx + 10}" y="${y + 14}" width="5" height="10" fill="${C.ink}"/>
<g class="tui"><text class="m fnt" x="${x + bw - 14}" y="${y + 22}" font-size="8" text-anchor="end">STORE</text>
<rect class="sel" x="${mx - 4}" y="${y + 33}" width="${bw - 20}" height="14" rx="1.5" fill="${C.sun}" fill-opacity=".14" stroke="${C.sun}" stroke-opacity=".7"/>`
    items.forEach((it, i) => {
      const yy = y + 43 + i * 16
      svg += `${icon.tri(mx + 1, yy - 3, i === 0 ? C.sun : C.faint)}<text class="m ink" x="${mx + 12}" y="${yy}" font-size="9" letter-spacing=".06em">${esc(it)}</text><text class="m fnt" x="${x + bw - 18}" y="${yy}" font-size="8" text-anchor="end">CURL</text>`
    })
    svg += '</g>'
    const css = `@keyframes sy{0%,4%{transform:scaleX(0)}22%,92%{transform:scaleX(1)}100%{transform:scaleX(0)}}.sy{transform-box:fill-box;transform-origin:left;animation:sy 8s steps(${n}) infinite}
@keyframes scur{0%,4%{transform:none;opacity:1}22%,26%{transform:translateX(${r(n * cw)}px);opacity:1}27%,100%{transform:translateX(${r(n * cw)}px);opacity:0}}.scur{animation:scur 8s steps(${n}) infinite}
@keyframes tui{0%,27%{opacity:0}31%,92%{opacity:1}97%,100%{opacity:0}}.tui{animation:tui 8s linear infinite}
@keyframes sel{0%,40%{transform:none}46%,60%{transform:translateY(16px)}66%,82%{transform:translateY(32px)}88%,100%{transform:none}}.sel{animation:sel 8s cubic-bezier(.6,0,.2,1) infinite}`
    return { svg, css }
  },
  grid(w, x, y, bw, bh) {
    const labels = w.labels || []
    const cols = 5
    const gw = (bw - 28 - (cols - 1) * 6) / cols
    const gh = 22
    let svg = `<text class="m fnt" x="${x + 14}" y="${y + 18}" font-size="8">${esc(labels.join('  ·  '))}</text>`
    let css = ''
    for (let row = 0; row < 2; row++) {
      for (let c = 0; c < cols; c++) {
        const k = row * cols + c
        const gx = x + 14 + c * (gw + 6)
        const gy = y + 28 + row * (gh + 6)
        const pick = k === 6
        svg += `<g class="t${k}"><rect x="${r(gx) + 0.5}" y="${gy + 0.5}" width="${r(gw) - 1}" height="${gh - 1}" rx="1.5" fill="none" stroke="${pick ? C.sun : C.ink}" stroke-opacity="${pick ? 1 : 0.4}"/>
<rect x="${r(gx + 5)}" y="${gy + 6}" width="${r(gw * 0.5)}" height="2" fill="${C.ink}" fill-opacity=".45"/><rect x="${r(gx + 5)}" y="${gy + 12}" width="${r(gw * 0.3)}" height="2" fill="${C.ink}" fill-opacity=".25"/></g>`
        css += `@keyframes t${k}{0%,${4 + k * 2}%{opacity:0;transform:translateY(3px)}${9 + k * 2}%,90%{opacity:1;transform:none}96%,100%{opacity:0}}.t${k}{animation:t${k} 8s ${EASE} infinite}`
      }
    }
    const pgx = x + 14 + 1 * (gw + 6)
    const pgy = y + 28 + (gh + 6) + gh + 6
    svg += `<rect x="${r(pgx)}" y="${pgy}" width="${r(gw)}" height="2" fill="${C.ink}" fill-opacity=".2"/><rect class="inst" x="${r(pgx)}" y="${pgy}" width="${r(gw)}" height="2" fill="${C.sun}"/>
<g class="done">${icon.check(pgx + gw + 6, pgy + 1, 8)}</g>`
    css += `@keyframes inst{0%,40%{transform:scaleX(0)}70%,90%{transform:scaleX(1)}96%,100%{transform:scaleX(0)}}.inst{transform-box:fill-box;transform-origin:left;animation:inst 8s cubic-bezier(.3,0,.2,1) infinite}
@keyframes done{0%,70%{opacity:0}74%,90%{opacity:1}96%,100%{opacity:0}}.done{animation:done 8s linear infinite}`
    return { svg, css }
  },
  docs(w, x, y, bw, bh) {
    const px = x + 14
    const pw = 78
    let svg = `<rect x="${px + 0.5}" y="${y + 10.5}" width="${pw}" height="${bh - 22}" rx="2" class="strong"/>
<rect x="${px + 8}" y="${y + 20}" width="40" height="5" fill="${C.ink}" fill-opacity=".7"/>`
    for (let i = 0; i < 4; i++) svg += `<rect x="${px + 8}" y="${y + 32 + i * 9}" width="${[60, 52, 62, 38][i]}" height="3" fill="${C.ink}" fill-opacity=".3"/>`
    const ax = px + pw + 14
    svg += icon.arrowRight(ax, y + bh / 2)
    let css = ''
    ;(w.lines || ['# Install', '- one command', '- signed repo']).forEach((line, i) => {
      svg += `<text class="m md${i}" x="${ax + 36}" y="${y + 24 + i * 13}" font-size="9" letter-spacing=".06em" fill="${i === 0 ? C.ink : C.muted}">${esc(line)}</text>`
      css += `@keyframes md${i}{0%,${12 + i * 9}%{opacity:0;transform:translateX(-4px)}${18 + i * 9}%,88%{opacity:1;transform:none}96%,100%{opacity:0}}.md${i}{animation:md${i} 7s ${EASE} infinite}`
    })
    return { svg, css }
  },
  player(w, x, y, bw) {
    const mx = x + 14
    let svg = `<rect x="${x + bw - 21}" y="${y + 13}" width="2" height="8" fill="${C.ink}"/><rect x="${x + bw - 16}" y="${y + 13}" width="2" height="8" fill="${C.ink}"/>`
    let css = ''
    const slots = []
    let cx = mx
    ;(w.providers || []).slice(0, 4).forEach((t, k) => {
      const tw = measure(t, 'sm', 8, 0.8)
      slots.push([cx, tw])
      svg += `<text class="m tab${k}" x="${r(cx)}" y="${y + 20}" font-size="8" letter-spacing=".1em">${esc(t)}</text>`
      cx += tw + 16
    })
    if (slots.length) {
      const T = 3 * slots.length
      const at = (k) => r((k * 100) / slots.length)
      const end = (k) => r(((k + 1) * 100) / slots.length - 6)
      const pip = ([sx, sw]) => `transform:translateX(${r(sx - slots[0][0])}px) scaleX(${r(sw / slots[0][1], 3)})`
      svg += `<rect class="tabpip" x="${r(slots[0][0])}" y="${y + 25}" width="${r(slots[0][1])}" height="1.5" fill="${C.sun}"/>`
      css += `@keyframes tabpip{${slots.map((s, k) => `${at(k)}%,${end(k)}%{${pip(s)}}`).join('')}100%{${pip(slots[0])}}}.tabpip{transform-box:fill-box;transform-origin:left;animation:tabpip ${T}s cubic-bezier(.6,0,.2,1) infinite}\n`
      slots.forEach((_, k) => {
        css += `@keyframes tab${k}{${k ? `0%{fill:${C.faint}}` : ''}${at(k)}%{fill:${C.ink}}${end(k)}%{fill:${C.faint}}100%{fill:${C.faint}}}.tab${k}{fill:${k ? C.faint : C.ink};animation:tab${k} ${T}s steps(1) infinite}\n`
      })
    }
    const top = y + 34
    const base = y + 70
    const pitch = 5.6
    const n = Math.floor((bw - 28 + 2.6) / pitch)
    const len = r(n * pitch - 2.6)
    let bars = ''
    for (let k = 0; k < n; k++) {
      const env = 0.28 + 0.72 * Math.abs(Math.sin(k * 0.47 + 0.6) * Math.sin(k * 0.13 + 1.1))
      const h = r(4 + (base - top - 4) * env)
      bars += `<rect class="vb vb${k % 4}" style="animation-delay:-${r((k * 0.37) % 1.3, 2)}s" x="${r(mx + k * pitch)}" y="${r(base - h)}" width="3" height="${h}" rx=".8"/>`
    }
    const py = y + 83
    svg += `<clipPath id="played"><rect class="pg" x="${mx}" y="${top - 2}" width="${len}" height="${base - top + 4}"/></clipPath>
<g fill="${C.ink}" fill-opacity=".34">${bars}</g><g clip-path="url(#played)" fill="${C.sun}">${bars}</g>
<rect x="${mx}" y="${py - 0.5}" width="${len}" height="1" fill="${C.soft}"/><rect class="pg" x="${mx}" y="${py - 1}" width="${len}" height="2" fill="${C.sun}"/>
<circle class="head" cx="${mx}" cy="${py}" r="2.6" fill="${C.sun}"/>`
    // with motion off the progress bar rests part way
    css += `.vb{transform-box:fill-box;transform-origin:50% 100%}@keyframes vb{0%,100%{transform:scaleY(.34)}50%{transform:scaleY(1)}}
.vb0{animation:vb .9s ease-in-out infinite}.vb1{animation:vb 1.15s ease-in-out infinite}.vb2{animation:vb .78s ease-in-out infinite}.vb3{animation:vb 1.3s ease-in-out infinite}
@keyframes pg{from{transform:scaleX(0)}to{transform:scaleX(1)}}.pg{transform-box:fill-box;transform-origin:left;transform:scaleX(.42);animation:pg 14s linear infinite}
@keyframes head{from{transform:none}to{transform:translateX(${len}px)}}.head{transform:translateX(${r(len * 0.42)}px);animation:head 14s linear infinite}`
    return { svg, css }
  },
}

function workHead(index) {
  const total = (ME.work || []).reduce((s, w) => s + workStats(w.repo).stars, 0)
  const n = (ME.work || []).length
  const body = head(index, ME.workTitle || 'what I maintain', `${n} ${n === 1 ? 'project' : 'projects'} · ${fmt(total)} stars`)
  return svg({ h: 56, faces: ['sm'], body, label: ME.workTitle || 'What I maintain.' })
}

function workRow(w, i, index) {
  const H = 138
  const meta = workStats(w.repo)
  const name = w.name || w.repo.split('/')[1]
  const nameSize = r(fit(name, 'fr', 36, 480, 24))
  const nw = measure(name, 'fr', nameSize)
  const bx = 566
  const bw = W - PAD - bx
  const by = 20
  const bh = H - 40
  const a = (ARTS[w.art] || ARTS.docs)(w, bx, by, bw, bh)
  let body = `<text class="m sun" x="${PAD}" y="34">${index}.${i + 1}</text>
<text class="d" x="${PAD - 1}" y="78" font-size="${nameSize}" letter-spacing="-.01em">${esc(name)}</text>
<g class="nudge">${icon.upRight(r(PAD + nw + 8), 54)}</g>`
  wrap(w.desc, 'sg', 13, bx - PAD - 40).slice(0, 2).forEach((l, k) => {
    body += `<text class="s mut" x="${PAD}" y="${100 + k * 18}" font-size="13">${esc(l)}</text>`
  })
  const starsText = fmt(meta.stars)
  const end = bx - 22
  const sw = monoW(starsText)
  body += `<text class="m fnt" x="${end}" y="34" text-anchor="end">${starsText}</text>${icon.star(r(end - sw - 9), 30.5, 4.4)}`
  if (meta.language) body += `<text class="m fnt" x="${r(end - sw - 22)}" y="34" text-anchor="end">${esc(meta.language.toUpperCase())}  ·</text>`
  body += `<rect x="${bx + 0.5}" y="${by + 0.5}" width="${bw - 1}" height="${bh - 1}" rx="2" class="hair"/>
${a.svg}`
  return svg({ h: H, faces: ['fr', 'sg', 'sm'], css: a.css, body, label: `${name}: ${w.desc}` })
}

// one image per link, because a README image can only carry one link
function chip(link, count) {
  const cw = r(W / count)
  const h = 64
  const size = r(fit(link.value, 'fr', 20, cw - 52, 13))
  const w = measure(link.value, 'fr', size)
  const body = `<text class="m" x="18" y="24" font-size="9">${esc(link.label.toUpperCase())}</text>
<text class="d" x="18" y="49" font-size="${size}">${esc(link.value)}</text>
<g class="nudge">${icon.upRight(r(18 + w + 8), 35, 8)}</g>`
  return svg({ h, w: cw, faces: ['fr', 'sm'], body, label: `${link.label}: ${link.value}` })
}

function colophon() {
  const cta = 'HELP BUILD RYOKU  ·  CONTRIBUTING.MD'
  const body = `<text class="m" x="${PAD}" y="33"><tspan class="j" font-size="11" letter-spacing="0">力 · 美</tspan>   FOR THE SAKE OF POWER AND BEAUTY</text>
<text class="m ink" x="${W - PAD - 15}" y="33" text-anchor="end">${cta}</text>
<g class="nudge">${icon.upRight(W - PAD - 9, 24.5, 8)}</g>`
  return svg({ h: 54, faces: ['sm', 'jp'], body, label: 'Help build Ryoku: read CONTRIBUTING.md.' })
}

const sheet = (n) => String(n).padStart(2, '0')
let n = 0
const SECTIONS = [
  { name: 'cover', href: RY.site, make: cover, index: sheet(n++) },
  { name: 'project', href: `https://github.com/${RY.repo}`, make: project, index: sheet(n++) },
  { name: 'desktop', href: RY.showroom, make: desktop, index: sheet(n++) },
  { name: 'get', href: RY.install, make: get, index: sheet(n++) },
  { name: 'whoami', href: `https://github.com/${USER}?tab=repositories`, make: whoami, index: sheet(n++) },
]
if ((ME.work || []).length) {
  const index = sheet(n++)
  SECTIONS.push({ name: 'work', href: `https://github.com/${USER}?tab=repositories`, make: () => workHead(index), group: 'work' })
  ME.work.forEach((w, i) => SECTIONS.push({ name: `work-${i + 1}`, href: `https://github.com/${w.repo}`, make: () => workRow(w, i, index), group: 'work' }))
}
const links = (ME.links || []).slice(0, 5)
links.forEach((l, i) => SECTIONS.push({ name: `link-${i + 1}`, href: l.href, make: () => chip(l, links.length), group: 'links', width: `${r(100 / links.length, 3)}%` }))
SECTIONS.push({ name: 'colophon', href: RY.contributing, make: colophon })

const local = process.argv.includes('--local')
const versions = {}
const alts = {}
for (const sec of SECTIONS) {
  clipSeq = 0
  const out = sec.make(sec.index)
  alts[sec.name] = out.match(/aria-label="([^"]*)"/)?.[1] || sec.name
  versions[sec.name] = createHash('sha256').update(out).digest('hex').slice(0, 12)
  writeFileSync(new URL(`${sec.name}.svg`, DIR), out)
}

const src = (name) => (local ? `profile/${name}.svg` : `${RAW}${name}.svg?v=${versions[name]}`)
const img = (sec) => `<a href="${sec.href}"><img src="${src(sec.name)}" width="${sec.width || '100%'}" alt="${alts[sec.name]}"></a>`
const blocks = []
for (const sec of SECTIONS) {
  const prev = blocks[blocks.length - 1]
  // no whitespace between chips, or narrow screens wrap the last one onto its
  // own line
  if (sec.group && prev?.group === sec.group) prev.html += (sec.group === 'links' ? '' : '\n') + img(sec)
  else blocks.push({ html: img(sec), group: sec.group })
}
writeFileSync(
  new URL('../README.md', DIR),
  `<!-- Built by profile/build.mjs. Edit profile/profile.json, not this file. -->\n\n${blocks.map((b) => b.html).join('\n\n')}\n`,
)
console.log(`${SECTIONS.length} SVGs and README.md written${local ? ' (local paths)' : ''}`)
