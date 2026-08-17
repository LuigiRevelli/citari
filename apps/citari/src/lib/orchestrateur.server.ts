import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  interroger,
  analyser,
  deduireMetier,
  genererQuestions,
  matiereDuSite,
  questionMiroir,
  classerConcurrents,
} from "@/lib/moteurs.server";
import { calculerScore, partDeVoix, regrouperMarques, type LigneMention } from "@/lib/score";
import { MOTEURS, MOTEURS_APERCU, MOTEURS_CONTROLE, type ModeScan, type Moteur } from "@/lib/typo";

export type PdvItem = {
  name: string;
  count: number;
  share: number;
  target: boolean;
  /** Posé par finaliser : rival atteignable, géant hors de portée, ou outil. */
  classe?: "rival" | "geant" | "outil" | "institution";
  /** Écritures regroupées sous ce nom : rien n'est caché au client. */
  variantes?: string[];
};
export type Action = { chantier: string; titre: string; pourquoi: string; effort: string };

// Réglable par variable d'environnement, comme les plafonds de coût : les
// tests internes posent PLAFOND_SCANS_PAR_IP dans `.env.local` (jamais
// versionné), la production garde ce défaut sans redéploiement.
export const PLAFOND_SCANS_PAR_IP = Number(process.env.PLAFOND_SCANS_PAR_IP ?? 2);
/**
 * Plafond de dépense par scan, au-delà duquel la collecte s'arrête et le scan
 * est finalisé avec ce qu'il a déjà.
 *
 * Aperçu : gratuit et public, le plafond est un fusible anti-dérive.
 * Complet : déclenché uniquement pour un rendez-vous réservé, on paye la qualité.
 * Mesurés sur le premier scan réel : 1,06 € pour 24 questions × 6 moteurs.
 * Contrôle J+45 = 4 moteurs à recherche ≈ 0,84 €, d'où un plafond à 1,5 €.
 *
 * Réglables par variable d'environnement : le jour où un éditeur double ses
 * tarifs, on veut pouvoir resserrer le fusible en une minute, sans redéployer.
 */
function plafond(mode: ModeScan, defaut: number): number {
  const brut = process.env[`PLAFOND_EUR_${mode.toUpperCase()}`];
  const v = brut === undefined ? NaN : Number(brut);
  return Number.isFinite(v) && v > 0 ? v : defaut;
}

export const PLAFONDS_EUR: Record<ModeScan, number> = {
  get apercu() {
    return plafond("apercu", 0.25);
  },
  get complet() {
    return plafond("complet", 3);
  },
  get controle() {
    return plafond("controle", 1.5);
  },
};
/**
 * Paires (question × moteur) traitées à chaque sondage du navigateur.
 *
 * L'aperçu est public et sa promesse est « 90 secondes » : mesuré à 2 min 17
 * avec des lots de 8 (5 tours), il descend à ~1 min avec des lots de 20
 * (2 tours). Les appels d'un lot partent en parallèle, donc un lot plus large
 * ne coûte pas plus cher, il attend simplement le plus lent.
 *
 * Le mode complet garde des lots de 8 : il tourne hors de la présence du
 * prospect, et 6 moteurs dont certains à 18 s de latence supportent mal
 * d'être lancés par paquets de 20.
 */
function lotDuMode(mode: ModeScan): number {
  return mode === "apercu" ? 20 : 8;
}
/**
 * Fenêtre de cache d'un résultat de scan.
 *
 * Trois jours, et pas trente : le GEO d'une entreprise bouge, notamment quand
 * elle vient de découvrir son score et commence à agir. Resservir un mois plus
 * tard une mesure périmée ferait mentir le chiffre, et priverait le prospect de
 * la seule chose qui le ferait revenir, voir son score progresser.
 *
 * Trois jours suffisent à couvrir ce qu'on veut couvrir : le visiteur qui
 * relance deux fois dans la journée, celui qui repasse le lendemain montrer le
 * rapport à son associé, et le partage du lien dans une équipe. Pendant cette
 * fenêtre, tout le monde voit exactement le même score et les mêmes réponses,
 * puisqu'on renvoie le scan existant et non une nouvelle mesure.
 */
const CACHE_JOURS = 3;

function moteursDuMode(mode: ModeScan): readonly Moteur[] {
  if (mode === "apercu") return MOTEURS_APERCU;
  if (mode === "controle") return MOTEURS_CONTROLE;
  return MOTEURS;
}

/** Normalisation pour la détection de marque : minuscules, sans accents ni ponctuation. */
export function normaliserNom(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `aiguille` apparaît-elle dans `foin` comme une suite de MOTS entiers ? */
function contientCommeMots(foin: string, aiguille: string): boolean {
  return ` ${foin} `.includes(` ${aiguille} `);
}

/**
 * Même marque ? Comparaison sur les formes normalisées.
 *
 * Cette fonction décide de `is_target`, donc du score, donc du chiffre qu'on
 * facture. Elle doit rattraper les noms écorchés sans jamais attribuer au
 * client les citations d'un autre.
 *
 * Deux souplesses, chacune bornée, et l'ordre compte.
 *
 * 1. **Un nom entier contenu dans l'autre, aux frontières de mots.** C'est le
 *    cas courant : « Amarris » dans « Amarris Direct », « Vaurel » dans
 *    « Cabinet Vaurel », « BDO » dans « BDO France ». La frontière de mot est
 *    tout l'intérêt : elle laisse passer les sigles courts quand ils forment un
 *    mot, sans les laisser se noyer dans n'importe quelle chaîne.
 *
 * 2. **Les formes compactes, quand elles sont quasi identiques.** C'est ce qui
 *    règle le bug d'origine : « nutri)smar » devient « nutri smar », donc
 *    « nutrismar », et doit reconnaître « nutrismart ». Un moteur qui tronque
 *    ou ponctue un nom produit une forme presque aussi longue que l'originale,
 *    d'où le seuil de 80 %.
 *
 * Ce que ça corrige, le 06/08/2026 : l'ancienne version faisait une simple
 * recherche de sous-chaîne. Un client nommé « Ora » captait donc les mentions
 * d'« Orange », et son score montait pour de mauvaises raisons. C'est le pire
 * sens de l'erreur, puisqu'on aurait annoncé au client une visibilité qu'il
 * n'a pas, avant de la voir s'évaporer au contrôle J+90.
 */
export function memeMarque(a: string, b: string): boolean {
  const na = normaliserNom(a);
  const nb = normaliserNom(b);
  if (na.length < 2 || nb.length < 2) return false;
  if (na === nb) return true;

  if (contientCommeMots(na, nb) || contientCommeMots(nb, na)) return true;

  const ca = na.replace(/ /g, "");
  const cb = nb.replace(/ /g, "");
  if (ca === cb) return true;

  const [court, long] = ca.length <= cb.length ? [ca, cb] : [cb, ca];
  return court.length >= 4 && long.includes(court) && court.length / long.length >= 0.8;
}

/** Clé de cache : le domaine du site, sinon marque+secteur+ville normalisés. */
export function cleDomaine(url: string | null, marque: string, secteur: string, ville: string | null): string {
  if (url) {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      return u.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      /* URL invalide : on retombe sur la clé nominative */
    }
  }
  return [marque, secteur, ville ?? ""].map(normaliserNom).join("|");
}

export function hacherIp(ip: string) {
  return createHash("sha256").update(`geo-sprint:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Le scan déjà mesuré pour ce domaine, s'il est dans la fenêtre de cache.
 *
 * Extrait de `creerScan` pour que l'appelant puisse savoir qu'un résultat
 * existe AVANT d'appliquer le quota : resservir une mesure déjà payée ne
 * consomme aucune API, donc refuser ce visiteur au motif du plafond n'aurait
 * aucun sens.
 */
export async function chercherCache(domaine: string, mode: ModeScan) {
  const depuis = new Date(Date.now() - CACHE_JOURS * 86400000).toISOString();
  const { data } = await supabaseAdmin
    .from("scans")
    .select("id, report_token, status, created_at")
    .eq("domain_key", domaine)
    .eq("mode", mode)
    .gte("created_at", depuis)
    .in("status", ["done", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function quotaAtteint(ipHash: string) {
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", depuis);
  return (count ?? 0) >= PLAFOND_SCANS_PAR_IP;
}

export async function creerScan(input: {
  marque: string;
  url: string | null;
  secteur: string;
  ville: string | null;
  concurrents: string[];
  langue: string;
  ipHash: string;
  previousScanId?: string | null;
  mode?: ModeScan;
  /**
   * Force une mesure neuve, cache ignoré. Réservé à l'outillage interne.
   *
   * Le cas qui l'a rendu nécessaire : un lot de trente et un scans a tourné
   * avec une clé OpenAI dont le projet était archivé. Les mesures étaient
   * fausses, et le cache de trois jours les resservait à chaque tentative de
   * réparation — impossible de remesurer avant leur péremption.
   *
   * Aucun chemin public ne passe ce drapeau : `lancerScan` ne l'expose pas, et
   * le garde-fou de coût continue donc de protéger le site.
   */
  sansCache?: boolean;
}) {
  // L'aperçu est le mode par défaut : c'est le seul exposé au public, et un
  // oubli de paramètre côté front doit coûter 0,15 € et non 1,70 €.
  const mode: ModeScan = input.mode ?? "apercu";
  const domaine = cleDomaine(input.url, input.marque, input.secteur, input.ville);

  // Cache : même domaine, même mode, moins de 3 jours → on renvoie le scan
  // existant, donc le même score ET les mêmes réponses, partout.
  // Trois effets voulus : le chiffre ne bouge pas d'un rechargement à l'autre
  // (la crédibilité de la mesure), les curieux qui rescannent ne coûtent rien,
  // et l'abus est borné. Un re-scan J+90 (previousScanId) court-circuite
  // le cache : c'est une nouvelle mesure par définition.
  if (!input.previousScanId && !input.sansCache) {
    const existant = await chercherCache(domaine, mode);
    if (existant) return { id: existant.id, report_token: existant.report_token, cached: true };
  }

  const { data, error } = await supabaseAdmin
    .from("scans")
    .insert({
      brand_name: input.marque,
      website_url: input.url,
      sector: input.secteur,
      city: input.ville,
      language: input.langue,
      competitors: input.concurrents,
      ip_hash: input.ipHash,
      previous_scan_id: input.previousScanId ?? null,
      mode,
      domain_key: domaine,
      status: "running",
      phase: "init",
      started_at: new Date().toISOString(),
    })
    .select("id, report_token")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, cached: false };
}

/**
 * Audit flash du site : robots.txt et llms.txt, en deux requêtes.
 * La version complète (schema.org, structure) reste l'affaire du toolkit
 * lors de la préparation du diagnostic ; ici on veut UNE trouvaille qui
 * accroche : « votre site bloque GPTBot ».
 */
type AuditFlash = {
  ok: boolean;
  bots: Record<string, "bloque" | "autorise" | "non_mentionne">;
  llmstxt: boolean;
};

export async function auditFlash(siteUrl: string | null): Promise<AuditFlash | null> {
  if (!siteUrl) return null;
  let base: URL;
  try {
    base = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);
  } catch {
    return null;
  }
  const BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];
  const audit: AuditFlash = { ok: false, bots: {}, llmstxt: false };
  try {
    const r = await fetch(new URL("/robots.txt", base), { signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      audit.ok = true;
      const lignes = (await r.text()).split(/\r?\n/);
      // Blocs robots.txt : la section d'un agent nommé prime sur la section
      // « * », et des lignes User-agent CONSÉCUTIVES forment un seul bloc qui
      // partage les directives suivantes.
      //
      // Ce second point a été lu de travers jusqu'au 10/08/2026 : le drapeau
      // de regroupement était inversé, seul le dernier agent du bloc recevait
      // les règles. Sur « User-agent: GPTBot / User-agent: ClaudeBot /
      // Disallow: / » — la forme la plus courante du blocage — GPTBot
      // ressortait « autorisé » alors qu'il est bloqué : l'audit passait à
      // côté de l'argument le plus vérifiable du diagnostic. Le bug a été
      // trouvé par les tests du parseur jumeau de `packages/toolkit`
      // (lib/envoi.ts) ; les deux lectures doivent rester identiques.
      const regles: Record<string, string[]> = {};
      let agents: string[] = [];
      // Vrai quand la dernière ligne lue n'était PAS un User-agent.
      let apresDirectives = true;
      for (const brute of lignes) {
        const ligne = brute.replace(/#.*$/, "").trim();
        if (!ligne) continue;
        // `split` rend toujours au moins un élément, mais le typage strict ne
        // le sait pas : la valeur par défaut le lui dit, sans rien changer au
        // comportement. Signalé la première fois que ce fichier a été typé,
        // le 06/08/2026 — le site n'ayant pas de script de typecheck, personne
        // ne l'avait jamais vérifié.
        const [clef = "", ...reste] = ligne.split(":");
        const valeur = reste.join(":").trim();
        if (clef.trim().toLowerCase() === "user-agent") {
          if (apresDirectives) agents = [];
          apresDirectives = false;
          agents.push(valeur.toLowerCase());
          for (const a of agents) regles[a] ??= [];
        } else {
          apresDirectives = true;
          if (clef.trim().toLowerCase() === "disallow") {
            for (const a of agents) (regles[a] ??= []).push(valeur);
          }
        }
      }
      for (const bot of BOTS) {
        const propres = regles[bot.toLowerCase()];
        const generiques = regles["*"];
        const applicables = propres ?? generiques;
        if (propres === undefined && generiques === undefined) {
          audit.bots[bot] = "non_mentionne";
        } else {
          audit.bots[bot] = applicables?.some((d) => d === "/") ? "bloque" : "autorise";
        }
      }
    }
  } catch {
    /* site injoignable : audit.ok reste false */
  }
  try {
    const r = await fetch(new URL("/llms.txt", base), { signal: AbortSignal.timeout(6000) });
    audit.llmstxt = r.ok;
  } catch {
    /* pas de llms.txt */
  }
  return audit;
}

/**
 * Étape 2 : génération (ou recopie à l'identique pour un re-scan) de l'échantillon.
 *
 * @returns `pretes` si l'échantillon existait déjà et qu'on peut enchaîner,
 * `generees` si on vient de le produire, `occupe` si un autre sondage s'en
 * charge. Les deux derniers cas rendent la main.
 *
 * Deux navigateurs peuvent entrer ici en même temps, et ce n'est pas un cas
 * tordu : le cache renvoie volontairement un scan EN COURS à un second
 * visiteur du même domaine, qui se met alors à sonder le même scan. Sans
 * verrou, les deux voyaient zéro question, appelaient tous deux le générateur
 * et inséraient chacun leur échantillon. La table `queries` n'a pas de
 * contrainte d'unicité sur (scan_id, rank) : rien ne l'aurait empêché. Le scan
 * se retrouvait avec 40 questions au lieu de 20, donc le double d'appels
 * facturés, une progression fausse et un rapport qui se répète.
 *
 * Le verrou est la transition de phase elle-même : `init` → `questions` en une
 * seule écriture conditionnelle, que Postgres sérialise. Le perdant repart et
 * retentera au sondage suivant, 1,5 seconde plus tard.
 */
type EtatQuestions = "pretes" | "generees" | "occupe";

async function preparerQuestions(scan: ScanRow): Promise<EtatQuestions> {
  const { count } = await supabaseAdmin
    .from("queries")
    .select("id", { count: "exact", head: true })
    .eq("scan_id", scan.id);
  if ((count ?? 0) > 0) return "pretes";

  // Le verrou se reprend au bout de deux minutes.
  //
  // Sans cette échappatoire, un processus tué net entre la prise du verrou et
  // l'écriture des questions laisserait le scan en phase « questions » pour
  // toujours : plus personne ne pourrait le réclamer, et comme le cache
  // resssert les scans « running », tous les visiteurs de ce domaine
  // hériteraient du scan mort pendant trois jours. La génération dure une
  // dizaine de secondes, deux minutes ne peuvent donc pas voler le verrou à un
  // sondage réellement en cours.
  const perime = new Date(Date.now() - 120_000).toISOString();
  const { data: obtenu } = await supabaseAdmin
    .from("scans")
    .update({ phase: "questions", updated_at: new Date().toISOString() })
    .eq("id", scan.id)
    .or(`phase.eq.init,and(phase.eq.questions,updated_at.lt.${perime})`)
    .select("id")
    .maybeSingle();
  if (!obtenu) return "occupe";

  let lignes: { text: string; intent: string }[] = [];
  if (scan.previous_scan_id) {
    // Re-scan J+90 : on rejoue exactement les mêmes questions.
    const { data } = await supabaseAdmin
      .from("queries")
      .select("text, intent, rank")
      .eq("scan_id", scan.previous_scan_id)
      .order("rank");
    lignes = (data ?? []).map((q) => ({ text: q.text, intent: q.intent }));
  }
  if (!lignes.length) {
    // « On lit votre site » : la page d'accueil est lue AVANT d'écrire les
    // questions, pour partir du métier réel et non du seul libellé de
    // secteur — « Autre » avait fait générer des questions SIRH à un site
    // de poker (scan Unibet du 14/08/2026, score 0 artefactuel).
    const matiere = await matiereDuSite(scan.website_url);

    // Le formulaire ne demande plus le métier ni la ville (14/08/2026) : on
    // les déduit du site et on les ÉCRIT en base, parce que tout l'aval s'en
    // sert — question miroir, classement des concurrents, corrections
    // humaines par secteur, vocabulaire du rapport. Un secteur déjà rempli
    // (scan par lot du toolkit, re-scan) n'est jamais écrasé.
    let secteur = scan.sector ?? "";
    let ville = scan.city as string | null;
    // Même sans matière : un site bloqué (leboncoin.fr répond 403 aux robots)
    // ne doit pas priver tout l'aval de contexte quand la marque est connue.
    if (!secteur.trim()) {
      const deduit = await deduireMetier(scan.brand_name, matiere);
      if (deduit.secteur) {
        secteur = deduit.secteur;
        ville = ville ?? deduit.ville;
        await supabaseAdmin
          .from("scans")
          .update({ sector: secteur, city: ville })
          .eq("id", scan.id);
      }
    }

    lignes = await genererQuestions({
      marque: scan.brand_name,
      secteur,
      ville,
      langue: scan.language,
      nombre: scan.mode === "apercu" ? 20 : 24,
      matiereSite: matiere,
    });
  }
  if (!lignes.length) throw new Error("Échantillon de questions vide");

  await supabaseAdmin
    .from("queries")
    .insert(lignes.map((q, i) => ({ scan_id: scan.id, rank: i + 1, text: q.text, intent: q.intent })));

  // Audit flash + question miroir, une seule fois, en parallèle de la mise en
  // place. Aperçu : miroir sur ChatGPT seul (une accroche). Complet : les six.
  // Contrôle J+45 : ni audit ni miroir, c'est de la télémétrie interne.
  if (scan.mode === "controle") return "generees";
  const moteursMiroir = scan.mode === "apercu" ? (["ChatGPT"] as const) : MOTEURS;
  const [audit, miroirs] = await Promise.all([
    auditFlash(scan.website_url),
    Promise.all(
      moteursMiroir.map((m) => questionMiroir(scan.brand_name, scan.sector, scan.city, m))
    ),
  ]);
  await supabaseAdmin
    .from("scans")
    .update({ audit, miroir: miroirs.filter((m) => !m.erreur && m.texte) })
    .eq("id", scan.id);
  return "generees";
}

type ScanRow = {
  id: string;
  brand_name: string;
  sector: string;
  city: string | null;
  language: string;
  competitors: string[];
  previous_scan_id: string | null;
  status: string;
  mode: ModeScan;
  website_url: string | null;
};

/** Ce que lit un visiteur quand la mesure a échoué. Neutre, et actionnable. */
const MESSAGE_ECHEC_PUBLIC =
  "La mesure s’est interrompue avant la fin. Relancez-la : les réponses déjà collectées sont conservées, " +
  "et rien ne vous est facturé. Si cela se reproduit, écrivez-nous et nous la relançons nous-mêmes.";

export async function etatScan(id: string) {
  const { data: scan } = await supabaseAdmin
    .from("scans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!scan) return null;
  const [{ data: questions }, { data: cellules }, { data: cout }] = await Promise.all([
    supabaseAdmin.from("queries").select("id, rank, text, intent").eq("scan_id", id).order("rank"),
    // L'écran d'attente dessine une grille question × moteur : il lui faut la
    // paire de chaque réponse écrite, pas seulement leur nombre. Ces lignes
    // sont minuscules (deux identifiants et une latence) et plafonnent à 144.
    // Le texte des réponses, lui, ne quitte pas le serveur avant le rapport.
    supabaseAdmin
      .from("responses")
      .select("query_id, engine, latency_ms, error, created_at")
      .eq("scan_id", id),
    supabaseAdmin.from("cost_log").select("cost_eur").eq("scan_id", id),
  ]);
  const moteurs = moteursDuMode((scan.mode as ModeScan) ?? "complet");
  const total = (questions?.length ?? 0) * moteurs.length;
  const collectees = cellules?.length ?? 0;
  return {
    id: scan.id,
    status: scan.status,
    phase: scan.phase,
    // Le message technique reste en base pour nous ; le visiteur ne doit jamais
    // lire « api.anthropic.com → HTTP 529 ». Cela fuiterait notre tuyauterie et
    // donnerait l'impression d'un produit cassé là où la bonne conduite à tenir
    // est simplement de réessayer.
    error: scan.error_message ? MESSAGE_ECHEC_PUBLIC : null,
    brand: scan.brand_name,
    domaine: scan.website_url as string | null,
    // Déduits du site pendant la phase « questions » : l'écran d'attente les
    // affiche pour prouver que la lecture a bien eu lieu.
    secteur: (scan.sector ?? null) as string | null,
    ville: (scan.city ?? null) as string | null,
    demarreA: (scan.started_at ?? scan.created_at) as string | null,
    reportToken: scan.report_token,
    questions: questions ?? [],
    // Les moteurs réellement interrogés, et ceux que l'aperçu laisse de côté.
    // Les montrer verrouillés est le mécanisme de conversion vers le
    // diagnostic complet, pas un défaut d'affichage. Uniquement en aperçu : le
    // mode contrôle est interne, personne n'a rien à y débloquer.
    moteurs: [...moteurs] as string[],
    verrouilles:
      scan.mode === "apercu" ? (MOTEURS.filter((m) => !moteurs.includes(m)) as string[]) : [],
    cellules: (cellules ?? []).map((c) => ({
      queryId: c.query_id as string,
      moteur: c.engine as string,
      latence: (c.latency_ms ?? null) as number | null,
      erreur: Boolean(c.error),
      // L'écran d'attente marque « actif » un moteur qui a répondu dans les
      // dernières secondes : il lui faut l'instant d'écriture, pas juste le fait.
      creeA: c.created_at as string,
    })),
    collectees,
    total,
    progression: total ? Math.min(99, Math.round((collectees / total) * 96) + 2) : 2,
    cout: (cout ?? []).reduce((a, c) => a + Number(c.cost_eur ?? 0), 0),
  };
}

export type EtatScan = NonNullable<Awaited<ReturnType<typeof etatScan>>>;

/** Traite un lot de paires (question × moteur). Appelé à chaque interrogation du client. */
export async function avancerScan(id: string) {
  const { data: scan } = await supabaseAdmin.from("scans").select("*").eq("id", id).maybeSingle();
  if (!scan) return;

  // Un scan en erreur REPREND quand on le sonde à nouveau.
  //
  // Le message d'échec promet « relancez-la : les réponses déjà collectées
  // sont conservées », et le bouton « Reprendre » recharge la page. Or cette
  // fonction ignorait tout scan qui n'était pas « running » : la relance
  // promise était impossible, le bouton ne faisait rien, et le prospect
  // repartait sur un scan neuf, payé une seconde fois. On honore la promesse :
  // le statut repasse à « running » et la collecte continue là où elle s'est
  // arrêtée. L'écriture est conditionnelle pour que deux sondages simultanés
  // ne reprennent pas deux fois, et la reprise s'interdit au-delà de la
  // fenêtre de cache : au-delà, la mesure serait un patchwork de deux époques.
  if (scan.status === "error") {
    const age = Date.now() - new Date(scan.created_at as string).getTime();
    if (age > CACHE_JOURS * 86400000) return;
    const { data: repris } = await supabaseAdmin
      .from("scans")
      .update({ status: "running", error_message: null })
      .eq("id", id)
      .eq("status", "error")
      .select("id")
      .maybeSingle();
    if (!repris) return;
    scan.status = "running";
  }
  if (scan.status !== "running") return;

  try {
    // On ne génère PAS l'échantillon et n'interroge PAS les moteurs dans le
    // même appel.
    //
    // La génération dure une quinzaine de secondes. Enchaîner l'interrogation
    // derrière portait la requête à plus de vingt secondes, au-delà de ce que
    // le navigateur accepte d'attendre : il la coupait et relançait un sondage
    // pendant que le serveur, lui, continuait tranquillement son lot. Deux
    // `avancerScan` se retrouvaient en vol, chacun interrogeant les mêmes
    // paires, puisque ni l'un ni l'autre n'avait encore écrit ses réponses.
    // Mesuré sur un scan aperçu : 60 appels facturés pour 40 réponses.
    //
    // En rendant la main tout de suite après la génération, chaque requête
    // reste courte et le sondage suivant, 1,5 seconde plus tard, trouve
    // l'échantillon en place.
    const questionsPretes = await preparerQuestions(scan as ScanRow);
    if (questionsPretes !== "pretes") return;

    const { data: questions } = await supabaseAdmin
      .from("queries")
      .select("id, text")
      .eq("scan_id", id)
      .order("rank");
    const { data: faites } = await supabaseAdmin
      .from("responses")
      .select("query_id, engine")
      .eq("scan_id", id);

    const moteurs = moteursDuMode((scan.mode as ModeScan) ?? "complet");
    const lot = lotDuMode((scan.mode as ModeScan) ?? "complet");
    const deja = new Set((faites ?? []).map((r) => `${r.query_id}|${r.engine}`));
    const restant: { queryId: string; text: string; engine: string }[] = [];
    for (const q of questions ?? []) {
      for (const moteur of moteurs) {
        if (!deja.has(`${q.id}|${moteur}`)) restant.push({ queryId: q.id, text: q.text, engine: moteur });
      }
    }

    if (!restant.length) {
      await finaliser(id);
      return;
    }

    // `progress` est aussi calculé à la volée par etatScan pour l'affichage.
    // On le persiste quand même : sans lui, un scan abandonné en cours de route
    // est indistinguable en base d'un scan jamais démarré, et il faut recompter
    // les réponses à la main pour savoir où il s'est arrêté.
    const totalPaires = (questions?.length ?? 0) * moteurs.length;
    await supabaseAdmin
      .from("scans")
      .update({
        phase: "interrogation",
        progress: totalPaires ? Math.round((deja.size / totalPaires) * 100) : 0,
      })
      .eq("id", id);

    const coutCumule = (
      await supabaseAdmin.from("cost_log").select("cost_eur").eq("scan_id", id)
    ).data?.reduce((a, c) => a + Number(c.cost_eur ?? 0), 0);
    if ((coutCumule ?? 0) > PLAFONDS_EUR[(scan.mode as ModeScan) ?? "complet"]) {
      await finaliser(id);
      return;
    }

    await Promise.all(
      restant.slice(0, lot).map(async (item) => {
        const rep = await interroger(item.engine as Moteur, item.text, scan.language, {
          recherche: scan.mode !== "apercu",
        });
        const { data: inserted } = await supabaseAdmin
          .from("responses")
          .upsert(
            {
              scan_id: id,
              query_id: item.queryId,
              engine: item.engine,
              raw_text: rep.text,
              sources: rep.sources,
              latency_ms: rep.latency,
              cost_eur: rep.cost,
              error: rep.error ?? null,
            },
            { onConflict: "scan_id,query_id,engine", ignoreDuplicates: true },
          )
          .select("id")
          .maybeSingle();

        // Le coût se journalise même quand la réponse est un doublon : l'appel
        // au moteur a eu lieu juste au-dessus, il est facturé par l'éditeur que
        // la ligne soit conservée ou non. L'omettre revenait à sous-évaluer la
        // dépense réelle, donc à laisser le plafond raisonner sur un chiffre
        // faux — le fusible se serait déclenché trop tard.
        await supabaseAdmin
          .from("cost_log")
          .insert({ scan_id: id, engine: item.engine, cost_eur: rep.cost });

        // Doublon : la réponse existe déjà, ne pas la ré-analyser.
        if (!inserted) return;
        if (rep.error || !rep.text) return;


        const analyse = await analyser(rep.text, scan.brand_name);
        if (analyse.brands.length) {
          await supabaseAdmin.from("mentions").insert(
            analyse.brands.map((b) => ({
              scan_id: id,
              response_id: inserted.id,
              query_id: item.queryId,
              engine: item.engine,
              brand: b.name,
              is_target: memeMarque(b.name, scan.brand_name),
              position: b.position ?? null,
              recommended: !!b.recommended,
              sentiment: b.sentiment ?? "neutre",
              verbatim: b.verbatim ?? null,
            })),
          );
        }
      }),
    );

    if (restant.length <= lot) await finaliser(id);
  } catch (e) {
    await supabaseAdmin
      .from("scans")
      .update({ status: "error", error_message: e instanceof Error ? e.message : "Erreur" })
      .eq("id", id);
  }
}

/**
 * Score d'un scan recalculé sur un sous-ensemble de moteurs.
 *
 * Un score global n'est comparable qu'à un score établi sur les mêmes moteurs.
 * Le diagnostic complet en interroge six, le contrôle J+45 seulement les quatre
 * qui lisent le web : opposer les deux notes telles quelles produit un écart
 * artéfactuel, du genre qu'on annoncerait à un client comme une progression
 * alors que rien n'a bougé. On repasse donc par `calculerScore`, la seule
 * implémentation du score, en ne lui donnant que les moteurs voulus.
 */
/**
 * Les réponses réellement mesurées : ni erreur, ni texte vide.
 *
 * Le score divise les citations par le NOMBRE DE RÉPONSES. Une réponse qu'un
 * moteur n'a jamais rendue n'est pas une mesure : c'est une panne de notre
 * côté. La compter au dénominateur revient à baisser la note du client parce
 * que notre clé API est à court de crédit, ce qui est arrivé pour de vrai —
 * les 24 réponses de Claude en erreur sur le scan complet de Dougs, noté 21
 * au lieu de 25 environ.
 *
 * Plus grave que les quelques points : le contrôle J+90. Si un moteur tombe
 * entre la mesure d'avant et celle d'après, le score bouge tout seul, et on
 * annonce au client une progression ou une chute qu'il n'a pas vécue. C'est la
 * promesse centrale du sprint qui s'effondre.
 *
 * Une question à laquelle un moteur EN MARCHE répond sans citer la marque
 * reste évidemment comptée : c'est un vrai manque, et c'est ce qu'on vend.
 */
function mesurees<T extends { error?: string | null; raw_text?: string | null }>(lignes: T[]): T[] {
  return lignes.filter((r) => !r.error && (r.raw_text ?? "").trim().length > 0);
}

export async function scoreSurMoteurs(scanId: string, moteurs: readonly string[]): Promise<number | null> {
  const [{ data: reponses }, { data: mentions }] = await Promise.all([
    supabaseAdmin.from("responses").select("id, engine, error, raw_text").eq("scan_id", scanId),
    supabaseAdmin.from("mentions").select("*").eq("scan_id", scanId),
  ]);
  const garder = new Set(moteurs);
  const r = mesurees(reponses ?? []).filter((x) => garder.has(x.engine));
  if (r.length === 0) return null;
  const m = ((mentions ?? []) as unknown as LigneMention[]).filter((x) => garder.has(x.engine));
  return calculerScore(r, m).global;
}

async function finaliser(id: string) {
  // Même verrou que pour les questions, et pour la même raison : deux sondages
  // simultanés voient tous deux la dernière paire traitée et appellent
  // `finaliser`. L'analyse n'est pas gratuite, elle appelle le modèle deux fois
  // (classement des concurrents, puis actions) : la faire deux fois, c'est
  // payer deux fois pour écrire le même résultat.
  //
  // `phase.neq.analyse` couvre le cas où les deux sondages arrivent pendant
  // que le premier analyse encore, `eq("status", "running")` celui où le scan
  // est déjà terminé.
  //
  // Et comme pour le verrou des questions, celui-ci se reprend, au bout de
  // cinq minutes. Sans échappatoire, un processus tué net pendant l'analyse
  // (chose banale sur un worker, qui peut être arrêté à tout moment) laissait
  // le scan « running »/« analyse » pour toujours : chaque sondage suivant
  // voyait zéro paire restante, appelait finaliser, se heurtait au verrou et
  // repartait. Le cache resservait ce scan mort à tous les visiteurs du
  // domaine pendant trois jours. L'analyse réelle dure moins d'une minute,
  // cinq minutes ne peuvent donc rien voler à une analyse en cours ; le
  // trigger touch_updated_at fait office de battement de cœur.
  const perimeAnalyse = new Date(Date.now() - 300_000).toISOString();
  const { data: obtenu } = await supabaseAdmin
    .from("scans")
    .update({ phase: "analyse" })
    .eq("id", id)
    .eq("status", "running")
    .or(`phase.neq.analyse,updated_at.lt.${perimeAnalyse}`)
    .select("id")
    .maybeSingle();
  if (!obtenu) return;

  const [{ data: reponses }, { data: mentions }, { data: scan }] = await Promise.all([
    supabaseAdmin.from("responses").select("id, engine, error, raw_text").eq("scan_id", id),
    supabaseAdmin.from("mentions").select("*").eq("scan_id", id),
    supabaseAdmin.from("scans").select("brand_name, sector, city, competitors").eq("id", id).single(),
  ]);
  const lignes = (mentions ?? []) as unknown as LigneMention[];
  const s = calculerScore(mesurees(reponses ?? []), lignes);
  // Les variantes d'écriture se regroupent AVANT tout comptage : « Amarris »
  // et « Amarris Direct » sont une seule entreprise, et la compter deux fois
  // fausserait la part de voix comme la priorisation des contenus.
  const alias = regrouperMarques(lignes);
  const pdv = partDeVoix(lignes, alias);

  // Classement des concurrents, du point de vue de CE client.
  //
  // On ne classe que les plus cités : ils portent l'essentiel du comptage, et
  // la longue traîne reste « rival » par défaut, ce qui est prudent. Un scan
  // relève parfois 500 marques distinctes, les envoyer toutes coûterait cher
  // pour classer des noms vus une seule fois.
  const nomRetenu = (b: string) => alias[b] ?? b;
  const lesPlusCites = [...new Set(lignes.filter((m) => !m.is_target).map((m) => nomRetenu(m.brand)))]
    .map((nom) => ({ nom, n: lignes.filter((m) => nomRetenu(m.brand) === nom).length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 40)
    .map((x) => x.nom);
  const classes = await classerConcurrents(
    { marque: scan?.brand_name ?? "", secteur: scan?.sector ?? "", ville: scan?.city },
    lesPlusCites,
  );

  // Les corrections humaines écrasent le modèle, toujours.
  //
  // Le classement automatique devine bien mais il devine, et personne ne veut
  // reprendre la même correction à chaque scan. Une fois qu'un humain a
  // tranché sur une entreprise, sa décision s'applique et le modèle ne peut
  // plus la contredire. C'est ce qui rend le classement fiable à la longue :
  // il s'améliore avec l'usage au lieu de rejouer les mêmes approximations.
  const { data: corrections } = await supabaseAdmin
    .from("brand_overrides")
    .select("brand_key, classe, sector");
  for (const nom of lesPlusCites) {
    const cle = normaliserNom(nom).replace(/ /g, "");
    const c = (corrections ?? []).find(
      (o) => o.brand_key === cle && (o.sector === "" || o.sector === scan?.sector),
    );
    if (c) classes[nom] = c.classe as typeof classes[string];
  }
  for (const item of pdv) {
    if (!item.target) item.classe = classes[item.name] ?? "rival";
  }

  // Les concurrents que le prospect a nommés lui-même, rapprochés de ce que
  // les moteurs ont cité. Ce sont les seuls noms qu'il a choisis : « Fiducial,
  // que vous nous avez cité, apparaît 42 fois, vous 25 » porte bien plus qu'un
  // classement anonyme.
  //
  // Le rapprochement se fait ICI, après l'extraction, et jamais en soufflant
  // les noms à l'extracteur : ce serait l'inciter à les trouver, donc fausser
  // la mesure que nous vendons.
  const saisis = Array.isArray(scan?.competitors) ? (scan.competitors as string[]) : [];
  const comptesParNom = new Map<string, number>();
  for (const m of lignes) {
    if (m.is_target) continue;
    const nom = nomRetenu(m.brand);
    comptesParNom.set(nom, (comptesParNom.get(nom) ?? 0) + 1);
  }
  const suivis = saisis.filter(Boolean).map((saisi) => {
    const releve = [...comptesParNom.keys()].find((nom) => memeMarque(nom, saisi)) ?? null;
    return { saisi, releve, citations: releve ? (comptesParNom.get(releve) ?? 0) : 0 };
  });

  const actions = await genererActions(scan?.brand_name ?? "", scan?.sector ?? "", s.global, pdv);

  await supabaseAdmin
    .from("scans")
    .update({
      status: "done",
      phase: "termine",
      progress: 100,
      completed_at: new Date().toISOString(),
      score_global: s.global,
      score_chatgpt: s.parMoteur["ChatGPT"],
      score_claude: s.parMoteur["Claude"],
      score_gemini: s.parMoteur["Gemini"],
      score_perplexity: s.parMoteur["Perplexity"],
      score_grok: s.parMoteur["Grok"],
      score_mistral: s.parMoteur["Le Chat"],
      mention_rate: s.mentionRate,
      avg_position: s.avgPosition,
      reco_rate: s.recoRate,
      sentiment_score: s.sentiment,
      share_of_voice: pdv,
      brand_aliases: alias as unknown as never,
      concurrents_suivis: suivis as unknown as never,
      concurrent_classes: classes as unknown as never,
      actions: actions as unknown as never,
    })
    .eq("id", id);

  // La priorité commerciale ne peut être posée qu'ici : l'email est saisi au
  // lancement, quand le score n'existe pas encore. Sans cette reprise, tout le
  // pipeline resterait classé « chaud » et le tri ne servirait plus à rien.
  await supabaseAdmin
    .from("leads")
    .update({ priority: prioriteDuScore(s.global) })
    .eq("scan_id", id);
}

async function genererActions(
  marque: string,
  secteur: string,
  score: number,
  pdv: { name: string; share: number }[],
): Promise<Action[]> {
  if (!process.env.GOOGLE_AI_API_KEY) return [];
  try {
    const { genererActionsIA } = await import("@/lib/moteurs.server");
    return await genererActionsIA(marque, secteur, score, pdv);
  } catch {
    return [];
  }
}

/** Rapport complet, accessible par jeton signé, sans compte. */
export async function rapportParJeton(jeton: string) {
  const { data: scan } = await supabaseAdmin
    .from("scans")
    .select("*")
    .eq("report_token", jeton)
    .maybeSingle();
  if (!scan) return null;

  const [{ data: questions }, { data: reponses }, { data: mentions }] = await Promise.all([
    supabaseAdmin.from("queries").select("*").eq("scan_id", scan.id).order("rank"),
    // Colonnes explicites : `cost_eur` et `latency_ms` restent sur le serveur.
    // Le jeton se partage (c'est fait pour), et la charge utile partait
    // entière : n'importe qui pouvait y lire, réponse par réponse, ce que la
    // mesure nous coûte. Le rapport n'affiche rien de tout ça.
    supabaseAdmin
      .from("responses")
      .select("id, query_id, engine, raw_text, sources, error")
      .eq("scan_id", scan.id),
    supabaseAdmin.from("mentions").select("*").eq("scan_id", scan.id),
  ]);

  let precedent: {
    score: number;
    date: string;
    pdv: PdvItem[];
    parMoteur: Record<string, number | null>;
  } | null = null;
  if (scan.previous_scan_id) {
    const { data: prev } = await supabaseAdmin
      .from("scans")
      .select("score_global, completed_at, share_of_voice, score_chatgpt, score_claude, score_gemini, score_perplexity, score_grok, score_mistral")
      .eq("id", scan.previous_scan_id)
      .maybeSingle();
    if (prev)
      precedent = {
        score: Number(prev.score_global ?? 0),
        date: prev.completed_at ?? "",
        pdv: (prev.share_of_voice ?? []) as unknown as PdvItem[],
        parMoteur: {
          ChatGPT: prev.score_chatgpt as number | null,
          Claude: prev.score_claude as number | null,
          Gemini: prev.score_gemini as number | null,
          Perplexity: prev.score_perplexity as number | null,
          Grok: prev.score_grok as number | null,
          "Le Chat": prev.score_mistral as number | null,
        },
      };
  }

  // Même hygiène pour la ligne du scan : le hachage d'IP n'a rien à faire chez
  // le prospect, la clé de cache non plus, et le message d'erreur technique
  // encore moins. C'est la règle déjà appliquée à l'écran d'attente : le
  // détail des pannes reste en base, pour nous. Le rapport, lui, ne teste que
  // la présence d'une erreur par réponse, jamais son texte.
  const { ip_hash: _ip, error_message: _err, domain_key: _dk, ...scanPublic } = scan;
  const reponsesPubliques = (reponses ?? []).map((r) => ({
    ...r,
    error: r.error ? "indisponible" : null,
  }));

  return { scan: scanPublic, questions: questions ?? [], reponses: reponsesPubliques, mentions: mentions ?? [], precedent };
}

/**
 * La visio : le rapport, plus l'APERÇU du même domaine s'il existe.
 *
 * L'écart aperçu → complet (mémoire seule → web ouvert) est l'ouverture de
 * la présentation : « l'aperçu disait 24, connectés au web les moteurs
 * disent 13 ». On le cherche par `domain_key`, avant que `rapportParJeton`
 * ne l'ait retiré de la charge publique, et on ne renvoie que deux champs.
 */
export async function visioParJeton(jeton: string) {
  const base = await rapportParJeton(jeton);
  if (!base) return null;

  let apercu: { score: number; date: string } | null = null;
  const { data: brut } = await supabaseAdmin
    .from("scans")
    .select("domain_key, completed_at")
    .eq("report_token", jeton)
    .maybeSingle();
  if (brut?.domain_key) {
    const { data: prev } = await supabaseAdmin
      .from("scans")
      .select("score_global, completed_at")
      .eq("mode", "apercu")
      .eq("status", "done")
      .eq("domain_key", brut.domain_key)
      .lt("completed_at", brut.completed_at ?? "9999-12-31")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prev?.completed_at && prev.score_global !== null) {
      apercu = { score: Math.round(Number(prev.score_global)), date: prev.completed_at };
    }
  }

  // L'analyse complémentaire : identité perçue et arguments du rival,
  // extraites des réponses stockées, en cache après le premier calcul.
  const { analyseComplementaire } = await import("@/lib/analyse.server");
  const scanBase = base.scan as {
    id: string;
    brand_name: string;
    miroir: unknown;
    concurrent_classes: unknown;
    brand_aliases: unknown;
    analyse_ia: unknown;
  };
  const analyse = await analyseComplementaire({
    scanId: scanBase.id,
    marque: scanBase.brand_name,
    miroir: scanBase.miroir,
    mentions: base.mentions as never[],
    reponsesRetenues: base.reponses.filter((r) => !r.error && r.raw_text).length,
    classes: (scanBase.concurrent_classes ?? {}) as Record<string, string>,
    alias: (scanBase.brand_aliases ?? {}) as Record<string, string>,
    cacheExistant: scanBase.analyse_ia ?? null,
  });

  return { ...base, apercu, analyse };
}

/** Priorité commerciale déduite du score : plus il est bas, plus le besoin est fort. */
export function prioriteDuScore(score: number): "chaud" | "tiede" | "froid" {
  return score < 25 ? "chaud" : score < 55 ? "tiede" : "froid";
}

/**
 * Enregistre l'adresse saisie au lancement d'un scan.
 *
 * C'est la contrepartie du scan gratuit : sans email, un visiteur consulte son
 * score puis disparaît. Le lead porte le scan, donc ses données réelles, ce qui
 * permet aux relances de citer ses vrais chiffres plutôt qu'un gabarit.
 *
 * La priorité n'est PAS calculée ici : à la saisie, le scan vient d'être créé
 * et n'a pas encore de score. La déduire de zéro classerait tout le monde
 * « chaud » et rendrait le tri du pipeline inutile. C'est `finaliser` qui la
 * pose, une fois le score connu.
 *
 * Idempotent et tolérant aux échecs : relancer le même scan avec la même
 * adresse ne crée pas de doublon, et une erreur d'écriture n'empêche jamais le
 * scan de démarrer. Perdre un email est ennuyeux ; perdre le prospect parce que
 * la page a planté l'est davantage.
 */
export async function enregistrerLead(input: {
  scanId: string;
  email: string;
  prenom?: string | null;
  telephone?: string | null;
}) {
  const { data: scan } = await supabaseAdmin
    .from("scans")
    .select("id, brand_name, report_token, score_global")
    .eq("id", input.scanId)
    .maybeSingle();
  if (!scan) throw new Error("Scan introuvable");

  const score = Number(scan.score_global ?? 0);

  // `ilike` sert uniquement à ignorer la casse, mais il interprète `%` et `_`,
  // deux caractères parfaitement légaux dans un email. Sans échappement,
  // « a_b@x.fr » retrouvait le lead de « acb@x.fr » et l'adresse réelle
  // n'était jamais enregistrée.
  const emailLitteral = input.email.replace(/([%_\\])/g, "\\$1");
  const { data: deja } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("scan_id", scan.id)
    .ilike("email", emailLitteral)
    .maybeSingle();
  if (deja) return { reportToken: scan.report_token };

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .insert({
      scan_id: scan.id,
      email: input.email,
      first_name: input.prenom ?? null,
      phone: input.telephone ?? null,
      company: scan.brand_name,
      // Horodatage du consentement : la preuve exigée par le RGPD vaut à
      // l'instant de la saisie.
      consent_at: new Date().toISOString(),
      ...(scan.score_global === null ? {} : { priority: prioriteDuScore(score) }),
    })
    .select("id")
    .single();

  // Aucune relance n'est écrite ici, volontairement.
  //
  // Trois messages génériques étaient créés à cet endroit, au moment même où le
  // lead naît. Depuis que l'email est saisi au lancement du scan, cela se
  // produit AVANT que le score existe : les textes ne pouvaient donc contenir
  // aucun chiffre réel. Pire, ils occupaient les étapes 1 à 3, et la commande
  // `relance` du toolkit, qui rédige les vrais messages à partir des données du
  // scan, refuse d'écraser une relance existante. La mauvaise version gagnait
  // systématiquement, et elle n'avait même pas de mention de désinscription.
  //
  // Les emails sont désormais préparés par `pnpm toolkit relance`, une fois le
  // scan terminé et le score connu.
  void lead;

  return { reportToken: scan.report_token };
}
