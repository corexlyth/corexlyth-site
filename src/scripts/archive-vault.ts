const vault = document.querySelector<HTMLElement>('[data-vault]');
if (vault) {
  const list = vault.querySelector<HTMLElement>('[data-vault-cards]')!;
  const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-vault-card]'));
  const filters = Array.from(vault.querySelectorAll<HTMLButtonElement>('[data-vault-filter]'));
  const sort = vault.querySelector<HTMLSelectElement>('[data-vault-sort]')!;
  const count = vault.querySelector<HTMLElement>('[data-vault-count]')!;
  const empty = vault.querySelector<HTMLElement>('.cx-vault__empty')!;
  let category = 'all';
  function render() {
    const sorted = [...cards].sort((a,b) => sort.value === 'title'
      ? (a.dataset.title || '').localeCompare(b.dataset.title || '', 'tr')
      : sort.value === 'oldest' ? (a.dataset.date || '').localeCompare(b.dataset.date || '') : (b.dataset.date || '').localeCompare(a.dataset.date || ''));
    let visible = 0;
    for (const card of sorted) {
      card.hidden = category !== 'all' && card.dataset.category !== category;
      if (!card.hidden) { card.dataset.vaultPosition = String(visible++); }
      list.append(card);
    }
    count.textContent = `${visible} yayın`;
    empty.hidden = visible !== 0;
  }
  for (const button of filters) button.addEventListener('click', () => {
    category = button.dataset.vaultFilter || 'all';
    for (const item of filters) { const active = item === button; item.classList.toggle('is-active',active); item.setAttribute('aria-pressed',String(active)); }
    render();
  });
  sort.addEventListener('change', render);
  render();
}
