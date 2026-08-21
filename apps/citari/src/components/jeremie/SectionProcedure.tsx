import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { useScanFormFocus } from "@/lib/scan-form-focus";
import { Reveal } from "@/components/jeremie/Reveal";
import { ScrollFloat } from "@/components/jeremie/ScrollFloat";
import { Quadrillage } from "@/components/jeremie/Quadrillage";
import { DemoScan, DemoScanComplet, DemoSprint } from "@/components/jeremie/DemoEtape";

/**
 * Les trois étapes du tunnel, sur fond sombre quadrillé.
 *
 * Version v3 de Jérémie, portée le 14/08/2026 : gros numéros d'étape,
 * libellés CE QUE VOUS RECEVEZ / CE QUE ÇA VOUS COÛTE, textes longs.
 *
 * Trois retouches de doctrine par rapport à sa copie, parce qu'il n'y a pas
 * encore de client ni de prospect réel :
 * - « La plupart de nos prospects découvrent... » affirmait un historique qui
 *   n'existe pas → reformulé au conditionnel, même rythme ;
 * - « C'est déjà arrivé, et ça arrivera encore » (dire qu'un score est bon
 *   sans rien vendre) → coupé, la promesse seule suffit ;
 * - « Dans trente jours, si » promettait qu'une IA aurait à DIRE : les moteurs
 *   intègrent en 4 à 12 semaines (notre propre page méthode). « À lire »
 *   est la version vraie : la matière existe bien à J+30.
 */

type Etape = {
  num: string;
  label?: string;
  titre: string;
  cout: string;
  labelCout?: string;
  /**
   * Le prix et la durée, séparés et remontés EN TÊTE de carte le
   * 15/08/2026. Le titre de la section promet « vous savez d'avance ce que
   * chacune coûte », et le coût était en bas, en 13px, après 120 à 190 mots :
   * la mise en page contredisait la promesse. Le repère « offert » distingue
   * d'un coup d'œil les deux étapes gratuites de celle qui se paie.
   */
  prix: string;
  offert: boolean;
  /**
   * Marque l'étape qui se paie une seule fois. Le repère « sans abonnement »
   * s'affiche alors contre le prix : c'est notre écart le plus net avec une
   * offre par abonnement, et il se perdait en bas de carte.
   *
   * Formulé sur NOTRE modèle, jamais sur celui des autres : écrire « à la
   * différence de nos concurrents » serait une affirmation sur des tiers que
   * nous ne pouvons pas prouver, et le site n'avance rien qu'il ne puisse
   * tenir.
   */
  paiementUnique?: boolean;
  duree: string;
  labelObtenu?: string;
  /**
   * Trois à quatre étiquettes de six mots — plus des paragraphes.
   *
   * Réécrites le 17/08/2026 : un développeur extérieur a lu le site et
   * renvoyé « réduis la quantité de texte, les gens n'ont pas le temps de
   * lire, mets davantage de visuel ». Les quatre puces de prose faisaient
   * 200 mots par carte à côté d'une illustration décorative. La prose
   * complète n'est pas perdue : elle vit sur les pages liées en pied de
   * carte (/methode, /scan-complet, /sprint), qui sont aussi les pages que
   * les moteurs doivent indexer.
   */
  preuves: string[];
  /**
   * La phrase qui mérite de survivre à la coupe, s'il y en a une. Deux des
   * trois ont sauté ; celle de l'étape 02 est restée, c'est la seule qui
   * dise quelque chose qu'aucun visuel ne peut montrer.
   */
  chute?: ReactNode;
  /**
   * La notice technique de l'étape, en bouton au pied de la carte
   * (15/08/2026). La section « Vérifiabilité » qui suivait les trois étapes
   * redisait ce que les cartes venaient de dire : c'était un doublon, et le
   * Sprint n'y figurait même pas. Chaque étape porte désormais SON document
   * — le détail vit sur les pages /methode et /sprint, jamais dans un
   * dépliant caché sous la carte (le contenu replié n'est pas lu, piège
   * déjà payé deux fois).
   */
  doc: { label: string; to: string; hash?: string };
  /**
   * Le panneau animé qui occupe la colonne de gauche.
   *
   * Il remplace l'illustration décorative (loupe, guillemet, cadran) qui
   * tenait 40 % de la carte sans rien démontrer. Ici la colonne MONTRE
   * l'étape : le scan qui compte des noms, les six moteurs qui s'allument,
   * les robots qui entrent. Voir DemoEtape.tsx.
   */
  Demo: () => ReactNode;
};

const ETAPES: Etape[] = [
  {
    num: "01",
    label: "LE SCAN",
    titre: "Vous voyez enfin ce qu'on répond à votre place",
    cout: "Votre adresse professionnelle. Ni carte bancaire, ni rendez-vous, ni engagement.",
    labelCout: "CE QUE ÇA VOUS COÛTE",
    prix: "Gratuit",
    offert: true,
    duree: "90 secondes",
    labelObtenu: "CE QUE VOUS RECEVEZ",
    // Le panneau montre les trois : les réponses arrivent, les noms se
    // comptent, les portes se testent. Les étiquettes ne font que nommer ce
    // que l'œil vient de voir.
    preuves: [
      "40 réponses réelles, sous vos yeux",
      "Chaque nom cité, compté et classé",
      "Vos portes testées, robot par robot",
    ],
    doc: { label: "La méthode de mesure, publiée en entier", to: "/methode" },
    Demo: DemoScan,
  },
  {
    num: "02",
    label: "LE SCAN COMPLET",
    titre: "Cette fois, les six moteurs répondent. Le plan qui en sort est à vous.",
    cout: "30 minutes en visio. Ni carte bancaire, ni engagement.",
    labelCout: "CE QUE ÇA VOUS COÛTE",
    prix: "Offert",
    offert: true,
    duree: "30 minutes",
    labelObtenu: "CE QUE VOUS RECEVEZ",
    preuves: [
      "144 réponses, six moteurs, web activé",
      "Les adresses qui décident, listées",
      "La fiche que les IA récitent sur vous",
    ],
    // La phrase la plus forte du site reste ici, où le scepticisme est
    // maximal. Le contrôle du 14/08 l'avait relevée quatre fois à
    // l'identique dans le parcours : c'est désormais son seul emplacement
    // sur la landing. Seule des trois chutes à survivre à la coupe du
    // 17/08/2026 — un visuel peut montrer une mesure, pas un renoncement
    // commercial.
    chute: (
      <strong className="font-semibold text-ink">
        Nous n'avons rien à vendre à une entreprise déjà bien citée : dans ce cas, on vous le dit et
        l'affaire s'arrête là.
      </strong>
    ),
    // Sa propre page depuis le 15/08/2026 : les cartes 01 et 02 renvoyaient
    // toutes deux vers /methode, ce que Luigi a relevé — deux étapes, deux
    // documents.
    doc: { label: "Le scan complet, déplié", to: "/scan-complet" },
    Demo: DemoScanComplet,
  },
  {
    num: "03",
    label: "LE SPRINT GEO",
    titre: "Aujourd'hui, une IA n'a presque rien à lire sur vous. Dans trente jours, si.",
    cout: "2 900 € HT, une fois. 50 % à la commande, 50 % à la livraison. Aucun abonnement, aucune reconduction.",
    prix: "2 900 € HT",
    offert: false,
    paiementUnique: true,
    duree: "30 jours",
    labelObtenu: "CE QUE NOUS FAISONS",
    // Le jargon exact (robots.txt, llms.txt, IndexNow) reste un argument de
    // vente : il est passé DANS le panneau animé, où il se lit d'un coup
    // d'œil sans coûter un paragraphe. La 4ᵉ étiquette garde les 60 jours de
    // suivi, seul vrai écart avec une agence.
    preuves: [
      "Votre site ouvert aux robots d'IA",
      "5 pages écrites, indexées en heures",
      "Votre nom posé sur les bonnes sources",
      "60 jours de suivi après la livraison",
    ],
    doc: { label: "Le programme des 90 jours, étape par étape", to: "/sprint" },
    labelCout: "CE QUE ÇA VOUS DEMANDE",
    Demo: DemoSprint,
  },
];

export function SectionProcedure() {
  const { focusAndScroll } = useScanFormFocus();

  return (
    // « parcours » et non « methode » depuis le 15/08/2026 : cette section
    // décrit le PARCOURS commercial (scan, scan complet, sprint), pas la
    // méthode de mesure. Elle occupait le mot « Méthode » dans la barre
    // latérale, et cannibalisait donc la page /methode — celle qui publie la
    // formule et le calcul complet, que Luigi n'a retrouvée qu'au fond du
    // pied de page. Un nom, une chose.
    <section id="parcours" className="relative scroll-mt-20 overflow-hidden bg-ink">
      <Quadrillage variante="sombre" />
      <div className="relative z-10 mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <Reveal>
          <p className="mono text-[12px] uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--paper)_55%,transparent)]">
            LE PARCOURS
          </p>
        </Reveal>

        <ScrollFloat
          className="mt-5 max-w-[600px] text-[34px] text-paper sm:text-[52px]"
          style={{
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            textWrap: "pretty" as never,
          }}
        >
          Trois étapes. Vous savez d'avance ce que chacune coûte.
        </ScrollFloat>

        <Reveal>
          <p className="measure mt-5 text-[color-mix(in_srgb,var(--paper)_72%,transparent)]">
            Vous pouvez vous arrêter après n'importe laquelle. Chacune se suffit à elle-même,{" "}
            <strong className="font-semibold text-paper">
              et rien ne se déclenche sans que vous l'ayez décidé.
            </strong>
          </p>
        </Reveal>

        {/* Cartes empilées : chaque étape se superpose à la précédente au
            défilement. Compactées le 14/08/2026 (demande Luigi : « trop
            longues de haut en bas ») : rien du texte n'a bougé, mais corps un
            cran plus petit, interlignes et espacements resserrés, numéro
            réduit, et l'image passe à 2/5 de la largeur pour que le texte
            s'étale moins en hauteur. Une carte doit tenir sous un écran. */}
        <ul className="mt-10">
          {ETAPES.map((etape, i) => (
            <li
              key={etape.num}
              className="stack-card"
              style={{
                top: `calc(5rem + ${i * 1.25}rem)`,
                marginBottom: i === ETAPES.length - 1 ? 0 : "2rem",
                zIndex: i + 1,
              }}
            >
              <Reveal delay={i * 120} className="block">
                <div>
                  <div className="card-lift group grid gap-0 overflow-hidden border border-rule bg-paper shadow-[0_32px_70px_-36px_rgba(251,250,247,0.18)] hover:border-signal sm:grid-cols-[2fr_3fr]">
                    {/* La colonne de démonstration. L'ancienne illustration
                        (un PNG décoratif recadré en object-cover, plafonné à
                        510px) posait un problème de recadrage réglé trois
                        fois ; le panneau animé n'a plus ce souci puisqu'il se
                        met à la hauteur de la carte. Le fond reprend
                        --paper-2, donc plus de blancs de bords à accorder au
                        pixel près comme le 15/08. */}
                    <div className="flex min-h-[330px] items-stretch border-b border-rule sm:min-h-0 sm:border-b-0 sm:border-r">
                      <etape.Demo />
                    </div>

                    <div className="flex flex-col p-6 sm:p-7">
                      {/* Le bandeau de tête : numéro, nature de l'étape, et
                          surtout PRIX et durée, lisibles avant tout le reste.
                          La section promet qu'on sait d'avance ce que chacune
                          coûte : elle le tient maintenant à la première
                          seconde. */}
                      <div className="flex items-start justify-between gap-4 border-b border-rule pb-4">
                        <div className="flex flex-col">
                          <span className="mono text-[40px] font-bold leading-[0.85] tracking-tighter text-ink sm:text-[48px]">
                            {etape.num}
                          </span>
                          {etape.label ? (
                            <span className="mono mt-1 text-[11px] uppercase tracking-[0.12em] text-ink-2">
                              {etape.label}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[20px] font-bold leading-none tracking-[-0.02em] sm:text-[23px] ${
                              etape.offert ? "text-signal" : "text-ink"
                            }`}
                          >
                            {etape.prix}
                          </span>
                          <span className="mono text-[12px] tabular-nums text-ink-2">
                            {etape.duree}
                          </span>
                          {/* Le paiement unique, affiché À CÔTÉ DU PRIX
                              (17/08/2026). Il ne vivait que dans la ligne de
                              coût, en bas de carte et en petit : c'est
                              pourtant la différence la plus nette avec les
                              offres par abonnement, et elle doit se lire dans
                              la même seconde que le montant. */}
                          {etape.paiementUnique ? (
                            <span className="mono mt-1 border border-signal px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.1em] text-signal">
                              sans abonnement
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <h3 className="mt-4 text-[22px] leading-[1.15] text-ink sm:text-[25px]">
                        {etape.titre}
                      </h3>

                      <div className="mt-4">
                        <p className="mono text-[11px] uppercase tracking-[0.12em] text-ink-2">
                          {etape.labelObtenu ?? "vous obtenez"}
                        </p>
                        {/* Des étiquettes, plus des paragraphes : une ligne
                            chacune, aucune ne doit passer à la ligne sur
                            desktop. Le corps remonte à 15,5px parce qu'il n'y
                            a plus de pavé à compacter. */}
                        <ul className="mt-3 flex flex-col gap-2.5">
                          {etape.preuves.map((point, k) => (
                            <li key={k} className="flex items-baseline gap-2.5">
                              <span aria-hidden className="mono flex-none text-[11px] text-signal">
                                →
                              </span>
                              <span className="flex-1 text-[15.5px] leading-[1.3] text-ink">
                                {point}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {etape.chute ? (
                          <p className="mt-4 border-t border-rule pt-3 text-[14px] leading-[1.45] text-ink-2">
                            {etape.chute}
                          </p>
                        ) : null}
                      </div>

                      <dl className="mono mt-5 border-l-2 border-rule pl-4 text-[13.5px] tabular-nums sm:mt-auto sm:pt-5">
                        <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-2">
                          {etape.labelCout ?? "coût"}
                        </dt>
                        <dd className="mt-1.5 leading-snug text-ink">{etape.cout}</dd>
                      </dl>

                      {/* La notice technique de l'étape : un bouton, pas un
                          lien discret — la leçon du test du père vaut ici
                          aussi. */}
                      <Link
                        to={etape.doc.to}
                        hash={etape.doc.hash}
                        className="group/doc mt-5 flex items-center justify-between gap-3 border border-ink px-4 py-3 text-[14px] font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-paper"
                      >
                        <span>{etape.doc.label}</span>
                        <span
                          aria-hidden
                          className="text-[16px] leading-none transition-transform duration-200 group-hover/doc:translate-x-1"
                        >
                          →
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal as="div" delay={400} className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={focusAndScroll}
            className="group inline-flex items-center justify-between gap-10 border border-signal bg-signal px-6 py-4 text-paper transition-colors duration-300 hover:bg-paper hover:text-signal active:scale-[0.98]"
          >
            <span className="mono text-[12px] font-semibold uppercase tracking-[0.2em]">
              lancer le scan
            </span>
            <span className="text-[22px] leading-none transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </button>
        </Reveal>
      </div>
    </section>
  );
}
