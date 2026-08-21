/**
 * Transition problème → solution sur la landing.
 *
 * Portée du projet Lovable de Jérémie le 14/08/2026. Phrase verrouillée,
 * affichée sur la longueur, avec l'animation StrokeText et le quadrillage
 * repris de l'écran de scan.
 *
 * Un schéma « les trois places » y a vécu la journée du 17/08/2026 — un
 * podium de trois cités au centre, le reste du marché en nuage autour, et
 * l'échange de place au Sprint. Retiré le soir même sur demande de Jérémie.
 * La section retrouve sa forme d'origine : la phrase, et rien d'autre.
 */
import { Quadrillage } from "@/components/jeremie/Quadrillage";
import { StrokeText } from "@/components/jeremie/StrokeText";

const LIGNE_1 = "Nous trouvons pourquoi les IA ne vous citent pas.";
const LIGNE_2 = "Puis nous le réparons.";

export function ProblemSolutionBridge() {
  return (
    <section id="probleme" className="relative overflow-hidden border-y border-rule bg-paper-2">
      <Quadrillage variante="clair" />
      <div className="relative mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-8 sm:py-24">
        <div className="flex flex-col gap-1 sm:gap-2">
          <StrokeText text={LIGNE_1} delay={80} duration={1300} />
          <StrokeText text={LIGNE_2} delay={850} duration={1100} align="right" />
        </div>
      </div>
    </section>
  );
}
