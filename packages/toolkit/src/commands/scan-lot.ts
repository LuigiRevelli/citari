import { readFileSync } from "node:fs";
import { getDb, unwrap } from "@geo/core";
import { slugify, writeDeliverableFile } from "../lib/context.js";
import { executerPilote } from "../lib/pilote.js";
import { EMAIL_A_TROUVER, STATUT_PROSPECT } from "../lib/prospect.js";

/**
 * Scanne une liste d'entreprises et produit le classement.
 *
 * C'est la brique de toute l'acquisition. Une seule exécution sert deux fois :
 * le classement devient le baromètre sectoriel (contenu, angle presse), et
 * chaque ligne devient un prospect déjà scanné, appelable avec son vrai
 * chiffre en main. Les plus mal classés sont les meilleurs prospects : ils ont
 * le plus à gagner et le plus de mal à nier le problème.
 *
 * Le scan lui-même est exécuté par le moteur du site, jamais ici : on crée les
 * lignes, puis on pilote leur avancement en appelant la même fonction que le
 * navigateur. Une seule implémentation de la mesure, comme partout ailleurs.
 */

export interface Cible {
  nom: string;
  site: string | null;
}

/** Une entreprise par ligne : « Nom, site.fr ». Le site est facultatif. */
export function parseListe(contenu: string): Cible[] {
  const cibles: Cible[] = [];
  for (const brute of contenu.split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith("#")) continue;
    const [nom, site] = ligne.split(/[,;\t]/).map((c) => c?.trim());
    if (!nom) continue;
    cibles.push({ nom, site: site && site.length > 3 ? site : null });
  }
  return cibles;
}

type Options = {
  secteur: string;
  ville?: string;
  mode?: "apercu" | "complet";
  /** Nombre de scans menés de front. Au-delà de 3, les API commencent à limiter. */
  parallele?: number;
  pipeline?: boolean;
  sansCache?: boolean;
};

export async function scanLot(fichier: string, opts: Options): Promise<void> {
  const cibles = parseListe(readFileSync(fichier, "utf8"));
  if (cibles.length === 0) throw new Error(`Aucune entreprise lue dans ${fichier}.`);

  const mode = opts.mode ?? "apercu";
  const parallele = Math.max(1, Math.min(5, opts.parallele ?? 3));
  const coutUnitaire = mode === "apercu" ? 0.14 : 1.06; // mesurés en réel le 2026-08-03

  console.log(`${cibles.length} entreprises · secteur « ${opts.secteur} »${opts.ville ? ` · ${opts.ville}` : ""}`);
  console.log(`Mode ${mode} · ${parallele} en parallèle · coût estimé ${(cibles.length * coutUnitaire).toFixed(2)} €\n`);

  let faits = 0;
  type Resultat = Cible & {
    scanId?: string;
    score?: number;
    cite?: number;
    concurrents?: number;
    perdues?: number;
    botsBloques?: string[];
    erreur?: string;
  };

  const resultats: Resultat[] = await executerPilote(
    { cibles, secteur: opts.secteur, ville: opts.ville ?? null, mode, parallele, sansCache: opts.sansCache ?? false },
    (r: Resultat) => {
      const etiquette = r.erreur ? `✗ ${r.erreur.slice(0, 40)}` : `${String(r.score).padStart(3)}/100`;
      console.log(`  ${String(++faits).padStart(3)}/${cibles.length}  ${etiquette}  ${r.nom}`);
    }
  );

  // Du pire au meilleur : les plus mal classés sont les meilleurs prospects.
  const classes = resultats
    .filter((r) => !r.erreur)
    .sort((a, b) => (a.score ?? 100) - (b.score ?? 100));
  const echecs = resultats.filter((r) => r.erreur);

  const slug = slugify(`${opts.secteur}-${opts.ville ?? "france"}`);
  const md = `# Baromètre de la visibilité IA — ${opts.secteur}${opts.ville ? ` · ${opts.ville}` : ""}

${classes.length} entreprises mesurées le ${new Date().toLocaleDateString("fr-FR")}, sur ${
    mode === "apercu" ? "20 questions × 2 moteurs" : "24 questions × 6 moteurs"
  }.

Méthode : des questions d'intention d'achat du secteur, posées sans jamais
citer la marque suivie, via les API officielles des éditeurs. Le classement va
du moins visible au plus visible.

| # | Entreprise | Score | Cité | Concurrents | Questions sans mention | Robots d'IA bloqués |
|---|---|---|---|---|---|---|
${classes
  .map(
    (r, i) =>
      `| ${i + 1} | ${r.nom} | **${r.score}**/100 | ${r.cite} | ${r.concurrents} | ${r.perdues} | ${
        r.botsBloques?.length ? r.botsBloques.join(", ") : "aucun"
      } |`
  )
  .join("\n")}

${echecs.length > 0 ? `\n## Non mesurées\n\n${echecs.map((r) => `- ${r.nom} : ${r.erreur}`).join("\n")}\n` : ""}
---

*Chaque entreprise citée peut obtenir son rapport détaillé gratuitement, et
dispose d'un droit de réponse. Méthode de calcul publiée : présence 50 %,
rang 20 %, recommandation explicite 20 %, tonalité 10 %.*
`;

  const chemin = writeDeliverableFile(`barometres/${slug}`, "classement.md", md);

  // Alimentation du pipeline : chaque entreprise devient un prospect scanné.
  if (opts.pipeline !== false && classes.length > 0) {
    const db = getDb();
    let ajoutes = 0;
    for (const r of classes) {
      const existe = unwrap(
        await db.from("leads").select("id").eq("company", r.nom).limit(1)
      ) as { id: string }[];
      if (existe.length > 0) continue;
      // Pas d'email : le lead n'existe que comme prospect à contacter, et la
      // colonne email est obligatoire. On utilise un marqueur explicite.
      await db.from("leads").insert({
        scan_id: r.scanId,
        email: `a-trouver+${slugify(r.nom)}${EMAIL_A_TROUVER}`,
        company: r.nom,
        status: STATUT_PROSPECT,
        priority: (r.score ?? 100) < 30 ? "chaud" : (r.score ?? 100) < 55 ? "tiede" : "froid",
        notes: `Baromètre ${opts.secteur}${opts.ville ? ` ${opts.ville}` : ""} — score ${r.score}/100, cité ${r.cite} fois contre ${r.concurrents} pour ses concurrents.`,
      });
      ajoutes++;
    }
    console.log(`\n${ajoutes} prospects ajoutés au pipeline (email à compléter).`);
  }

  console.log(`\n─── Classement (les 5 plus mal placés = vos meilleurs prospects) ───`);
  for (const r of classes.slice(0, 5)) {
    console.log(`  ${String(r.score).padStart(3)}/100  ${r.nom.padEnd(32)} cité ${r.cite}× contre ${r.concurrents}×`);
  }
  console.log(`\n${classes.length} mesurées · ${echecs.length} en échec · ${(resultats.length * coutUnitaire).toFixed(2)} € environ`);
  console.log(`→ ${chemin}`);
}

