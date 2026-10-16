import { routeMetrics } from '/shared/race/route-info.js';
import { renderRouteDiagram } from './route-diagram.js';

export class RouteDetails {
  constructor(root, t) {
    this.root = root; this.t = t;
    this.trigger = root.querySelector('button');
    this.summary = root.querySelector('[data-route-summary]');
    this.dialog = document.querySelector('#route-details');
    this.trigger.addEventListener('click', () => this.open());
    this.dialog.querySelector('button').addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener('keydown', event => event.stopPropagation());
    this.dialog.addEventListener('click', event => {
      const r = this.dialog.getBoundingClientRect();
      if (event.target === this.dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) this.close();
    });
    this.dialog.addEventListener('close', () => this.trigger.setAttribute('aria-expanded', 'false'));
    window.addEventListener('resize', () => this.position());
    document.querySelector('#menu').addEventListener('scroll', () => this.close(), {passive:true});
  }
  update(route, drones) {
    this.close(); this.route = route;
    this.root.hidden = !route;
    if (!route) return;
    const {lengthM, gateCount, estimated} = routeMetrics(route);
    const locale = document.documentElement.lang;
    const distance = lengthM >= 1000
      ? `${(lengthM / 1000).toLocaleString(locale, {maximumFractionDigits:2})} km`
      : `${Math.round(lengthM).toLocaleString(locale)} m`;
    this.summary.textContent = [`${estimated ? '≈ ' : ''}${distance}`, this.t('route.gates', {count:gateCount}),
      route.details ? this.t(`route.${route.details.difficulty}`) : null].filter(Boolean).join(' · ');
    this.dialog.querySelector('h2').textContent = route.name;
    this.dialog.querySelector('[data-route-metrics]').textContent = this.summary.textContent;
    renderRouteDiagram(this.dialog.querySelector('[data-route-diagram]'), route, this.t);
    this.dialog.querySelector('[data-route-description]').textContent =
      route.details?.description[locale] ?? route.details?.description.en ?? this.t('route.noDescription');
    const recommended = this.dialog.querySelector('[data-route-drones]');
    const names = route.details?.recommendedDrones.map(id => drones.find(drone => drone.id === id)?.name).filter(Boolean) ?? [];
    recommended.textContent = names.join(' · ');
    recommended.parentElement.hidden = !names.length;
  }
  open() {
    if (!this.route || this.dialog.open) return;
    this.dialog.showModal(); this.trigger.setAttribute('aria-expanded', 'true'); this.position();
  }
  close() {
    if (this.dialog.open) this.dialog.close();
  }
  position() {
    if (!this.dialog.open) return;
    this.dialog.style.left = ''; this.dialog.style.top = '';
    if (window.innerWidth <= 600) return;
    const r = this.trigger.getBoundingClientRect(), d = this.dialog.getBoundingClientRect();
    this.dialog.style.left = `${Math.max(12, Math.min(r.right - d.width, window.innerWidth - d.width - 12))}px`;
    this.dialog.style.top = `${Math.max(12, r.bottom + d.height + 8 <= window.innerHeight - 12 ? r.bottom + 8 : r.top - d.height - 8)}px`;
  }
}
