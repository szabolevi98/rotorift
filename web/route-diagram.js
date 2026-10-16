import { routeDiagram } from '/shared/race/route-diagram.js';

const svgNode = (name, attributes) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

export function renderRouteDiagram(root, route, t) {
  root.replaceChildren();
  const diagram = routeDiagram(route);
  root.hidden = !diagram;
  if (!diagram) return;
  const svg = svgNode('svg', {viewBox:'0 0 320 160', role:'img', 'aria-label':t('route.diagram', {name:route.name})});
  const points = diagram.line.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ');
  svg.append(svgNode('polyline', {points, class:'route-diagram-glow'}), svgNode('polyline', {points, class:'route-diagram-line'}));
  for (const p of diagram.gates.slice(1)) svg.append(svgNode('circle', {cx:p[0], cy:p[1], r:1.8, class:'route-diagram-gate'}));
  if (diagram.arrow) svg.append(svgNode('path', {d:'M -4 -3 L 1 0 L -4 3', class:'route-diagram-arrow',
    transform:`translate(${diagram.arrow.p.join(' ')}) rotate(${diagram.arrow.angle})`}));
  svg.append(svgNode('circle', {cx:diagram.gates[0][0], cy:diagram.gates[0][1], r:4.5, class:'route-diagram-start'}));
  const caption = document.createElement('figcaption'), view = document.createElement('span'), start = document.createElement('span');
  view.textContent = t(diagram.sideView ? 'route.sideView' : 'route.topView');
  start.className = 'route-diagram-key'; start.textContent = t('route.startFinish');
  caption.append(view, start); root.append(svg, caption);
}
