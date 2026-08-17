/**
 * Les démonstrations animées des trois étapes du parcours.
 *
 * Écrites le 17/08/2026 après le retour d'un développeur extérieur : « réduis
 * la quantité de texte, les gens n'ont pas le temps de lire, mets davantage de
 * visuel ». Les trois cartes du parcours portaient chacune ~200 mots de prose
 * à côté d'une illustration décorative (loupe, guillemet, cadran) qui occupait
 * 40 % de la carte sans rien démontrer.
 *
 * Doctrine retenue : montrer le plus possible, en dire le moins. Chaque panneau
 * remplace les quatre puces de prose de son étape par la CHOSE elle-même —
 * le scan qui compte des noms, les six moteurs qui s'allument, les robots qui
 * entrent. Le texte restant tient en trois étiquettes de six mots.
 *
 * Trois contraintes tenues :
 * - tout le contenu est dans le DOM au rendu serveur, l'animation ne fait que
 *   dévoiler (même raison que ScrollFloat : ce site vend sa lisibilité par les
 *   IA, il ne peut pas cacher son propre texte aux moteurs) ;
 * - `prefers-reduced-motion` affiche l'état final, sans mouvement ;
 * - rejouable au défilement, comme le reste du site (useApparition).
 *
 * Les chiffres montrés sont ceux de l'exemple illustratif du hero (34/100,
 * 19 / 12 / 2), pas une mesure réelle : la mention le dit sous chaque panneau.
 */
import { useEffect, useRef, useState } from "react";

import { useDemoActive } from "@/lib/use-demo-active";

/** Compte de 0 à `cible` quand `actif` passe à vrai. Repart de 0 sinon. */
function useCompteur(cible: number, actif: boolean, duree = 900, retard = 0) {
  const [valeur, setValeur] = useState(0);

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
    const demarre = window.setTimeout(() => {
      const pas = (t: number) => {
        if (!debut) debut = t;
        const p = Math.min((t - debut) / duree, 1);
        // Sortie cubique : l'aiguille ralentit en arrivant, comme un cadran.
        setValeur(Math.round(cible * (1 - Math.pow(1 - p, 3))));
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

/** Le cadre commun : même hauteur, même grain, même en-tête pour les trois. */
function Cadre({
  entete,
  actif,
  children,
  note,
}: {
  entete: string;
  actif: boolean;
  children: React.ReactNode;
  note: string;
}) {
  return (
    <div className="flex h-full w-full flex-col bg-[var(--paper-2)] p-5 sm:p-6">
      <div className="mono flex items-center justify-between gap-3 border-b border-rule pb-3 text-[10px] uppercase tracking-[0.14em] text-ink-2">
        <span>{entete}</span>
        <span
          aria-hidden
          className={`h-1.5 w-1.5 flex-none rounded-full transition-colors duration-500 ${
            actif ? "bg-signal" : "bg-[var(--rule-strong)]"
          }`}
          style={actif ? { animation: "demo-pulse 1.6s ease-in-out infinite" } : undefined}
        />
      </div>

      <div className="flex flex-1 flex-col justify-center py-5">{children}</div>

      <p className="mono border-t border-rule pt-3 text-[9.5px] uppercase leading-relaxed tracking-[0.1em] text-ink-2/70">
        {note}
      </p>
    </div>
  );
}

/** Une ligne qui apparaît avec un décalage, sans dépendance d'animation. */
function Ligne({
  actif,
  retard,
  className = "",
  children,
}: {
  actif: boolean;
  retard: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`transition-all duration-500 ease-out ${className}`}
      style={{
        opacity: actif ? 1 : 0,
        transform: actif ? "translateY(0)" : "translateY(8px)",
        transitionDelay: `${retard}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 01 — LE SCAN                                                        */
/* ------------------------------------------------------------------ */

const QUESTION = "meilleur cabinet comptable à Lyon";

const CITES = [
  { nom: "Concurrent A", total: 19, vous: false },
  { nom: "Concurrent B", total: 12, vous: false },
  { nom: "Vous", total: 2, vous: true },
];

const ROBOTS = [
  { nom: "GPTBot", ouvert: false },
  { nom: "ClaudeBot", ouvert: true },
  { nom: "PerplexityBot", ouvert: true },
];

export function DemoScan() {
  const ref = useRef<HTMLDivElement | null>(null);
  const actif = useDemoActive(ref);

  // La question s'écrit caractère par caractère : c'est ce qui dit « en
  // direct » sans avoir à écrire le mot.
  const [tapes, setTapes] = useState(0);
  useEffect(() => {
    if (!actif) {
      setTapes(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTapes(QUESTION.length);
      return;
    }
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setTapes(i);
      if (i >= QUESTION.length) clearInterval(t);
    }, 34);
    // Même filet que les compteurs : en arrière-plan, setInterval est bridé à
    // une seconde et la question resterait coupée en plein milieu (« meilleur
    // c ») pour qui revient sur l'onglet. Passé le temps de frappe normal, on
    // affiche la phrase entière.
    const rattrape = window.setTimeout(() => setTapes(QUESTION.length), QUESTION.length * 34 + 500);
    return () => {
      clearInterval(t);
      clearTimeout(rattrape);
    };
  }, [actif]);

  const a = useCompteur(19, actif, 1000, 1300);
  const b = useCompteur(12, actif, 1000, 1450);
  const v = useCompteur(2, actif, 1000, 1600);
  const comptes = [a, b, v];

  return (
    <div ref={ref} className="h-full w-full">
      <Cadre
        entete="en direct · 90 secondes"
        actif={actif}
        note="Exemple illustratif · concurrents fictifs"
      >
        {/* La question posée aux moteurs */}
        <div className="border border-rule bg-paper px-3 py-2.5">
          <p className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-2">
            question d'acheteur
          </p>
          <p className="mono mt-1 text-[12px] leading-snug text-ink">
            « {QUESTION.slice(0, tapes)}
            <span
              aria-hidden
              className="ml-px inline-block w-[6px] bg-signal align-middle"
              style={{
                height: "1em",
                opacity: tapes < QUESTION.length ? 1 : 0,
                animation: "citari-blink 0.9s steps(1) infinite",
              }}
            />
            {tapes >= QUESTION.length ? " »" : ""}
          </p>
        </div>

        {/* Les deux moteurs interrogés */}
        <Ligne actif={actif} retard={900} className="mt-3 flex items-center gap-2">
          {["ChatGPT", "Gemini"].map((m) => (
            <span
              key={m}
              className="mono border border-rule bg-paper px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-ink-2"
            >
              {m}
            </span>
          ))}
          <span className="mono ml-auto text-[10px] tabular-nums text-ink-2">40 réponses</span>
        </Ligne>

        {/* Le décompte des noms cités */}
        <div className="mt-4 flex flex-col gap-2">
          {CITES.map((c, i) => (
            <Ligne key={c.nom} actif={actif} retard={1200 + i * 150}>
              <div className="flex items-center gap-2.5">
                <span
                  className={`mono w-[86px] flex-none text-[11px] ${
                    c.vous ? "font-semibold text-signal" : "text-ink-2"
                  }`}
                >
                  {c.nom}
                </span>
                <span className="relative h-[9px] flex-1 bg-[var(--rule)]">
                  <span
                    className={`absolute inset-y-0 left-0 transition-[width] duration-[1000ms] ease-out ${
                      c.vous ? "bg-signal" : "bg-ink"
                    }`}
                    style={{
                      width: actif ? `${(c.total / 19) * 100}%` : "0%",
                      transitionDelay: `${1300 + i * 150}ms`,
                    }}
                  />
                </span>
                <span
                  className={`mono w-[22px] flex-none text-right text-[12px] tabular-nums ${
                    c.vous ? "font-semibold text-signal" : "text-ink"
                  }`}
                >
                  {comptes[i]}
                </span>
              </div>
            </Ligne>
          ))}
        </div>

        {/* Le test des portes : le plus parlant pour un dirigeant */}
        <Ligne actif={actif} retard={2100} className="mt-4 border-t border-rule pt-3">
          <p className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-2">
            vos portes, robot par robot
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {ROBOTS.map((r, i) => (
              <Ligne key={r.nom} actif={actif} retard={2300 + i * 180}>
                <div className="mono flex items-center justify-between text-[10.5px]">
                  <span className="text-ink-2">{r.nom}</span>
                  <span
                    className={
                      r.ouvert ? "text-ink-2" : "bg-signal px-1.5 py-px font-semibold text-paper"
                    }
                  >
                    {r.ouvert ? "ouvert" : "bloqué"}
                  </span>
                </div>
              </Ligne>
            ))}
          </div>
        </Ligne>
      </Cadre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — LE SCAN COMPLET                                                */
/* ------------------------------------------------------------------ */

const MOTEURS = ["ChatGPT", "Gemini", "Claude", "Perplexity", "Copilot", "Mistral"];

const SOURCES = [
  { url: "annuaire-experts-comptables.fr", cite: true },
  { url: "lesechos.fr / classement", cite: true },
  { url: "votre-site.fr", cite: false },
];

export function DemoScanComplet() {
  const ref = useRef<HTMLDivElement | null>(null);
  const actif = useDemoActive(ref);
  const reponses = useCompteur(144, actif, 1200, 500);

  return (
    <div ref={ref} className="h-full w-full">
      <Cadre
        entete="six moteurs · recherche web"
        actif={actif}
        note="Exemple illustratif · sources fictives"
      >
        {/* Le passage à l'échelle, en un chiffre */}
        <div className="flex items-end justify-between gap-3 border-b border-rule pb-4">
          <div>
            <p className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-2">
              réponses lues
            </p>
            <p className="mono mt-1 text-[42px] font-bold leading-[0.85] tracking-tighter tabular-nums text-ink">
              {reponses}
            </p>
          </div>
          <p className="mono pb-1 text-right text-[10px] leading-relaxed text-ink-2">
            au lieu de 40
            <br />
            au scan gratuit
          </p>
        </div>

        {/* Les six moteurs qui s'allument un par un */}
        <div className="mt-4">
          <p className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-2">
            moteurs interrogés
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {MOTEURS.map((m, i) => (
              <span
                key={m}
                className="mono border px-1.5 py-1 text-center text-[9.5px] uppercase tracking-[0.06em] transition-all duration-400 ease-out"
                style={{
                  opacity: actif ? 1 : 0.25,
                  borderColor: actif ? "var(--ink)" : "var(--rule)",
                  color: actif ? "var(--ink)" : "var(--ink-2)",
                  transitionDelay: `${600 + i * 110}ms`,
                }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Les adresses réellement ouvertes avant de recommander */}
        <Ligne actif={actif} retard={1400} className="mt-4 border-t border-rule pt-3">
          <p className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-2">
            ouvert avant de citer
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {SOURCES.map((s, i) => (
              <Ligne key={s.url} actif={actif} retard={1600 + i * 170}>
                <div className="mono flex items-center gap-2 text-[10.5px]">
                  <span
                    aria-hidden
                    className={`h-1 w-1 flex-none rounded-full ${s.cite ? "bg-ink" : "bg-signal"}`}
                  />
                  <span
                    className={`truncate ${s.cite ? "text-ink-2" : "text-signal line-through"}`}
                  >
                    {s.url}
                  </span>
                  {!s.cite ? (
                    <span className="mono ml-auto flex-none text-[9px] uppercase text-signal">
                      jamais ouvert
                    </span>
                  ) : null}
                </div>
              </Ligne>
            ))}
          </div>
        </Ligne>

        {/* Le point de départ scellé : la promesse de la remesure */}
        <Ligne actif={actif} retard={2200} className="mt-4">
          <div className="mono flex items-center justify-between border border-ink px-2.5 py-2 text-[10px] uppercase tracking-[0.1em] text-ink">
            <span>point de départ scellé</span>
            <span className="tabular-nums text-ink-2">rejouable à j+90</span>
          </div>
        </Ligne>
      </Cadre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — LE SPRINT                                                      */
/* ------------------------------------------------------------------ */

/** Visites de robots par semaine : le seul chiffre qui prouve que ça bouge. */
const SEMAINES = [0, 0, 3, 11, 24, 38, 47];

const CHANTIERS = [
  "robots.txt · llms.txt · schema.org",
  "5 pages écrites, indexées en heures",
  "votre nom posé sur les sources",
];

export function DemoSprint() {
  const ref = useRef<HTMLDivElement | null>(null);
  const actif = useDemoActive(ref);
  const visites = useCompteur(47, actif, 1400, 700);
  const max = Math.max(...SEMAINES);

  return (
    <div ref={ref} className="h-full w-full">
      <Cadre
        entete="30 jours · remesure à j+90"
        actif={actif}
        note="Ordre de grandeur observé en test"
      >
        {/* La courbe des robots qui entrent */}
        <div>
          <div className="flex items-end justify-between gap-3">
            <p className="mono text-[9.5px] uppercase leading-relaxed tracking-[0.12em] text-ink-2">
              robots d'IA entrés
              <br />
              dans vos logs
            </p>
            <p className="mono text-right text-[38px] font-bold leading-[0.85] tracking-tighter tabular-nums text-ink">
              {visites}
              <span className="ml-1 text-[11px] font-normal tracking-normal text-ink-2">/sem.</span>
            </p>
          </div>

          <div className="mt-3 flex h-[74px] items-end gap-1.5">
            {SEMAINES.map((n, i) => (
              <span key={i} className="relative flex-1 bg-[var(--rule)]" style={{ height: "100%" }}>
                <span
                  className={`absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out ${
                    n === 0 ? "bg-[var(--rule-strong)]" : "bg-signal"
                  }`}
                  style={{
                    height: actif ? `${Math.max((n / max) * 100, 3)}%` : "3%",
                    transitionDelay: `${700 + i * 90}ms`,
                  }}
                />
              </span>
            ))}
          </div>
          <div className="mono mt-1.5 flex justify-between text-[9px] uppercase tracking-[0.1em] text-ink-2">
            <span>jour 0</span>
            <span>jour 30</span>
          </div>
        </div>

        {/* Les trois chantiers qui se cochent */}
        <div className="mt-5 border-t border-rule pt-3">
          <p className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-2">ce qu'on fait</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {CHANTIERS.map((c, i) => (
              <Ligne key={c} actif={actif} retard={1500 + i * 220}>
                <div className="mono flex items-center gap-2 text-[10.5px] text-ink-2">
                  <span
                    aria-hidden
                    className="flex h-3.5 w-3.5 flex-none items-center justify-center border border-signal text-[9px] font-bold leading-none text-paper transition-colors duration-300"
                    style={{
                      backgroundColor: actif ? "var(--signal)" : "transparent",
                      transitionDelay: `${1700 + i * 220}ms`,
                    }}
                  >
                    ✓
                  </span>
                  <span className="truncate">{c}</span>
                </div>
              </Ligne>
            ))}
          </div>
        </div>

        {/* La seule garantie : le même relevé, mot pour mot */}
        <Ligne actif={actif} retard={2300} className="mt-4">
          <div className="mono flex items-center justify-between border border-ink bg-ink px-2.5 py-2 text-[10px] uppercase tracking-[0.1em] text-paper">
            <span>j+90 · même relevé</span>
            <span className="text-paper/60">mot pour mot</span>
          </div>
        </Ligne>
      </Cadre>
    </div>
  );
}

export const DEMOS = [DemoScan, DemoScanComplet, DemoSprint] as const;
