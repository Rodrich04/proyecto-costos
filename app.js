const CAMPOS = [
  ['cap',   'Capacidad normal (unidades)', 10000],
  ['prod',  'Producción real (unidades)', 12000],
  ['ven',   'Ventas (unidades)', 9000],
  ['precio','Precio de venta unitario (Q)', 150],
  ['mp',    'Materia prima unitaria (Q)', 40],
  ['mo',    'Mano de obra unitaria (Q)', 25],
  ['gifv',  'GIF variables unitarios (Q)', 10],
  ['gvv',   'Gastos de venta variables unitarios (Q)', 8],
  ['fprod', 'Costos fijos de producción totales (Q)', 150000],
  ['fadm',  'Costos fijos de administración totales (Q)', 60000]
];
const SLIDERS = [
  ['s_prod','Producción',20], ['s_ven','Ventas',0], ['s_precio','Precio de venta',0],
  ['s_cv','Costos variables unitarios',0], ['s_fijos','Costos fijos',0]
];
const COL = ['#00e5ff', '#ff3d71', '#ffd600', '#00e676', '#b388ff', '#ff9100'];

const $ = id => document.getElementById(id);
const Q = n => 'Q ' + n.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const N = n => n.toLocaleString('es-GT', {maximumFractionDigits: 0});
const pct = n => (isFinite(n) ? n.toFixed(1) : '0.0') + '%';

/* ========== MOTOR DE CÁLCULO ========== */
function calc(d) {
  const cvp = d.mp + d.mo + d.gifv;                 // costo variable de producción unitario
  const tasa = d.cap ? d.fprod / d.cap : 0;         // tasa fija por unidad
  const varCap = (d.cap - d.prod) * tasa;           // + subaplicada (desfavorable), − sobreaplicada (favorable)
  const ventas = d.ven * d.precio;
  // Costeo absorbente
  const costoVentasAbs = d.ven * (cvp + tasa);
  const utilBruta = ventas - costoVentasAbs - varCap;
  const gVentaVar = d.ven * d.gvv;
  const uAbs = utilBruta - gVentaVar - d.fadm;
  // Costeo directo
  const cvProdVend = d.ven * cvp;
  const mc = ventas - cvProdVend - gVentaVar;
  const fijos = d.fprod + d.fadm;
  const uDir = mc - fijos;
  // Reconciliación
  const inv = d.prod - d.ven;
  const dif = inv * tasa;
  const cuadra = Math.abs((uAbs - uDir) - dif) < 0.01;
  const mcu = d.precio - cvp - d.gvv;
  const pe = mcu > 0 ? fijos / mcu : NaN;
  return {cvp, tasa, varCap, ventas, costoVentasAbs, utilBruta, gVentaVar, uAbs, cvProdVend, mc, fijos, uDir,
          inv, dif, cuadra, mcu, pe, mcPct: ventas ? mc / ventas * 100 : 0,
          cuAbs: cvp + tasa, cuDir: cvp};
}

/* ========== UTILIDADES DE INTERFAZ ========== */
function datos() {
  return Object.fromEntries(CAMPOS.map(([k]) => [k, parseFloat($('i_' + k).value) || 0]));
}
function tabla(filas) {
  return '<table>' + filas.map(([a, b, c]) =>
    `<tr class="${c || ''}"><td>${a}</td><td>${typeof b === 'number' ? Q(b) : b}</td></tr>`).join('') + '</table>';
}
function kpi(titulo, valor, nota, color) {
  return `<div class="kpi" style="--c:${color}"><span>${titulo}</span><b>${valor}</b><small>${nota || ''}</small></div>`;
}
const charts = {};
function grafico(id, tipo, data, extra = {}) {
  if (typeof Chart === 'undefined') return;
  if (charts[id]) charts[id].destroy();
  Chart.defaults.color = '#bbb';
  charts[id] = new Chart($(id), {
    type: tipo, data,
    options: Object.assign({
      responsive: true, maintainAspectRatio: false,
      plugins: {legend: {labels: {color: '#ddd'}}},
      scales: {x: {ticks: {color: '#aaa'}, grid: {color: '#1c1c1c'}}, y: {ticks: {color: '#aaa'}, grid: {color: '#1c1c1c'}}}
    }, extra)
  });
}

/* ========== PESTAÑAS 2 y 3 ========== */
function render() {
  const d = datos(), r = calc(d);

  $('motorKpis').innerHTML =
    kpi('Tasa fija por unidad', Q(r.tasa), 'GIF fijos ÷ capacidad normal', COL[0]) +
    kpi('Variación en capacidad', Q(Math.abs(r.varCap)), r.varCap > 0 ? 'Subaplicada (desfavorable)' : r.varCap < 0 ? 'Sobreaplicada (favorable)' : 'Sin variación', r.varCap > 0 ? COL[1] : COL[3]) +
    kpi('Variación de inventario', N(r.inv) + ' u.', 'Producción − ventas', COL[2]) +
    kpi('Costo unitario absorbente', Q(r.cuAbs), 'Incluye tasa fija', COL[4]) +
    kpi('Costo unitario directo', Q(r.cuDir), 'Solo variable de producción', COL[5]);

  $('tAbs').innerHTML = tabla([
    ['Ventas', r.ventas],
    ['(−) Costo de ventas (variable + fijo a tasa)', r.costoVentasAbs],
    [r.varCap >= 0 ? '(−) Variación en capacidad (subaplicada)' : '(+) Variación en capacidad (sobreaplicada)', Math.abs(r.varCap)],
    ['Utilidad bruta', r.utilBruta, 'sub'],
    ['(−) Gastos de venta variables', r.gVentaVar],
    ['(−) Gastos de administración fijos', datos().fadm],
    ['Utilidad de operación', r.uAbs, 'tot']]);

  $('tDir').innerHTML = tabla([
    ['Ventas', r.ventas],
    ['(−) Costos variables de producción', r.cvProdVend],
    ['(−) Gastos de venta variables', r.gVentaVar],
    ['Margen de contribución', r.mc, 'sub'],
    ['(−) Costos fijos de producción', d.fprod],
    ['(−) Costos fijos de administración', d.fadm],
    ['Utilidad de operación', r.uDir, 'tot']]);

  $('recon').innerHTML = `
    <p>Utilidad absorbente − utilidad directa = <b>${Q(r.uAbs - r.uDir)}</b></p>
    <p>Variación de inventario × tasa fija = ${N(r.inv)} u. × ${Q(r.tasa)} = <b>${Q(r.dif)}</b></p>
    <span class="${r.cuadra ? 'ok' : 'mal'}">${r.cuadra ? 'Cuadra: los dos resultados coinciden' : 'No cuadra: revisa los datos'}</span>
    <p style="color:#9a9a9a">${r.inv > 0 ? 'Se produjo más de lo que se vendió: el absorbente difiere costos fijos en inventario y muestra más utilidad.' : r.inv < 0 ? 'Se vendió más de lo producido: el absorbente libera costos fijos de inventario y muestra menos utilidad.' : 'Producción igual a ventas: ambos métodos dan la misma utilidad.'}</p>`;

  // Dashboard
  $('kpis').innerHTML =
    kpi('Margen de contribución total', Q(r.mc), 'Ventas − costos variables', COL[0]) +
    kpi('Margen de contribución %', pct(r.mcPct), 'Sobre ventas', COL[3]) +
    kpi('Utilidad de operación, absorbente', Q(r.uAbs), '', r.uAbs >= 0 ? COL[2] : COL[1]) +
    kpi('Utilidad de operación, directo', Q(r.uDir), '', r.uDir >= 0 ? COL[4] : COL[1]) +
    kpi('Ventas totales', Q(r.ventas), N(d.ven) + ' unidades', COL[5]) +
    kpi('Punto de equilibrio', isFinite(r.pe) ? N(r.pe) + ' u.' : 'No existe', 'Costos fijos ÷ MC unitario', COL[0]) +
    kpi('Margen de seguridad', isFinite(r.pe) && d.ven ? pct((d.ven - r.pe) / d.ven * 100) : 'N/D', 'Ventas sobre equilibrio', COL[3]) +
    kpi('Diferencial de utilidades', Q(r.uAbs - r.uDir), 'Efecto del inventario', COL[2]);

  grafico('g1', 'bar', {
    labels: ['Costeo absorbente', 'Costeo directo'],
    datasets: [{label: 'Utilidad de operación (Q)', data: [r.uAbs, r.uDir], backgroundColor: [COL[0], COL[1]], borderRadius: 8}]
  }, {plugins: {legend: {display: false}}, scales: {x: {ticks: {color: '#ddd'}, grid: {display: false}}, y: {ticks: {color: '#aaa'}, grid: {color: '#1c1c1c'}}}});

  const cvu = d.mp + d.mo + d.gifv + d.gvv, mx = Math.max(d.cap, d.prod, d.ven, 1) * 1.5;
  const pts = [...Array(11).keys()].map(i => Math.round(mx / 10 * i));
  const ln = (label, f, c, dash) => ({label, data: pts.map(f), borderColor: c, backgroundColor: c, borderDash: dash || [], tension: .1, pointRadius: 2});
  grafico('g2', 'line', {labels: pts.map(N), datasets: [
    ln('Costos fijos', () => r.fijos, COL[2]),
    ln('Costos variables', u => u * cvu, COL[1]),
    ln('Costo total', u => r.fijos + u * cvu, COL[4]),
    ln('Ingresos', u => u * d.precio, COL[3], [6, 4])
  ]});
  sim();
}

/* ========== PESTAÑA 4: SIMULACIÓN ========== */
function sim() {
  const d = datos(), g = id => parseFloat($(id).value);
  SLIDERS.forEach(([id]) => $('o' + id).textContent = (g(id) > 0 ? '+' : '') + g(id) + '%');
  const f = (v, p) => v * (1 + p / 100), cv = g('s_cv'), fj = g('s_fijos');
  const e = {...d,
    prod: $('c_cap').checked ? d.cap : f(d.prod, g('s_prod')),
    ven: $('c_ven').checked ? d.ven : f(d.ven, g('s_ven')),
    precio: f(d.precio, g('s_precio')),
    mp: f(d.mp, cv), mo: f(d.mo, cv), gifv: f(d.gifv, cv), gvv: f(d.gvv, cv),
    fprod: f(d.fprod, fj), fadm: f(d.fadm, fj)};
  const b = calc(d), s = calc(e);
  const fila = (n, x, y, unid) => {
    const fm = v => unid ? N(v) + ' u.' : Q(v), dl = y - x;
    return `<tr><td>${n}</td><td>${fm(x)}</td><td>${fm(y)}</td><td class="${dl >= 0 ? 'up' : 'down'}">${dl > 0 ? '+' : ''}${fm(dl)}</td></tr>`;
  };
  $('simTabla').innerHTML = `<table><tr><th>Indicador</th><th>Base</th><th>Escenario</th><th>Cambio</th></tr>` +
    fila('Producción', d.prod, e.prod, true) + fila('Ventas (unidades)', d.ven, e.ven, true) +
    fila('Margen de contribución', b.mc, s.mc) + fila('Utilidad, costeo absorbente', b.uAbs, s.uAbs) +
    fila('Utilidad, costeo directo', b.uDir, s.uDir) + fila('Diferencial de utilidades', b.uAbs - b.uDir, s.uAbs - s.uDir) +
    fila('Variación de inventario', b.inv, s.inv, true) + '</table>';
  grafico('g3', 'bar', {
    labels: ['Margen de contribución', 'Utilidad absorbente', 'Utilidad directa'],
    datasets: [
      {label: 'Base', data: [b.mc, b.uAbs, b.uDir], backgroundColor: COL[0], borderRadius: 6},
      {label: 'Escenario', data: [s.mc, s.uAbs, s.uDir], backgroundColor: COL[2], borderRadius: 6}]
  });
}

/* ========== INICIO ========== */
$('inputs').innerHTML = CAMPOS.map(([k, t, v]) =>
  `<div class="campo"><label for="i_${k}">${t}</label><input type="number" id="i_${k}" value="${v}" min="0" step="any"></div>`).join('');
$('sliders').innerHTML = SLIDERS.map(([id, t, v]) =>
  `<div class="sl"><div><label for="${id}">${t}</label><output id="o${id}"></output></div>
   <input type="range" id="${id}" min="-50" max="100" step="5" value="${v}"></div>`).join('');

document.querySelectorAll('#inputs input').forEach(i => i.addEventListener('input', render));
document.querySelectorAll('#sliders input, .chk input').forEach(i => i.addEventListener('input', sim));
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tab, .panel').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); $(b.dataset.t).classList.add('on');
  render(); // redibuja los gráficos al mostrar la pestaña
}));
render();