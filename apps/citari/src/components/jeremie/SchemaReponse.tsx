/**
 * Le schéma central : comment une IA choisit qui recommander.
 *
 * Écrit le 17/08/2026. Retour de Jérémie après avoir regardé postloop.online :
 * « il n'y a que des cartes dynamiques, j'aimerais voir des vrais schémas
 * animés qui montrent bien ce qu'on fait ». La comparaison chiffrée lui
 * donnait raison — même hauteur de page que Postloop, trois fois plus de mots
 * (2 257 contre 734, soit 270 mots par écran contre 88).
 *
 * La leçon retenue de leur landing : un titre court, une ligne de sous-titre,
 * puis un grand schéma pleine largeur qui porte seul la démonstration. Pas un
 * panneau dans une carte — le cadre disparaît, les nœuds flottent.
 *
 * Ce que le schéma doit faire comprendre en dix secondes, sans lire :
 * une IA ne connaît pas votre marché, elle va LIRE des sources avant de
 * répondre ; ces sources parlent de vos concurrents ; votre site, lui, est
 * fermé à ses robots. D'où l'absence dans la réponse. Le bouton « Après le
 * Sprint » rejoue exactement la même mécanique avec les deux verrous levés :
 * c'est la promesse du produit, montrée plutôt qu'affirmée.
 *
 * Le SVG porte toute la scène (pas de mesure au montage, donc pas de
 * recalcul au redimensionnement) et défile horizontalement sous 900px plutôt
 * que de réduire le texte sous le lisible.
 */
import { useRef, useState } from "react";

import { useDemoActive } from "@/lib/use-demo-active";

type Source = {
  /** L'adresse, telle qu'un moteur la consulte. */
  url: string;
  /** Ce que la source dit — le nom qu'elle fait gagner. */
  dit: string;
  /** Le site du visiteur : c'est le seul nœud que le Sprint change. */
  vous?: boolean;
};

const SOURCES: Source[] = [
  { url: "annuaire-experts-comptables.fr", dit: "cite Concurrent A" },
  { url: "lesechos.fr / classement 2026", dit: "cite Concurrent B" },
  { url: "comparateur-pro.fr", dit: "cite Concurrent C" },
  { url: "votre-site.fr", dit: "GPTBot bloqué", vous: true },
];

/** Géométrie de la scène, en unités du viewBox. */
const BOITE = { x: 372, l: 300, h: 58 };
const PREMIER_Y = 46;
const PAS_Y = 78;
const QUESTION = { x: 24, y: 150, l: 288, h: 104 };
const REPONSE = { x: 748, y: 128, l: 228, h: 148 };

const yDe = (i: number) => PREMIER_Y + i * PAS_Y;

/** Une courbe douce entre deux points, en cubique horizontale. */
function courbe(x1: number, y1: number, x2: number, y2: number) {
  const dx = (x2 - x1) * 0.55;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function SchemaReponse() {
  const ref = useRef<HTMLDivElement | null>(null);
  const actif = useDemoActive(ref, 0.25);
  const [apres, setApres] = useState(false);

  // Les trois noms de la réponse. Après le Sprint, le visiteur prend la
  // deuxième place — pas la première : on ne promet pas un podium.
  const reponse = apres
    ? ["Concurrent A", "Vous", "Concurrent B"]
    : ["Concurrent A", "Concurrent B", "Concurrent C"];

  const trace = (retard: number) => ({
    strokeDasharray: 1,
    strokeDashoffset: actif ? 0 : 1,
    transition: `stroke-dashoffset 900ms ease-out ${retard}ms`,
  });

  return (
    <div ref={ref} className="w-full">
      {/* L'en-tête du schéma : un libellé, et le basculement avant/après.
          Le bouton est la seule chose à comprendre pour tout comprendre. */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          comment une IA choisit qui recommander
        </p>
        <div className="mono flex items-center border border-rule text-[11px] uppercase tracking-[0.1em]">
          {[
            { label: "aujourd'hui", val: false },
            { label: "après le Sprint", val: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setApres(o.val)}
              aria-pressed={apres === o.val}
              className={`px-3 py-2 transition-colors duration-200 ${
                apres === o.val ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sous 900px on fait défiler plutôt que d'écraser le texte. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <svg
          viewBox="0 0 1000 372"
          className="w-full min-w-[860px]"
          role="img"
          aria-label={
            apres
              ? "Schéma : l'IA lit les sources et votre site désormais ouvert, et vous cite dans sa réponse."
              : "Schéma : l'IA lit trois sources qui citent vos concurrents, votre site lui est fermé, et sa réponse ne vous mentionne pas."
          }
        >
          {/* ---- les liaisons, tracées avant les boîtes ---- */}
          <g fill="none" strokeWidth="1.25">
            {SOURCES.map((s, i) => {
              const y = yDe(i) + BOITE.h / 2;
              const muet = s.vous && !apres;
              return (
                <path
                  key={`q-${s.url}`}
                  d={courbe(QUESTION.x + QUESTION.l, QUESTION.y + QUESTION.h / 2, BOITE.x, y)}
                  pathLength={1}
                  stroke={muet ? "var(--signal)" : "var(--ink)"}
                  strokeOpacity={muet ? 0.6 : 0.45}
                  strokeDasharray={muet ? "4 4" : undefined}
                  style={muet ? undefined : trace(160 + i * 90)}
                />
              );
            })}

            {SOURCES.map((s, i) => {
              // La source « vous » ne pousse rien vers la réponse tant que le
              // Sprint n'a pas eu lieu : c'est tout le sujet du schéma.
              if (s.vous && !apres) return null;
              const y = yDe(i) + BOITE.h / 2;
              const mien = s.vous;
              return (
                <path
                  key={`r-${s.url}`}
                  d={courbe(BOITE.x + BOITE.l, y, REPONSE.x, REPONSE.y + REPONSE.h / 2)}
                  pathLength={1}
                  stroke={mien ? "var(--signal)" : "var(--ink)"}
                  strokeOpacity={mien ? 0.95 : 0.45}
                  style={trace(620 + i * 90)}
                />
              );
            })}
          </g>

          {/* ---- la question de l'acheteur ---- */}
          <g
            style={{
              opacity: actif ? 1 : 0,
              transition: "opacity 500ms ease-out 60ms",
            }}
          >
            <rect
              x={QUESTION.x}
              y={QUESTION.y}
              width={QUESTION.l}
              height={QUESTION.h}
              fill="var(--paper)"
              stroke="var(--ink)"
              strokeWidth="1.25"
            />
            <text
              x={QUESTION.x + 16}
              y={QUESTION.y + 26}
              className="mono"
              fontSize="10"
              letterSpacing="1.2"
              fill="var(--ink-2)"
            >
              UN ACHETEUR DEMANDE
            </text>
            <text x={QUESTION.x + 16} y={QUESTION.y + 54} fontSize="14.5" fill="var(--ink)">
              « meilleur cabinet
            </text>
            <text x={QUESTION.x + 16} y={QUESTION.y + 76} fontSize="14.5" fill="var(--ink)">
              comptable à Lyon »
            </text>
          </g>

          {/* ---- ce que l'IA va lire avant de répondre ---- */}
          <text
            x={BOITE.x}
            y={26}
            className="mono"
            fontSize="10"
            letterSpacing="1.2"
            fill="var(--ink-2)"
            style={{ opacity: actif ? 1 : 0, transition: "opacity 500ms ease-out 300ms" }}
          >
            CE QUE L'IA VA LIRE AVANT DE RÉPONDRE
          </text>

          {SOURCES.map((s, i) => {
            const y = yDe(i);
            const ouvert = !s.vous || apres;
            const dit = s.vous ? (apres ? "vous cite · 5 pages" : "GPTBot bloqué") : s.dit;
            return (
              <g
                key={s.url}
                style={{
                  opacity: actif ? 1 : 0,
                  transition: `opacity 480ms ease-out ${260 + i * 90}ms`,
                }}
              >
                <rect
                  x={BOITE.x}
                  y={y}
                  width={BOITE.l}
                  height={BOITE.h}
                  fill="var(--paper)"
                  stroke={ouvert ? "var(--ink)" : "var(--signal)"}
                  strokeWidth={s.vous ? 1.75 : 1.25}
                />
                <text x={BOITE.x + 14} y={y + 24} fontSize="12.5" fill="var(--ink)">
                  {s.url}
                </text>
                <text
                  x={BOITE.x + 14}
                  y={y + 43}
                  className="mono"
                  fontSize="10.5"
                  fill={ouvert ? "var(--ink-2)" : "var(--signal)"}
                >
                  {dit}
                </text>
                {/* Le cadenas de votre site : le seul repère rouge de la
                    colonne, pour que l'œil sache où est le problème. */}
                {s.vous ? (
                  <text
                    x={BOITE.x + BOITE.l - 14}
                    y={y + 35}
                    textAnchor="end"
                    fontSize="15"
                    fill={ouvert ? "var(--ink-2)" : "var(--signal)"}
                  >
                    {ouvert ? "✓" : "✕"}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* ---- la réponse rendue à l'acheteur ---- */}
          <g
            style={{
              opacity: actif ? 1 : 0,
              transition: "opacity 520ms ease-out 900ms",
            }}
          >
            <rect
              x={REPONSE.x}
              y={REPONSE.y}
              width={REPONSE.l}
              height={REPONSE.h}
              fill="var(--ink)"
            />
            <text
              x={REPONSE.x + 16}
              y={REPONSE.y + 26}
              className="mono"
              fontSize="10"
              letterSpacing="1.2"
              fill="color-mix(in srgb, var(--paper) 60%, transparent)"
            >
              LA RÉPONSE
            </text>
            {reponse.map((nom, i) => {
              const mien = nom === "Vous";
              const y = REPONSE.y + 56 + i * 26;
              return (
                <g key={`${nom}-${i}`}>
                  {/* Votre ligne est surlignée en rouge plein : c'est la
                      chute du schéma, elle ne peut pas se contenter d'un gras
                      sur fond sombre — au premier essai elle se noyait dans
                      les deux autres. */}
                  {mien ? (
                    <rect
                      x={REPONSE.x + 8}
                      y={y - 15}
                      width={REPONSE.l - 16}
                      height={22}
                      fill="var(--signal)"
                    />
                  ) : null}
                  <text
                    x={REPONSE.x + 16}
                    y={y}
                    fontSize="14"
                    fontWeight={mien ? 700 : 400}
                    fill="var(--paper)"
                  >
                    {i + 1}. {nom}
                  </text>
                </g>
              );
            })}
          </g>

          {/* La conclusion, sous la réponse : la seule phrase du schéma. */}
          <text
            x={REPONSE.x}
            y={REPONSE.y + REPONSE.h + 26}
            className="mono"
            fontSize="11"
            letterSpacing="0.6"
            fill={apres ? "var(--ink)" : "var(--signal)"}
            style={{ opacity: actif ? 1 : 0, transition: "opacity 500ms ease-out 1150ms" }}
          >
            {apres ? "vous y êtes." : "vous n'y êtes pas."}
          </text>
        </svg>
      </div>
    </div>
  );
}
