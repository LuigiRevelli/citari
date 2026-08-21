import { useEffect, useRef, useState } from "react";

/**
 * Compte jusqu'à `cible` quand `actif` passe à vrai, et RECOMPTE quand la
 * cible change.
 *
 * Le départ est la valeur affichée à cet instant, pas zéro (17/08/2026,
 * quand les chiffres du panneau de scan se sont mis à changer à chaque
 * question). Un retour à zéro entre deux relevés donnait un clignotement
 * sec, alors que les barres voisines, elles, glissent d'une largeur à
 * l'autre : de 19 à 23, le compteur passe donc par 20, 21, 22, comme un
 * relevé qui se met à jour. Au premier affichage la valeur courante vaut
 * zéro, donc l'entrée est inchangée.
 *
 * Extrait de DemoEtape.tsx le 17/08/2026, quand le spécimen du héros a eu
 * besoin du même compteur.
 */
export function useCompteur(cible: number, actif: boolean, duree = 900, retard = 0) {
  const [valeur, setValeur] = useState(0);
  const courante = useRef(0);
  courante.current = valeur;

  useEffect(() => {
    if (!actif) {
      setValeur(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValeur(cible);
      return;
    }

    let brut = 0;
    let debut = 0;
    let fini = false;
    const depart = courante.current;
    const demarre = window.setTimeout(() => {
      const pas = (t: number) => {
        if (!debut) debut = t;
        const p = Math.min((t - debut) / duree, 1);
        // Sortie cubique : l'aiguille ralentit en arrivant, comme un cadran.
        const avance = 1 - Math.pow(1 - p, 3);
        setValeur(Math.round(depart + (cible - depart) * avance));
        if (p < 1) brut = requestAnimationFrame(pas);
        else fini = true;
      };
      brut = requestAnimationFrame(pas);
    }, retard);

    /**
     * Filet : les barres voisines sont animées en CSS, qui continue de
     * calculer quand l'onglet passe en arrière-plan — alors que
     * requestAnimationFrame, lui, est suspendu. Sans ce rattrapage on peut
     * revenir sur une barre pleine à côté d'un compteur resté à 0, ce qui se
     * lit comme un bug. Vu en conditions réelles pendant l'intégration.
     */
    const rattrape = window.setTimeout(
      () => {
        if (!fini) setValeur(cible);
      },
      retard + duree + 250,
    );

    return () => {
      clearTimeout(demarre);
      clearTimeout(rattrape);
      cancelAnimationFrame(brut);
    };
  }, [cible, actif, duree, retard]);

  return valeur;
}
