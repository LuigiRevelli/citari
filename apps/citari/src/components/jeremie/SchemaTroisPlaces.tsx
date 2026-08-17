/**
 * Le schéma d'ouverture : il n'y a que trois places.
 *
 * Troisième tentative, 17/08/2026, et la première qui ne soit pas un
 * diagramme. Les deux précédentes ont été refusées pour la même raison :
 * « ENCORE des cases et des schémas qui font brouillon ». La deuxième était
 * un graphe — une question, quatre sources, trois places, huit courbes qui
 * se croisent : seize éléments à décoder, et il fallait LIRE les libellés
 * pour comprendre. Un texte déguisé en visuel.
 *
 * Jérémie a aussi relevé que le motif « une question, des noms cités, des
 * barres » existait déjà trois fois sur la page (le spécimen du hero, le
 * schéma, la carte 01 du parcours). D'où la règle appliquée ici : ce schéma
 * doit dire ce que la page ne dit nulle part.
 *
 * Ce qu'il dit : une réponse d'IA ne nomme que TROIS entreprises. Votre
 * marché en compte quarante. La rareté est l'argument commercial du produit
 * — il ne vivait jusqu'ici que dans la question 5 de la FAQ.
 *
 * La forme : aucun cadre, aucune courbe. Un champ de noms flottants, trois
 * places occupées en grand, et le vôtre perdu dans la foule en rouge.
 * L'interaction est l'échange de place : au Sprint, votre nom monte et un
 * autre tombe. C'est la démonstration du produit en un clic.
 *
 * Les positions sont écrites à la main, jamais tirées au hasard : un
 * Math.random au rendu casserait l'hydratation, et une composition tenue à
 * la main se lit mieux qu'un nuage aléatoire.
 */
import { useRef, useState } from "react";

import { useDemoActive } from "@/lib/use-demo-active";

type Pos = {
  /** En pourcentage du conteneur. */
  x: number;
  y: number;
  /** Le rang dans la réponse, si le nom est sur le podium. */
  rang?: number;
};

type Nom = {
  nom: string;
  vous?: boolean;
  avant: Pos;
  apres: Pos;
  /** Gardé sous 640px, où la foule doit s'éclaircir pour rester lisible. */
  mobile?: boolean;
};

/** Les trois places du podium, dans le même repère que la foule. */
const PLACE_1 = { x: 5, y: 13, rang: 1 };
const PLACE_2 = { x: 5, y: 26, rang: 2 };
const PLACE_3 = { x: 5, y: 39, rang: 3 };
/** Le trou laissé dans la foule par l'échange. */
const TROU = { x: 43, y: 73 };

/**
 * La foule : trente-cinq cabinets qui ne sortent jamais.
 *
 * Positions posées en sept rangs décalés, avec assez d'écart horizontal
 * pour que deux noms longs ne se chevauchent pas en `nowrap`.
 *
 * Le quatrième champ marque les noms gardés SOUS 640px. À 375px de large,
 * un nom de treize signes occupe déjà 18 % de la largeur : les cinq rangs
 * pleins produisaient 27 chevauchements et quatre débordements (mesurés au
 * rendu). Sur mobile la foule se réduit donc à deux colonnes — elle reste
 * une foule, elle redevient lisible.
 */
const FOULE: Array<[string, number, number, boolean?]> = [
  ["Cabinet Morel", 4, 56, true],
  ["Audit Rhône", 24, 56],
  ["Oméga Conseil", 44, 56, true],
  ["Compta+", 64, 56],
  ["Cabinet Vidal", 79, 56],
  ["Duval & Associés", 12, 62],
  ["Cabinet Roux", 33, 62],
  ["Rhône Expertise", 51, 62, true],
  ["Cap Compta", 71, 62],
  ["Axe Conseil", 85, 62],
  ["Cabinet Leroy", 3, 68, true],
  ["Synergie Audit", 21, 68],
  ["Cabinet Blanc", 41, 68, true],
  ["Lyon Fiduciaire", 59, 68],
  ["Vertex Conseil", 78, 68],
  ["Cabinet Aubert", 10, 73, true],
  ["Prisme Audit", 29, 73],
  ["Cabinet Faure", 62, 73],
  ["Neo Gestion", 80, 73],
  ["Cabinet Girard", 5, 79, true],
  ["Méridien Audit", 24, 79],
  ["Cabinet Perrin", 44, 79, true],
  ["Atlas Compta", 63, 79],
  ["Cabinet Simon", 79, 79],
  ["Horizon Audit", 13, 85],
  ["Cabinet Noël", 32, 85],
  ["Delta Conseil", 50, 85, true],
  ["Cabinet Vincent", 68, 85],
  ["Sud Comptabilité", 85, 85],
  ["Lyon Gestion", 4, 91, true],
  ["Cabinet Mercier", 22, 91],
  ["Fiduciaire Est", 42, 91, true],
  ["Contrôle Lyon", 60, 91],
  ["Alpha Audit", 78, 91],
  ["Expert & Co", 90, 91],
];

const NOMS: Nom[] = [
  // Le premier ne bouge jamais : on ne promet pas de déloger le leader.
  { nom: "Fiduciaire Rhône", avant: PLACE_1, apres: PLACE_1, mobile: true },
  // Le deuxième recule d'un rang pour vous laisser la place.
  { nom: "Cabinet Bertrand", avant: PLACE_2, apres: PLACE_3, mobile: true },
  // Le troisième retombe dans la foule, à l'endroit que vous quittez.
  { nom: "Expertise Lyon Sud", avant: PLACE_3, apres: TROU, mobile: true },
  // Vous : de la foule à la deuxième place.
  { nom: "Vous", vous: true, avant: TROU, apres: PLACE_2, mobile: true },
  ...FOULE.map(([nom, x, y, mobile]) => ({
    nom,
    avant: { x, y },
    apres: { x, y },
    mobile,
  })),
];

export function SchemaTroisPlaces() {
  const ref = useRef<HTMLDivElement | null>(null);
  const actif = useDemoActive(ref, 0.2);
  const [apres, setApres] = useState(false);

  return (
    <div ref={ref} className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 sm:mb-12">
        <p className="mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
          une réponse d'IA ne nomme que trois entreprises
        </p>
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

      {/* Le champ. Aucun fond, aucune bordure : les noms flottent. */}
      <div className="relative h-[440px] w-full sm:h-[540px] lg:h-[600px]">
        {NOMS.map((n, i) => {
          const p = apres ? n.apres : n.avant;
          const surPodium = p.rang !== undefined;
          // La foule entre en dernier, en cascade : le podium se lit
          // d'abord, la masse arrive ensuite et le sens se referme.
          const retard = surPodium ? 200 + (p.rang ?? 0) * 160 : 700 + (i % 12) * 55;

          return (
            <span
              key={n.nom}
              className={`absolute whitespace-nowrap ${n.mobile ? "" : "hidden sm:inline"}`}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                opacity: actif ? (surPodium || n.vous ? 1 : 0.34) : 0,
                fontSize: surPodium
                  ? "clamp(21px, 2.7vw, 40px)"
                  : n.vous
                    ? "clamp(13px, 1.15vw, 17px)"
                    : "clamp(10px, 0.92vw, 14px)",
                fontWeight: n.vous ? 600 : 400,
                color: n.vous ? "var(--signal)" : "var(--ink)",
                letterSpacing: n.vous && !surPodium ? "0.08em" : undefined,
                // Le déplacement est la démonstration : il doit se voir, donc
                // il est long et fortement amorti.
                transition: [
                  "left 1100ms cubic-bezier(0.16,1,0.3,1)",
                  "top 1100ms cubic-bezier(0.16,1,0.3,1)",
                  "font-size 1100ms cubic-bezier(0.16,1,0.3,1)",
                  `opacity 600ms ease-out ${retard}ms`,
                ].join(", "),
              }}
            >
              {surPodium ? (
                <span
                  aria-hidden
                  className="mono mr-4 align-middle text-[0.42em] tabular-nums text-ink-2"
                >
                  0{p.rang}
                </span>
              ) : null}
              {n.vous ? (n.vous && surPodium ? "Vous" : "VOUS") : n.nom}
            </span>
          );
        })}

        {/* La légende de la foule. À DROITE : le podium occupe la colonne
            de gauche et sa troisième place venait la percuter (chevauchement
            mesuré au rendu, 17/08/2026). */}
        <span
          className="mono absolute right-0 text-right text-[10px] uppercase tracking-[0.16em] text-ink-2"
          style={{
            top: "49%",
            opacity: actif ? 1 : 0,
            transition: "opacity 600ms ease-out 900ms",
          }}
        >
          les 36 autres cabinets de votre ville
        </span>
      </div>

      <p className="mono mt-6 text-[10px] uppercase tracking-[0.12em] text-ink-2/70">
        Exemple illustratif · cabinets fictifs
      </p>
    </div>
  );
}
