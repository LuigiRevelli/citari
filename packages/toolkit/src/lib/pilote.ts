import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Lancement du pilote de scans, dans apps/citari.
 *
 * Le moteur de mesure vit dans le dépôt du site et utilise l'alias « @/ », que
 * tsx ne résout qu'avec ce dossier pour racine. Plutôt que de dupliquer des
 * correspondances de chemins, on lance le pilote en sous-processus avec le bon
 * dossier courant. La frontière reste nette : le toolkit orchestre, le site
 * mesure, et il n'existe qu'une seule implémentation de la mesure.
 *
 * Deux usages, une seule mécanique : créer puis dérouler une liste de scans
 * (baromètre), ou dérouler des scans déjà créés (contrôle J+45, re-scan J+90).
 */
export type ParamsPilote =
  | {
      cibles: { nom: string; site: string | null }[];
      secteur: string;
      ville: string | null;
      mode: "apercu" | "complet";
      parallele: number;
      /** Ignore le cache de trois jours : remesure après une panne de clé. */
      sansCache?: boolean;
    }
  | { scanIds: string[]; parallele: number; referenceScanId?: string };

export function executerPilote(params: ParamsPilote, onResultat: (r: any) => void): Promise<any[]> {
  const racine = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const pilote = join(racine, "packages/toolkit/src/lib/pilote-scan.mts");
  const site = join(racine, "apps/citari");

  return new Promise((resolve, reject) => {
    const proc = spawn("npx", ["-y", "tsx", pilote, JSON.stringify(params)], { cwd: site, env: process.env });
    const out: any[] = [];
    let reste = "";
    let erreurs = "";
    proc.stdout.on("data", (chunk) => {
      reste += chunk.toString();
      const lignes = reste.split("\n");
      reste = lignes.pop() ?? "";
      for (const l of lignes) {
        if (!l.startsWith("RESULT ")) continue;
        const r = JSON.parse(l.slice(7));
        out.push(r);
        onResultat(r);
      }
    });
    proc.stderr.on("data", (c) => (erreurs += c.toString()));
    proc.on("close", (code) =>
      code === 0 || out.length > 0
        ? resolve(out)
        : reject(new Error(`Le pilote a échoué (code ${code}) : ${erreurs.slice(0, 400)}`))
    );
  });
}
