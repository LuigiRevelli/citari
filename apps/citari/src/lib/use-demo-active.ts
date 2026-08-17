import { useEffect, useState, type RefObject } from "react";

import { useApparition } from "@/lib/use-apparition";

/**
 * Le déclencheur des démonstrations et des schémas animés.
 *
 * C'est `useApparition` plus le filet de sécurité de Reveal : l'observateur
 * d'intersection ne rapporte rien tant que le document n'est pas peint
 * (onglet en arrière-plan, fenêtre masquée), et le panneau resterait alors
 * figé sur son état initial — compteurs à 0, traits non tracés — pour qui
 * revient sur l'onglet. Reveal règle ça depuis le 07/08 avec un contrôle au
 * rectangle ; on reprend le même, sinon les visuels animés sont moins
 * fiables que le reste du site.
 *
 * Extrait de DemoEtape.tsx le 17/08/2026, quand le schéma de la section
 * « problème » a eu besoin du même déclenchement.
 */
export function useDemoActive(ref: RefObject<HTMLElement | null>, seuil = 0.35): boolean {
  const vu = useApparition(ref, seuil);
  const [secours, setSecours] = useState(false);

  useEffect(() => {
    if (vu) return;
    const t = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) setSecours(true);
    }, 700);
    return () => clearTimeout(t);
  }, [ref, vu]);

  return vu || secours;
}
