import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { fondSombreAuPoint } from "@/lib/fond-sombre";

/**
 * Barre latérale de sections, fixée à gauche de la landing.
 *
 * Portée du projet Lovable de Jérémie le 14/08/2026. Au repos : une fine
 * ligne verticale et de petits repères. Au survol : les labels apparaissent
 * en IBM Plex Mono. Cachée sur mobile.
 *
 * Elle détecte la luminosité du fond derrière elle : sur les sections sombres
 * (méthode, contact), ses repères passent en papier ; au survol, le panneau
 * devient papier et les repères repassent en encre pour rester lisibles.
 */

type Section = {
  id: string;
  label: string;
  /** Destination hors landing : la barre ouvre la page au lieu de défiler. */
  to?: string;
};

/**
 * Seulement les sections de la page, depuis le 17/08/2026.
 *
 * « Méthode » et « Sprint » y figuraient aussi, en repères PLEINS pour dire
 * qu'ils menaient ailleurs (ajoutés le 15/08 parce que personne ne trouvait
 * la page /methode). Jérémie a demandé le retrait de ces deux points gris :
 * deux ronds au milieu de traits accrochaient l'œil sans qu'on comprenne
 * pourquoi.
 *
 * Les deux pages restent atteignables par le pied de page et par le bouton
 * au pied de leur carte du parcours — c'est le repère qui disparaît, pas le
 * chemin. Le rendu `section.to` est conservé plus bas : il ne coûte rien et
 * servira si un jour un lien externe revient dans cette barre.
 */
const SECTIONS: Section[] = [
  { id: "scan", label: "Scan" },
  { id: "probleme", label: "Problème" },
  { id: "cout", label: "Coût" },
  { id: "parcours", label: "Parcours" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
];

export function SectionSidebar() {
  const [active, setActive] = useState<string>(SECTIONS[0]!.id);
  const [surFondSombre, setSurFondSombre] = useState(false);

  useEffect(() => {
    // Détecte si le fond derrière la sidebar est sombre, pour choisir des
    // repères clairs ou encre plutôt qu'un mélange peu lisible.
    const updateFond = () => {
      setSurFondSombre(fondSombreAuPoint(30, Math.round(window.innerHeight / 2)));
    };

    // Section active : celle dont le haut est le plus proche du haut du
    // viewport, parmi les sections visibles. Fidèle même quand une section est
    // très courte (le pont « Problème » par exemple).
    const updateActive = () => {
      let activeId: string | null = null;
      let bestDistance = Infinity;

      for (const section of SECTIONS) {
        if (section.to) continue; // pas une section de cette page
        const el = document.getElementById(section.id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

        const distance = Math.abs(rect.top);
        if (distance < bestDistance) {
          bestDistance = distance;
          activeId = section.id;
        }
      }

      if (activeId) setActive(activeId);
      updateFond();
    };

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActive();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    updateActive();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav
      aria-label="Sections de la page"
      className="group/sidebar fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 sm:block"
    >
      <div
        className={`relative flex w-12 flex-col items-start gap-5 py-6 pl-5 pr-5 transition-[width,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:w-32 ${
          surFondSombre ? "hover:bg-paper/90" : "hover:bg-paper/85"
        }`}
      >
        {/* Ligne verticale de fond. */}
        <div
          className={`pointer-events-none absolute bottom-6 left-5 top-6 w-px transition-colors duration-300 ${
            surFondSombre ? "bg-paper/25 group-hover/sidebar:bg-ink/20" : "bg-ink/15"
          }`}
        />

        {SECTIONS.map((section) => {
          const isActive = active === section.id;
          const repere = isActive ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-signal transition-all duration-300" />
          ) : section.to ? (
            // Un repère PLEIN, pas un trait : ce point mène ailleurs, et la
            // différence doit se voir avant le survol.
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300 ${
                surFondSombre
                  ? "bg-paper/55 group-hover/sidebar:bg-ink/50"
                  : "bg-ink/45 group-hover/button:bg-ink/70"
              }`}
            />
          ) : (
            <span
              className={`h-px w-3 shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/button:w-4 ${
                surFondSombre
                  ? "bg-paper/40 group-hover/sidebar:bg-ink/40"
                  : "bg-ink/35 group-hover/button:bg-ink/60"
              }`}
            />
          );

          const label = (
            <span
              className={`mono pointer-events-none -translate-x-2 whitespace-nowrap text-[11px] uppercase tracking-[0.1em] opacity-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-75 ${
                surFondSombre ? "text-paper group-hover/sidebar:text-ink" : "text-ink"
              } ${isActive ? "group-hover/sidebar:opacity-100" : ""}`}
            >
              {section.label}
              {section.to ? <span aria-hidden> ↗</span> : null}
            </span>
          );

          const classe = "group/button relative flex w-full items-center gap-3 text-left";

          return section.to ? (
            <Link key={section.id} to={section.to} aria-label={section.label} className={classe}>
              {repere}
              {label}
            </Link>
          ) : (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollTo(section.id)}
              aria-label={`Aller à ${section.label}`}
              className={classe}
            >
              {repere}
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
