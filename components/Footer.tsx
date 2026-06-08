export function Footer() {
  return (
    <footer className="flex mt-auto py-4 gap-4 justify-center text-xs font-bold text-white">
      <a
        href="https://tv-bellenberg.de/kontakt/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground underline underline-offset-4 transition-colors"
      >
        Kontakt
      </a>
      <a
        href="https://tv-bellenberg.de/impressum/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground underline underline-offset-4 transition-colors"
      >
        Impressum
      </a>
    </footer>
  );
}
