const element = (tag, className, text = '') => {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
};
const searchable = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
let opened;

// Searchable, bounded catalog picker. Only two instances are needed regardless
// of fleet size; choosing still uses the game's existing loading/select flow.
export class CatalogSelect {
  constructor(host, labelId, translate, onChange) {
    this.host = host; this.t = translate; this.onChange = onChange; this.items = []; this.value = '';
    this.trigger = element('button', 'catalog-trigger'); this.trigger.type = 'button';
    this.caption = element('span', 'catalog-value'); this.caption.id = host.id + '-value';
    const chevron = element('span', 'catalog-chevron', '⌄'); chevron.setAttribute('aria-hidden', 'true');
    this.trigger.append(this.caption, chevron);
    this.trigger.setAttribute('aria-labelledby', labelId + ' ' + this.caption.id);
    this.trigger.setAttribute('aria-haspopup', 'dialog'); this.trigger.setAttribute('aria-expanded', 'false');
    this.popup = element('div', 'catalog-popup'); this.popup.id = host.id + '-popup'; this.popup.hidden = true;
    this.popup.setAttribute('role', 'dialog'); this.popup.setAttribute('aria-labelledby', labelId);
    this.trigger.setAttribute('aria-controls', this.popup.id);
    this.search = element('input', 'catalog-search'); this.search.type = 'search'; this.search.autocomplete = 'off';
    this.search.setAttribute('role', 'combobox'); this.search.setAttribute('aria-autocomplete', 'list');
    this.search.setAttribute('aria-expanded', 'false');
    this.list = element('div', 'catalog-options'); this.list.id = host.id + '-options';
    this.list.setAttribute('role', 'listbox'); this.list.setAttribute('aria-labelledby', labelId);
    this.search.setAttribute('aria-controls', this.list.id);
    this.empty = element('p', 'catalog-empty'); this.empty.setAttribute('role', 'status');
    this.popup.append(this.search, this.list, this.empty); host.replaceChildren(this.trigger, this.popup);
    this.trigger.onclick = () => this.popup.hidden ? this.open() : this.close();
    this.trigger.onkeydown = event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); this.open(); }
    };
    this.search.oninput = () => this.render();
    this.search.onkeydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(true); }
      else if (event.key === 'Tab') this.close();
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const last = this.filtered.length - 1;
        this.activate(event.key === 'Home' ? 0 : event.key === 'End' ? last
          : Math.max(0, Math.min(last, this.active + (event.key === 'ArrowDown' ? 1 : -1))));
      } else if (event.key === 'Enter') {
        event.preventDefault(); const item = this.filtered[this.active]; if (item) this.choose(item.value);
      }
    };
    document.addEventListener('pointerdown', event => { if (!host.contains(event.target)) this.close(); });
    window.addEventListener('resize', () => { if (!this.popup.hidden) this.position(); });
    window.addEventListener('scroll', () => { if (!this.popup.hidden) this.position(); }, true);
  }
  update(items, value) {
    this.items = items; this.value = value ?? this.value;
    const item = items.find(item => item.value === this.value) ?? items[0];
    this.caption.textContent = item ? this.label(item) : '';
    this.search.placeholder = this.t('picker.search'); this.search.setAttribute('aria-label', this.t('picker.search'));
    this.empty.textContent = this.t('picker.empty');
    if (!this.popup.hidden) this.render();
  }
  label(item) { return item.label + (item.detail ? ' · ' + item.detail : ''); }
  open() {
    if (opened && opened !== this) opened.close(); opened = this;
    this.search.value = ''; this.popup.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true'); this.search.setAttribute('aria-expanded', 'true');
    this.render(); this.search.focus({ preventScroll: true });
  }
  close(focus = false) {
    if (this.popup.hidden) return;
    this.popup.hidden = true; this.trigger.setAttribute('aria-expanded', 'false');
    this.search.setAttribute('aria-expanded', 'false'); this.search.removeAttribute('aria-activedescendant');
    if (opened === this) opened = null;
    if (focus) this.trigger.focus({ preventScroll: true });
  }
  choose(value) {
    const changed = value !== this.value;
    this.value = value; this.update(this.items, value); this.close(true);
    if (changed) this.onChange(value);
  }
  render() {
    const query = searchable(this.search.value.trim());
    this.filtered = this.items.filter(item => searchable(this.label(item)).includes(query));
    this.list.replaceChildren(...this.filtered.map((item, index) => {
      const option = element('button', 'catalog-option'); option.type = 'button'; option.tabIndex = -1;
      option.id = this.host.id + '-option-' + index; option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(item.value === this.value));
      const text = element('span', 'catalog-option-text'); text.append(element('strong', '', item.label));
      if (item.detail) text.append(element('small', '', ' · ' + item.detail));
      const check = element('span', 'catalog-check', item.value === this.value ? '✓' : ''); check.setAttribute('aria-hidden', 'true');
      option.append(text, check); option.onclick = () => this.choose(item.value);
      return option;
    }));
    this.empty.hidden = this.filtered.length > 0;
    this.position();
    this.activate(Math.max(0, this.filtered.findIndex(item => item.value === this.value)));
  }
  activate(index) {
    this.active = this.filtered.length ? index : -1;
    Array.from(this.list.children).forEach((option, i) => option.classList.toggle('highlighted', i === this.active));
    const option = this.list.children[this.active];
    if (option) { this.search.setAttribute('aria-activedescendant', option.id); option.scrollIntoView({ block: 'nearest' }); }
    else this.search.removeAttribute('aria-activedescendant');
  }
  position() {
    const rect = this.trigger.getBoundingClientRect(), margin = 12;
    const width = Math.min(Math.max(rect.width, 320), innerWidth - margin * 2);
    this.popup.style.width = width + 'px';
    this.popup.style.left = Math.max(margin, Math.min(rect.left, innerWidth - width - margin)) + 'px';
    const height = Math.min(352, 64 + Math.max(1, this.filtered.length) * 58, innerHeight - margin * 2);
    const below = innerHeight - rect.bottom - margin - 6, above = rect.top - margin - 6;
    const up = below < height && above > below;
    this.popup.style.maxHeight = Math.max(80, up ? above : below) + 'px';
    this.popup.style.top = (up ? Math.max(margin, rect.top - Math.min(height, above) - 6) : rect.bottom + 6) + 'px';
  }
}
