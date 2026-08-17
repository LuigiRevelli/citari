/**
 * Le schéma d'ouverture : il n'y a que trois places.
 *
 * Version en couronne, 17/08/2026. La composition précédente alignait le
 * podium à gauche et étalait la foule en dessous : Jérémie a gardé l'idée
 * mais refusé le dessin, et la moitié droite du cadre restait vide. Ici les
 * trois places tiennent le centre et le marché rayonne autour — la rareté
 * se voit dans la géométrie, pas dans une légende.
 *
 * Ce que le schéma dit, et que la page ne disait nulle part : une réponse
 * d'IA ne nomme que TROIS entreprises. Votre marché en compte trente. La
 * rareté est l'argument commercial du produit ; il ne vivait jusqu'ici que
 * dans la question 5 de la FAQ.
 *
 * Deux interactions, et c'est tout :
 * - le métier, choisi par le visiteur (voir data/marches.ts) — l'exemple
 *   comptable en dur excluait tous les autres corps de métier ;
 * - l'échange de place au Sprint : votre nom monte, un autre tombe.
 *
 * Aucun cadre, aucune courbe, aucun rectangle : que du texte posé dans
 * l'espace. Les positions sont calculées par trigonométrie au chargement du
 * module, donc identiques au serveur et au client — un tirage aléatoire
 * casserait l'hydratation.
 */
import { useMemo, useRef, useState } from "react";

import { MARCHES } from "@/data/marches";
import { useDemoActive } from "@/lib/use-demo-active";

type Pos = { x: number; y: number; rang?: number };

/** Les trois places, au centre exact du champ. */
const PLACES: Pos[] = [
  { x: 50, y: 39, rang: 1 },
  { x: 50, y: 50, rang: 2 },
  { x: 50, y: 61, rang: 3 },
];

/**
 * Un anneau de positions. Le rayon horizontal reste sous 41 % : au-delà, un
 * nom centré sur son point déborde du cadre à droite.
 */
function anneau(n: number, rx: number, ry: number, depart: number): Pos[] {
  return Array.from({ length: n }, (_, i) => {
    const a = depart + (i / n) * Math.PI * 2;
    return { x: 50 + Math.cos(a) * rx, y: 50 + Math.sin(a) * ry };
  });
}

/** Dix noms proches, quatorze plus loin : la foule a de la profondeur. */
const COURONNE: Pos[] = [
  ...anneau(10, 31, 25, -Math.PI / 2 + 0.32),
  ...anneau(14, 41, 40, -Math.PI / 2),
];

/** La place que vous occupez dans la foule, avant le Sprint. */
const INDEX_VOUS = 15;

/**
 * Les positions gardées sous 640px.
 *
 * Deux contraintes mesurées au rendu à 375px. D'abord la densité : les
 * vingt-quatre noms se chevauchaient. Ensuite, et c'est le piège, les
 * FLANCS de la couronne sont inutilisables — un nom posé à 90 % de large
 * déborde du cadre, et il se trouve à la hauteur exacte du podium, dont le
 * troisième nom est long (« Expertise Lyon Sud », « Dépannage Lyon Sud »).
 * Ne restent donc que le haut et le bas de l'anneau externe, entre 30 et
 * 70 % de large. Six noms, plus le vôtre.
 */
const MOBILE = new Set([10, 11, 16, 17, 18, 23, INDEX_VOUS]);

export function SchemaTroisPlaces() {
  const ref = useRef<HTMLDivElement | null>(null);
  const actif = useDemoActive(ref, 0.2);
  const [apres, setApres] = useState(false);
  const [iMarche, setIMarche] = useState(0);

  const marche = MARCHES[iMarche];

  /**
   * Tous les noms du champ, chacun avec sa position avant et après. Trois
   * seulement bougent : le premier cité ne descend jamais — on ne promet
   * pas de déloger le leader.
   */
  const noms = useMemo(() => {
    const posVous = COURONNE[INDEX_VOUS];
    const foule = marche.foule.filter((_, i) => i !== INDEX_VOUS).slice(0, COURONNE.length - 1);

    return [
      { cle: "c1", texte: marche.cites[0], avant: PLACES[0], apres: PLACES[0] },
      { cle: "c2", texte: marche.cites[1], avant: PLACES[1], apres: PLACES[2] },
      { cle: "c3", texte: marche.cites[2], avant: PLACES[2], apres: posVous },
      { cle: "vous", texte: "Vous", vous: true, avant: posVous, apres: PLACES[1] },
      ...COURONNE.filter((_, i) => i !== INDEX_VOUS).map((p, i) => ({
        cle: `f${i}`,
        texte: foule[i] ?? "",
        avant: p,
        apres: p,
        index: i < INDEX_VOUS ? i : i + 1,
      })),
    ];
  }, [marche]);

  const nbAutres = noms.filter((n) => "index" in n).length;

  return (
    <div ref={ref} className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
      {/* Le métier du visiteur : sans lui, l'exemple parle du voisin. */}
      <div className="mb-8 flex flex-wrap items-baseline gap-x-6 gap-y-3 sm:mb-10">
        <span className="mono text-[11px] uppercase tracking-[0.16em] text-ink-2">vous êtes</span>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          {MARCHES.map((m, i) => (
            <button
              key={m.metier}
              type="button"
              onClick={() => {
                setIMarche(i);
                // On repart de l'état « aujourd'hui » : le visiteur doit
                // voir son propre marché avant la promesse.
                setApres(false);
              }}
              aria-pressed={i === iMarche}
              className={`border-b-2 pb-0.5 text-[15px] transition-colors duration-200 sm:text-[17px] ${
                i === iMarche
                  ? "border-signal text-ink"
                  : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              {m.metier}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-10 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-t border-rule pt-6 sm:mb-4">
        <p className="text-[19px] italic text-ink sm:text-[23px]">« {marche.requete} »</p>
        <div className="mono flex items-center gap-6 text-[12px] uppercase tracking-[0.12em]">
          {[
            { label: "aujourd'hui", val: false },
            { label: "après le Sprint", val: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setApres(o.val)}
              aria-pressed={apres === o.val}
              className={`border-b-2 pb-1 transition-colors duration-200 ${
                apres === o.val
                  ? "border-signal text-ink"
                  : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Le champ. Les trois places au centre, le marché tout autour. */}
      <div className="relative h-[430px] w-full sm:h-[560px] lg:h-[640px]">
        {noms.map((n) => {
          const p = apres ? n.apres : n.avant;
          const surPodium = p.rang !== undefined;
          const vous = "vous" in n && n.vous;
          const idx = "index" in n ? (n.index as number) : -1;
          const cacheMobile = idx >= 0 && !MOBILE.has(idx);
          const retard = surPodium ? 200 + (p.rang ?? 0) * 150 : 700 + (idx % 12) * 55;

          return (
            <span
              key={`${marche.metier}-${n.cle}`}
              className={`absolute whitespace-nowrap ${cacheMobile ? "hidden sm:inline" : ""}`}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: "translate(-50%, -50%)",
                opacity: actif ? (surPodium || vous ? 1 : 0.32) : 0,
                fontSize: surPodium
                  ? // 17px au plancher : à 20px, « 03 Expertise Lyon Sud »
                    // occupait la moitié de la largeur d'un mobile.
                    "clamp(17px, 2.5vw, 37px)"
                  : vous
                    ? "clamp(13px, 1.15vw, 17px)"
                    : "clamp(10px, 0.92vw, 14px)",
                fontWeight: vous ? 600 : 400,
                color: vous ? "var(--signal)" : "var(--ink)",
                letterSpacing: vous && !surPodium ? "0.1em" : undefined,
                // Le déplacement EST la démonstration : long et amorti, pour
                // qu'on le suive des yeux.
                transition: [
                  "left 1200ms cubic-bezier(0.16,1,0.3,1)",
                  "top 1200ms cubic-bezier(0.16,1,0.3,1)",
                  "font-size 1200ms cubic-bezier(0.16,1,0.3,1)",
                  `opacity 600ms ease-out ${retard}ms`,
                ].join(", "),
              }}
            >
              {surPodium ? (
                <span
                  aria-hidden
                  className="mono mr-3 align-middle text-[0.4em] tabular-nums text-ink-2"
                >
                  0{p.rang}
                </span>
              ) : null}
              {vous && !surPodium ? "VOUS" : n.texte}
            </span>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <p className="mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
          trois places · {nbAutres} autres {marche.metier}s dans votre ville
        </p>
        <p className="mono text-[10px] uppercase tracking-[0.12em] text-ink-2/70">
          Exemple illustratif · noms fictifs
        </p>
      </div>
    </div>
  );
}
