export default function Footer() {
  return (
    <footer className="site-foot">
      <span>© {new Date().getFullYear()} Granite Models Automations</span>
      <nav aria-label="Contact">
        <a href="https://granitemodels.store/">granitemodels.store</a>
        <a href="https://granitemodels.store/products/">Products</a>
        <a href="tel:+19786473933">(978) 647-3933</a>
        <a href="mailto:granitemodels@gmail.com">granitemodels@gmail.com</a>
      </nav>
    </footer>
  );
}
