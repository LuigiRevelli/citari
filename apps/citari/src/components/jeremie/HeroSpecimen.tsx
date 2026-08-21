/**
 * Vitrine « exemple de rapport du diagnostic » de la page d'accueil.
 *
 * Version du 14/08/2026 : extrait de document coupé en cours de lecture,
 * avec la liste de ce que le diagnostic vérifie. Contenu explicitement
 * illustratif (voir src/lib/contenu.ts) : ne jamais y substituer les chiffres
 * d'un vrai scan sans accord écrit du client concerné.
 *
 * Animé le 17/08/2026. C'est la première chose qu'on voit en arrivant, et
 * elle était entièrement figée : le rapport se REMPLIT maintenant sous les
 * yeux — le score monte, les barres poussent, les cinq contrôles se cochent
 * un par un. Le document ne se contente plus de montrer un résultat, il
 * montre une mesure en train de se faire, ce qui est exactement le produit.
 *
 * Le contenu reste intégralement dans le DOM au rendu serveur : seules
 * l'opacité, la largeur des barres et la valeur affichée des compteurs sont
 * animées. Un moteur d'IA qui lit la page voit le rapport complet.
 */
import { useRef } from "react";

import { SPECIMEN } from "@/lib/contenu";
import { useCompteur } from "@/lib/use-compteur";
import { useDemoActive } from "@/lib/use-demo-active";

function TicIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="flex-none"
    >
      <path
        d="M2.5 7.5L5.5 10.5L11.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/**
 * Le rythme du remplissage, en millisecondes depuis l'entrée du bloc.
 *
 * Le spécimen est déjà monté dans un `Reveal delay={340}` : ces retards
 * s'ajoutent au sien, d'où des valeurs volontairement courtes. La séquence
 * complète tient en 1,9s — au-delà, un visiteur arrivé pour taper son
 * adresse attend devant une animation au lieu de la regarder.
 */
const T_SCORE = 120;
const T_ECART = 380;
const T_BARRES = 520;
const T_CONTROLES = 1000;

export function HeroSpecimen() {
  const ref = useRef<HTMLDivElement | null>(null);
  // Seuil bas : le spécimen est en haut de page, souvent partiellement
  // coupé par le bas de la fenêtre sur un portable.
  const actif = useDemoActive(ref, 0.12);

  // Dérivés du contenu, jamais écrits en dur : la phrase d'écart et les
  // barres doivent dire le même chiffre, y compris si le spécimen change.
  const vous = SPECIMEN.mentions.find((m) => m.vous);
  const rival = SPECIMEN.mentions
    .filter((m) => !m.vous)
    .reduce<(typeof SPECIMEN.mentions)[number] | null>(
      (haut, m) => (haut && haut.valeur >= m.valeur ? haut : m),
      null,
    );

  const score = useCompteur(SPECIMEN.score, actif, 900, T_SCORE);
  const compteVous = useCompteur(vous?.valeur ?? 0, actif, 700, T_ECART);
  const compteRival = useCompteur(rival?.valeur ?? 0, actif, 700, T_ECART);
  const m0 = useCompteur(SPECIMEN.mentions[0]?.valeur ?? 0, actif, 700, T_BARRES);
  const m1 = useCompteur(SPECIMEN.mentions[1]?.valeur ?? 0, actif, 700, T_BARRES + 110);
  const m2 = useCompteur(SPECIMEN.mentions[2]?.valeur ?? 0, actif, 700, T_BARRES + 220);
  const comptes = [m0, m1, m2];

  return (
    <div ref={ref} className="w-full">
      <div className="relative overflow-hidden border border-ink-2 bg-paper-2">
        <div className="flex items-baseline justify-between gap-3 border-b border-rule px-5 py-3 sm:px-6">
          <p className="mono text-[11px] uppercase tracking-[0.13em] text-ink-2">
            {SPECIMEN.libelle}
          </p>
          <p className="mono text-[11px] uppercase tracking-[0.13em] text-ink-2">
            {SPECIMEN.reference}
          </p>
        </div>

        {/* Compacté le 15/08/2026 : le spécimen faisait 661px contre 433 au
            bloc de gauche, donc il démarrait 114px PLUS HAUT que le titre et
            l'écrasait — l'accessoire dominait le message. Rien n'a été
            retiré : le score et l'écart de citations gagnent au contraire en
            lisibilité, et les deux moitiés du document (la mesure / ce que
            le diagnostic vérifie) sont enfin distinctes. */}
        <div className="flex flex-col gap-4 px-5 pb-6 pt-5 sm:px-6">
          <p className="mono text-[12px] text-ink-2">
            {SPECIMEN.moteurs} moteurs · {SPECIMEN.reponses} réponses
          </p>

          {/* Colonne sur mobile : à côté du score, la phrase d'écart se
              cassait en trois lignes avec « fois » tout seul. */}
          <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <p className="flex items-baseline gap-1">
              {/* tabular-nums : sans chasse fixe, le score sautait en largeur
                  en passant de 9 à 10 puis de 29 à 30 pendant le comptage. */}
              <span className="text-[64px] font-extrabold leading-[0.78] tracking-[-0.06em] tabular-nums">
                {score}
              </span>
              <span className="mono text-[20px] text-ink-2">/100</span>
            </p>
            {/* L'écart, dit en toutes lettres : c'est le message du bloc, et
                il n'était lisible qu'en comparant trois barres à l'œil. */}
            {vous && rival ? (
              <p className="mono text-left text-[12px] leading-[1.45] text-ink-2 sm:max-w-[48%] sm:text-right">
                cité{" "}
                <span className="font-semibold tabular-nums text-signal">{compteVous} fois</span>{" "}
                quand son rival l'est{" "}
                <span className="font-semibold tabular-nums text-ink">{compteRival} fois</span>
              </p>
            ) : null}
          </div>

          <ul className="flex flex-col gap-2.5">
            {SPECIMEN.mentions.map((m, i) => (
              <li key={m.nom} className="flex items-center gap-3">
                <span
                  className={`w-[104px] flex-none text-[13px] ${
                    m.vous ? "font-semibold text-signal" : ""
                  }`}
                >
                  {m.nom}
                </span>
                <span className="h-[10px] flex-1 bg-paper-2">
                  <span
                    className="block h-full transition-[width] duration-700 ease-out"
                    style={{
                      width: actif ? `${m.part}%` : "0%",
                      backgroundColor: m.vous ? "var(--signal)" : "var(--ink)",
                      transitionDelay: `${T_BARRES + i * 110}ms`,
                    }}
                  />
                </span>
                <span
                  className={`mono w-[26px] flex-none text-right text-[12px] tabular-nums ${
                    m.vous ? "font-semibold text-signal" : "text-ink-2"
                  }`}
                >
                  {comptes[i]}
                </span>
              </li>
            ))}
          </ul>

          <div className="border-t-2 border-ink pt-4">
            <p className="mono text-[11px] uppercase tracking-[0.13em] text-ink-2">
              {SPECIMEN.pointsLabel}
            </p>
            <ul className="mt-2.5 flex flex-col gap-2">
              {SPECIMEN.points.map((p, i) => (
                <li
                  key={p.label}
                  className="flex items-start gap-2.5 transition-opacity duration-500 ease-out"
                  style={{
                    opacity: actif ? 1 : 0,
                    transitionDelay: `${T_CONTROLES + i * 130}ms`,
                  }}
                >
                  <span className="pt-0.5 text-signal">
                    <TicIcon />
                  </span>
                  <span className="flex-1 text-[13.5px] leading-[1.35]">{p.label}</span>
                  <span className="mono hidden flex-none text-[11.5px] text-ink-2 sm:block">
                    {p.valeur}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <p className="mono mt-3 text-[11px] text-ink-2">{SPECIMEN.mentionLegale}</p>
    </div>
  );
}
