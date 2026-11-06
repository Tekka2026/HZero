(() => {
  const button = document.getElementById('menu-toggle');
  const menu = document.getElementById('site-menu');
  if (!button || !menu) return;

  const closeMenu = (returnFocus = false) => {
    button.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    if (returnFocus) button.focus();
  };
  const openMenu = () => {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  };

  button.addEventListener('click', () => {
    if (button.getAttribute('aria-expanded') === 'true') closeMenu();
    else openMenu();
  });
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('click', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) closeMenu(true);
  });
})();
