/**
 * Transition problème → solution sur la landing.
 *
 * Portée du projet Lovable de Jérémie le 14/08/2026. Phrase verrouillée,
 * affichée sur la longueur, avec l'animation StrokeText et le quadrillage
 * repris de l'écran de scan.
 *
 * Le schéma est venu se poser dessous le 17/08/2026. La section annonçait
 * « nous trouvons pourquoi les IA ne vous citent pas, puis nous le
 * réparons » et s'arrêtait là : 26 mots, 245px, une promesse sans preuve.
 * Le schéma montre le pourquoi ET la réparation, sur le même écran, sans
 * ajouter de paragraphe.
 */
import { Quadrillage } from "@/components/jeremie/Quadrillage";
import { StrokeText } from "@/components/jeremie/StrokeText";
import { SchemaTroisPlaces } from "@/components/jeremie/SchemaTroisPlaces";

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

        <div className="mt-16 sm:mt-24">
          <SchemaTroisPlaces />
        </div>
      </div>
    </section>
  );
}
