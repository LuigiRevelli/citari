/**
 * Pilote de scans, exécuté dans apps/citari.
 *
 * Le moteur de mesure vit dans le dépôt du site et utilise l'alias « @/ »,
 * que tsx ne résout qu'avec ce dossier pour racine. Ce fichier est donc lancé
 * en sous-processus depuis le toolkit, avec ce dossier comme dossier courant.
 * La frontière reste nette : le toolkit orchestre, le site mesure.
 *
 * Entrée  : un JSON sur argv[2], soit { cibles, secteur, ville, mode } pour
 *           créer puis dérouler des scans, soit { scanIds } pour dérouler des
 *           scans déjà créés (contrôle J+45, re-scan J+90).
 * Sortie  : une ligne JSON par scan sur la sortie standard, préfixée
 *           « RESULT », pour que la progression reste lisible en direct.
 */
type Cible = { nom: string; site: string | null };

const params = JSON.parse(process.argv[2] ?? "{}") as {
  cibles?: Cible[];
  scanIds?: string[];
  secteur?: string;
  ville?: string | null;
  mode?: "apercu" | "complet";
  sansCache?: boolean;
  /** Scan de référence, à re-noter sur les moteurs réellement utilisés ici. */
  referenceScanId?: string;
  parallele: number;
};

const { creerScan, avancerScan, etatScan, scoreSurMoteurs } = (await import(
  new URL("./src/lib/orchestrateur.server.ts", `file://${process.cwd()}/`).href
)) as any;
// `teaserScan` a disparu le 09/08/2026 avec l'écran d'aguiche (« Supprimer
// l'aguiche »), et ce pilote l'appelait encore : scan-lot échouait sur chaque
// ligne sans jamais interroger un moteur. La lecture passe désormais par
// `buildScanInsights`, celle qu'utilise déjà `relance`. Elle lit les mêmes
// colonnes et rend en plus le verbatim (`killerQuote`).
const { buildScanInsights } = await import("./insights.js");
const { supabaseAdmin } = (await import(
  new URL("./src/integrations/supabase/client.server.ts", `file://${process.cwd()}/`).href
)) as any;

/** Les moteurs effectivement interrogés par un scan, lus depuis ses réponses. */
async function moteursDuScan(scanId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from("responses").select("engine").eq("scan_id", scanId);
  return [...new Set((data ?? []).map((r: { engine: string }) => r.engine))];
}

/** Déroule la collecte exactement comme le fait le navigateur, jusqu'au bout. */
async function derouler(scanId: string) {
  for (let tour = 0; tour < 40; tour++) {
    await avancerScan(scanId);
    const etat = await etatScan(scanId);
    if (!etat || etat.status !== "running") break;
  }
  // `teaserScan` refusait de rendre quoi que ce soit tant que le scan n'était
  // pas « done », et l'appelant s'appuie sur ce null pour signaler « scan non
  // terminé ». `buildScanInsights` ne vérifie rien : sans ce contrôle, un scan
  // interrompu rendrait un score partiel présenté comme définitif.
  const final = await etatScan(scanId);
  if (!final || final.status !== "done") return null;
  return buildScanInsights(scanId);
}

function resume(t: any) {
  return {
    score: t.score,
    cite: t.citationsCible,
    concurrents: t.citationsConcurrents,
    perdues: t.missedCount,
    botsBloques: t.botsBloques ?? [],
    verbatim: t.killerQuote ?? null,
  };
}

async function traiterCible(cible: Cible) {
  try {
    const scan = await creerScan({
      marque: cible.nom,
      url: cible.site,
      secteur: params.secteur,
      ville: params.ville ?? null,
      concurrents: [],
      langue: "fr",
      ipHash: "scan-lot",
      mode: params.mode ?? "apercu",
      sansCache: params.sansCache ?? false,
    });
    const t = await derouler(scan.id);
    if (!t) return { ...cible, scanId: scan.id, erreur: "scan non terminé" };
    return { ...cible, scanId: scan.id, ...resume(t) };
  } catch (e) {
    return { ...cible, erreur: e instanceof Error ? e.message : "erreur inconnue" };
  }
}

async function traiterScan(scanId: string) {
  try {
    const t = await derouler(scanId);
    if (!t) return { scanId, erreur: "scan non terminé" };
    // Base de comparaison recalculée sur les moteurs réellement interrogés
    // ici, lus depuis les réponses de ce scan : aucune liste à tenir à jour,
    // et l'écart ne peut pas mesurer une différence de méthode.
    const scoreReference = params.referenceScanId
      ? await scoreSurMoteurs(params.referenceScanId, await moteursDuScan(scanId))
      : null;
    return { scanId, scoreReference, ...resume(t) };
  } catch (e) {
    return { scanId, erreur: e instanceof Error ? e.message : "erreur inconnue" };
  }
}

// File d'attente à parallélisme borné : au-delà de 3, les API renvoient des 429.
const file: (Cible | string)[] = params.scanIds ?? params.cibles ?? [];
await Promise.all(
  Array.from({ length: Math.max(1, Math.min(5, params.parallele)) }, async () => {
    for (;;) {
      const item = file.shift();
      if (!item) return;
      const r = typeof item === "string" ? await traiterScan(item) : await traiterCible(item);
      console.log("RESULT " + JSON.stringify(r));
    }
  }),
);
