export function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Section navigation is an interaction, not application state. Keep the
  // URL stable so refreshes and copied links do not expose implementation
  // fragments from the landing page.
  if (window.location.hash) {
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
  }
}
