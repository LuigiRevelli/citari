import { getDb, unwrap } from "@geo/core";

/**
 * Transforme un scan en munitions commerciales : les faits précis qui rendent
 * une relance ou une proposition crédibles. Tout est extrait de la base —
 * aucun chiffre n'est inventé, ce qui est impératif dans un email de prospection.
 *
 * Le schéma est celui du front Citari. Deux pièges qu'il faut garder en tête :
 *
 *  1. `responses.engine` et `mentions.engine` stockent les LIBELLÉS des moteurs
 *     (« ChatGPT », « Claude »…), pas des identifiants techniques.
 *  2. Une ligne de `mentions` EST une mention. Il n'existe pas de colonne
 *     `mentioned` : l'absence de ligne vaut absence de citation. La marque
 *     suivie s'identifie par `is_target`, jamais par comparaison de chaînes.
 */

/** Libellés tels que stockés en base, et colonne de score correspondante. */
const ENGINE_SCORE_COLUMN = {
  ChatGPT: "score_chatgpt",
  Claude: "score_claude",
  Gemini: "score_gemini",
  Perplexity: "score_perplexity",
  Grok: "score_grok",
  // « Le Chat » et non « Mistral » : on nomme l'assistant que le public
  // utilise, comme pour les autres moteurs. La colonne garde le nom de
  // l'éditeur, plus stable qu'un nom de produit.
  "Le Chat": "score_mistral",
} as const;

type EngineLabel = keyof typeof ENGINE_SCORE_COLUMN;

export interface EngineScore {
  engine: EngineLabel;
  label: EngineLabel;
  score: number;
}

export interface ScanInsights {
  brand: string;
  url: string | null;
  sector: string | null;
  score: number;
  scoreLabel: string;
  /**
   * Le mode du scan. L'email en a besoin pour ne pas mentir sur ce qu'il
   * envoie : un aperçu (20 questions, 2 moteurs) n'est pas un rapport complet,
   * et l'annoncer comme tel se voit à la première ouverture du lien.
   */
  mode: string;
  reportUrl: string | null;
  competitors: string[];
  /** Concurrent le plus cité, sa part de voix, et les réponses où il apparaît. */
  topCompetitor: { name: string; share: number; count: number; reponses: number } | null;
  /** Réponses valides obtenues, et celles où la marque apparaît : l'unité du rapport. */
  reponsesTotal: number;
  reponsesAvecMarque: number;
  brandShare: number;
  /**
   * Nombre brut de citations, marque contre concurrents.
   *
   * Les pourcentages font réfléchir, les nombres bruts font mal : « cité 19
   * fois contre 253 » se comprend sans calcul et se retient. C'est la phrase
   * qui ouvre les emails de prospection.
   */
  citationsCible: number;
  citationsConcurrents: number;
  /**
   * Citations des seuls concurrents comparables, géants et outils exclus.
   *
   * C'est ce chiffre qu'il faut annoncer. Dire à un cabinet de quinze personnes
   * que ses concurrents sont cités 707 fois est exact et décourageant quand la
   * moitié sont des Big Four : ça écrase au lieu d'indiquer une action.
   */
  citationsRivaux: number;
  /** Robots d'IA explicitement bloqués par le robots.txt du site. */
  botsBloques: string[];
  /** Vrai si l'audit a pu lire le robots.txt : sans lui, ne rien affirmer. */
  auditFait: boolean;
  llmstxtAbsent: boolean;
  /** Moteur où la marque est la plus faible (angle d'attaque). */
  weakestEngine: EngineScore | null;
  bestEngine: EngineScore | null;
  /** Requêtes d'achat où la marque est totalement absente. */
  missedQueries: string[];
  missedCount: number;
  totalQueries: number;
  /** Domaines cités par Perplexity dans les réponses où un concurrent apparaît. */
  competitorSources: string[];
  /**
   * Vrai quand aucune réponse ne porte de sources exploitables. Le chantier
   * « citations » doit alors s'appuyer sur l'annuaire sectoriel plutôt que sur
   * les sources observées — et la proposition ne doit pas promettre le contraire.
   */
  sourcesUnavailable: boolean;
  /**
   * Les concurrents que le prospect a nommés lui-même dans le formulaire,
   * rapprochés de ce que les moteurs ont cité.
   *
   * Ce sont les seuls noms qu'il a choisis : « Fiducial, que vous nous avez
   * cité, apparaît 42 fois, vous 25 » porte bien plus qu'un classement
   * anonyme. Un concurrent à zéro citation est une information utile aussi :
   * celui qu'il redoute n'est peut-être pas cité non plus.
   */
  concurrentsSuivis: { saisi: string; releve: string | null; citations: number }[];
  /** Verbatim où un concurrent est cité et pas la marque. */
  killerQuote: { query: string; engine: string; excerpt: string; competitor: string } | null;
  /**
   * La question miroir : ce que ChatGPT répond quand on lui demande de
   * présenter l'entreprise elle-même. Hors méthodologie de mesure, mais c'est
   * la pièce la plus personnelle du scan : sa fiche d'identité dans les IA,
   * avec ses informations datées ou inventées. Null si non posée ou en échec.
   */
  miroir: { moteur: string; extrait: string } | null;
  /**
   * Ventilation par intention, comptée en RÉPONSES et non en questions.
   *
   * C'est l'unité du rapport : « vous apparaissez dans 13 réponses sur 40 ».
   * Un email qui compterait en questions à côté d'un rapport qui compte en
   * réponses donnerait deux nombres justes qui se contredisent à l'écran,
   * exactement le défaut corrigé sur la page de rapport le 09/08/2026.
   * Ne compte que les réponses réellement obtenues, comme le score.
   */
  intentions: { intent: string; total: number; presentes: number }[];
  /** Position moyenne quand la marque est citée (1 = citée en premier). */
  rangMoyen: number | null;
  /** Nombre de marques distinctes citées sur ses questions, et son rang. */
  classement: { rang: number; nbMarques: number } | null;
}

type ScanDb = {
  brand_name: string;
  website_url: string | null;
  sector: string | null;
  score_global: number | null;
  report_token: string | null;
  competitors: unknown;
  share_of_voice: unknown;
  audit: unknown;
  concurrent_classes: unknown;
  brand_aliases: unknown;
  concurrents_suivis: unknown;
} & Partial<Record<(typeof ENGINE_SCORE_COLUMN)[EngineLabel], number | null>>;

type PdvItem = { name: string; count: number; share: number; target: boolean };

function scoreLabel(score: number): string {
  if (score < 20) return "quasi invisible";
  if (score < 40) return "très peu visible";
  if (score < 60) return "visibilité partielle";
  if (score < 80) return "bien positionnée";
  return "très bien positionnée";
}

function readSourceUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === "string" ? s : ((s as { url?: string })?.url ?? "")))
    .filter((u): u is string => Boolean(u));
}

export async function buildScanInsights(scanId: string): Promise<ScanInsights> {
  const db = getDb();
  const scan = unwrap(await db.from("scans").select("*").eq("id", scanId).single()) as ScanDb;
  const queries = unwrap(
    await db.from("queries").select("id,text,intent").eq("scan_id", scanId).order("rank")
  ) as { id: string; text: string; intent: string | null }[];
  const responses = unwrap(
    await db.from("responses").select("id,query_id,engine,raw_text,sources").eq("scan_id", scanId)
  ) as { id: string; query_id: string; engine: string; raw_text: string | null; sources: unknown }[];
  const mentions = unwrap(
    await db.from("mentions").select("response_id,brand,is_target,position").eq("scan_id", scanId)
  ) as { response_id: string; brand: string; is_target: boolean; position: number | null }[];
  const miroirBrut = (scan as { miroir?: unknown }).miroir;

  const brand = scan.brand_name;

  const competitors = Array.isArray(scan.competitors)
    ? (scan.competitors as unknown[])
        .map((c) => (typeof c === "string" ? c : ((c as { name?: string })?.name ?? "")))
        .filter((n): n is string => Boolean(n))
    : [];

  const byResponse = new Map<string, typeof mentions>();
  for (const m of mentions) {
    const arr = byResponse.get(m.response_id) ?? [];
    arr.push(m);
    byResponse.set(m.response_id, arr);
  }
  const targetCited = (responseId: string) => (byResponse.get(responseId) ?? []).some((m) => m.is_target);

  // Requêtes où la marque n'apparaît dans aucune réponse, tous moteurs confondus.
  // `some` et non `every` : une requête sans aucune réponse collectée n'est pas
  // une requête manquée, elle n'a simplement pas été mesurée.
  //
  // Une réponse en panne ne compte pas non plus : le moteur n'a rien rendu
  // (texte vide), donc il n'a rien mesuré. Sans ce filtre, une question dont
  // toutes les réponses étaient des erreurs passait pour « manquée », et
  // l'email affirmait au prospect une absence que personne n'a constatée.
  // C'est la même règle que le dénominateur du score, pour la même raison.
  const missed = queries.filter((q) => {
    const rs = responses.filter(
      (r) => r.query_id === q.id && (r.raw_text ?? "").trim().length > 0,
    );
    return rs.length > 0 && !rs.some((r) => targetCited(r.id));
  });

  // `share_of_voice` est un tableau [{name, count, share, target}], pas un dictionnaire.
  const pdv: PdvItem[] = Array.isArray(scan.share_of_voice) ? (scan.share_of_voice as PdvItem[]) : [];

  // Classement posé par le moteur. Non classé = rival, le parti pris prudent.
  const classes = (scan.concurrent_classes ?? {}) as Record<string, string>;
  // Variantes d'écriture regroupées sous le nom retenu par le moteur.
  const alias = (scan.brand_aliases ?? {}) as Record<string, string>;
  const nomRetenu = (nom: string) => alias[nom] ?? nom;
  const estRival = (nom: string) => (classes[nomRetenu(nom)] ?? "rival") === "rival";

  // Le concurrent mis en avant doit être un rival : nommer Deloitte à une PME
  // ne lui apprend rien et ne lui donne aucune prise.
  const competitorShares = pdv
    .filter((p) => !p.target && estRival(p.name))
    .sort((a, b) => b.share - a.share);
  // Les réponses où une marque apparaît : l'unité du rapport, celle que le
  // prospect relit en cliquant le lien. « In Extenso cité dans 30 réponses »
  // dans l'email et « 33 citations » dans le rapport seraient deux nombres
  // justes qui se contredisent : on compte des réponses distinctes.
  const reponsesDe = (nom: string) =>
    new Set(
      mentions.filter((m) => !m.is_target && nomRetenu(m.brand) === nom).map((m) => m.response_id),
    ).size;
  const topCompetitor = competitorShares[0]
    ? {
        name: competitorShares[0].name,
        share: competitorShares[0].share,
        count: competitorShares[0].count,
        reponses: reponsesDe(competitorShares[0].name),
      }
    : null;
  const reponsesTotal = responses.filter((r) => (r.raw_text ?? "").trim().length > 0).length;
  const reponsesAvecMarque = new Set(
    mentions.filter((m) => m.is_target).map((m) => m.response_id),
  ).size;
  // Les citations du client se comptent sur les mentions, jamais sur la part de
  // voix : celle-ci est tronquée pour l'affichage, et un client hors du top 10
  // y serait introuvable, donc compté à zéro. C'est la source qu'utilisent déjà
  // les deux lignes suivantes pour les concurrents ; le client la partage
  // désormais, et les trois chiffres sont enfin comptés de la même façon.
  const citationsCible = mentions.filter((m) => m.is_target).length;
  const citationsConcurrents = mentions.filter((m) => !m.is_target).length;
  const citationsRivaux = mentions.filter((m) => !m.is_target && estRival(m.brand)).length;
  const brandShare =
    citationsCible + citationsConcurrents > 0
      ? citationsCible / (citationsCible + citationsConcurrents)
      : 0;

  // L'audit flash : robots.txt et llms.txt, tels que le moteur les a lus.
  // `auditFait` distingue « rien de bloqué » de « on n'a pas pu vérifier » :
  // affirmer qu'un site est ouvert sans l'avoir lu serait une faute.
  const audit = (scan.audit ?? null) as {
    ok?: boolean;
    bots?: Record<string, string>;
    llmstxt?: boolean;
  } | null;
  const auditFait = Boolean(audit?.ok);
  const botsBloques = audit?.bots
    ? Object.keys(audit.bots).filter((b) => audit.bots?.[b] === "bloque")
    : [];

  // Un moteur ne compte que s'il a réellement produit un score.
  const engineScores: EngineScore[] = (Object.keys(ENGINE_SCORE_COLUMN) as EngineLabel[])
    .map((label) => ({ engine: label, label, score: Number(scan[ENGINE_SCORE_COLUMN[label]] ?? NaN) }))
    .filter((e) => Number.isFinite(e.score));
  const sorted = [...engineScores].sort((a, b) => a.score - b.score);

  // Domaines cités par Perplexity quand un concurrent apparaît et pas la marque.
  const sources = new Set<string>();
  let anySources = false;
  for (const r of responses) {
    const urls = readSourceUrls(r.sources);
    if (urls.length) anySources = true;
    if (r.engine !== "Perplexity") continue;
    const ms = byResponse.get(r.id) ?? [];
    if (!ms.some((m) => !m.is_target)) continue;
    for (const url of urls) {
      try {
        sources.add(new URL(url).hostname.replace(/^www\./, ""));
      } catch {
        /* URL invalide : on ignore plutôt que de faire échouer la relance */
      }
    }
  }

  // Le verbatim qui fait mal : concurrent cité en tête, marque absente.
  //
  // L'ordre de parcours est imposé ici, et ce n'est pas cosmétique. La requête
  // sur `responses` n'a pas d'ORDER BY : Postgres ne promet donc aucun ordre,
  // et cette boucle prend la PREMIÈRE réponse trouvée avant de s'arrêter. Le
  // même scan désignait ainsi un concurrent différent d'une exécution à
  // l'autre — l'email disait « Kardynal est nommé » quand le rapport ouvert
  // par le prospect pouvait citer Dougs. Deux pièces qui se contredisent
  // détruisent la seule chose que nous vendons, un chiffre non négociable.
  //
  // Le tri suit le rang de la question, celui de l'intention d'achat, puis le
  // moteur par ordre alphabétique pour lever les égalités. Le verbatim retenu
  // est donc le plus déterminant commercialement, et il est stable.
  // Un ordre stable ne suffit pas : il doit désigner le verbatim le plus
  // vendeur, sinon la stabilité s'achète au prix de la qualité. Trier par rang
  // de question rendait « Claude sur la question 1 » pour tout le monde, et
  // faisait perdre à Archipel Lyon un rival local nommé avec son adresse au
  // profit d'un Pennylane générique.
  //
  // Deux critères viennent du dépôt lui-même. `estRival` d'abord, avec son
  // commentaire de la ligne 211 : nommer Deloitte à une PME ne prouve rien,
  // c'est le concurrent atteignable qui fait mal. L'intention `locale`
  // ensuite : une question posée avec la ville est celle que le dirigeant
  // reconnaît comme la sienne, et celle que le sprint peut gagner en trois
  // semaines (voir gagnabilite.ts). Le rang et le moteur ne servent plus qu'à
  // départager, pour que le résultat reste reproductible.
  const rangDeQuestion = new Map(queries.map((q, n) => [q.id, n]));
  const intentDeQuestion = new Map(queries.map((q) => [q.id, q.intent]));

  const candidats = responses
    .filter((r) => r.raw_text && !targetCited(r.id))
    .map((r) => {
      const rival = (byResponse.get(r.id) ?? [])
        .filter((m) => !m.is_target)
        // À position égale, l'ordre alphabétique départage : sans ce second
        // critère, deux marques citées au même rang se choisissaient au hasard
        // de l'ordre des lignes.
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || a.brand.localeCompare(b.brand))[0];
      return { r, rival };
    })
    .filter((c): c is { r: (typeof responses)[number]; rival: (typeof mentions)[number] } => Boolean(c.rival))
    .sort(
      (a, b) =>
        Number(estRival(b.rival.brand)) - Number(estRival(a.rival.brand)) ||
        Number(intentDeQuestion.get(b.r.query_id) === "locale") -
          Number(intentDeQuestion.get(a.r.query_id) === "locale") ||
        (a.rival.position ?? 99) - (b.rival.position ?? 99) ||
        (rangDeQuestion.get(a.r.query_id) ?? 9999) - (rangDeQuestion.get(b.r.query_id) ?? 9999) ||
        a.r.engine.localeCompare(b.r.engine) ||
        a.r.id.localeCompare(b.r.id),
    );

  let killerQuote: ScanInsights["killerQuote"] = null;
  for (const { r, rival: firstCompetitor } of candidats.slice(0, 1)) {
    const q = queries.find((x) => x.id === r.query_id);
    // Le filtre en amont a déjà écarté les réponses sans texte ; le repli à
    // vide n'est là que pour le compilateur.
    const texte = r.raw_text ?? "";
    killerQuote = {
      query: q?.text ?? "",
      engine: r.engine,
      excerpt: texte.length > 400 ? texte.slice(0, 400) + "…" : texte,
      competitor: firstCompetitor.brand,
    };
    break;
  }

  // La question miroir : première entrée exploitable du tableau `scans.miroir`.
  const miroirs = Array.isArray(miroirBrut)
    ? (miroirBrut as { moteur?: string; texte?: string }[])
    : [];
  const premierMiroir = miroirs.find((m) => (m?.texte ?? "").trim().length > 40);
  const miroir = premierMiroir
    ? { moteur: premierMiroir.moteur ?? "ChatGPT", extrait: coupePhrase(premierMiroir.texte as string, 300) }
    : null;

  // Ventilation par intention, comptée en RÉPONSES réellement obtenues : une
  // réponse en panne ne compte pas, même règle que le dénominateur du score.
  const intentDe = new Map(queries.map((q) => [q.id, q.intent ?? "autre"]));
  const reponsesValides = responses.filter((r) => (r.raw_text ?? "").trim().length > 0);
  const intentions = [...new Set(queries.map((q) => q.intent ?? "autre"))]
    .map((intent) => {
      const duGroupe = reponsesValides.filter((r) => intentDe.get(r.query_id) === intent);
      return {
        intent,
        total: duGroupe.length,
        presentes: duGroupe.filter((r) => targetCited(r.id)).length,
      };
    })
    .filter((g) => g.total > 0);

  // Position moyenne quand cité : « les IA ne donnent que deux ou trois noms
  // utiles » n'a de poids que si on peut dire où le prospect tombe.
  const rangs = mentions
    .filter((m) => m.is_target && typeof m.position === "number")
    .map((m) => m.position as number);
  const rangMoyen = rangs.length
    ? Math.round((rangs.reduce((a, b) => a + b, 0) / rangs.length) * 10) / 10
    : null;

  // Classement parmi toutes les marques citées, compté sur `mentions` et
  // jamais sur `share_of_voice`, qui est tronqué aux dix premières lignes.
  const parMarque = new Map<string, number>();
  for (const m of mentions) {
    const nom = m.is_target ? brand : nomRetenu(m.brand);
    parMarque.set(nom, (parMarque.get(nom) ?? 0) + 1);
  }
  const tri = [...parMarque.entries()].sort((a, b) => b[1] - a[1]);
  const rangCible = tri.findIndex(([nom]) => nom === brand);
  const classement =
    rangCible >= 0 && tri.length > 1 ? { rang: rangCible + 1, nbMarques: tri.length } : null;

  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const score = Math.round(Number(scan.score_global ?? 0));
  return {
    brand,
    url: scan.website_url,
    sector: scan.sector,
    score,
    scoreLabel: scoreLabel(score),
    mode: String((scan as { mode?: string }).mode ?? "apercu"),
    reportUrl: scan.report_token ? `${base}/rapport/${scan.report_token}` : null,
    competitors,
    topCompetitor,
    brandShare,
    citationsCible,
    citationsConcurrents,
    citationsRivaux,
    concurrentsSuivis: (Array.isArray(scan.concurrents_suivis)
      ? scan.concurrents_suivis
      : []) as ScanInsights["concurrentsSuivis"],
    botsBloques,
    auditFait,
    llmstxtAbsent: auditFait && audit?.llmstxt === false,
    weakestEngine: sorted[0] ?? null,
    bestEngine: sorted[sorted.length - 1] ?? null,
    missedQueries: missed.map((q) => q.text),
    missedCount: missed.length,
    totalQueries: queries.length,
    competitorSources: [...sources],
    sourcesUnavailable: !anySources,
    killerQuote,
    miroir,
    intentions,
    rangMoyen,
    classement,
    reponsesTotal,
    reponsesAvecMarque,
  };
}

export const pct = (v: number) => `${Math.round(v * 100)} %`;

/**
 * Coupe un texte à une longueur maximale, en finissant sur une PHRASE.
 *
 * L'ancienne coupe tombait au dernier espace : un email de prospection partait
 * avec « et accompagnemen... » en plein milieu d'un mot cité entre guillemets,
 * ce qui ruine l'effet « mot pour mot » qu'on est justement en train de
 * revendiquer. On cherche la dernière fin de phrase avant la limite ; à
 * défaut, le dernier espace, mais jamais l'intérieur d'un mot.
 */
export function coupePhrase(texte: string, max: number): string {
  const propre = texte
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/[*_`#]/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (propre.length <= max) return propre;
  const fenetre = propre.slice(0, max);
  const finPhrase = Math.max(
    fenetre.lastIndexOf(". "),
    fenetre.lastIndexOf("! "),
    fenetre.lastIndexOf("? "),
  );
  if (finPhrase > max * 0.4) return fenetre.slice(0, finPhrase + 1);
  const dernierEspace = fenetre.lastIndexOf(" ");
  return (dernierEspace > max * 0.6 ? fenetre.slice(0, dernierEspace) : fenetre).replace(/[,;:]$/, "") + "…";
}

/** Comparaison souple : sans casse ni accents, pour chercher un nom dans un texte. */
function aplati(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * L'extrait qui contient RÉELLEMENT le nom du concurrent.
 *
 * Le défaut corrigé ici : la citation partait du début de la réponse et
 * s'arrêtait à 320 caractères, or les moteurs posent d'abord le contexte et
 * ne nomment qu'ensuite. Le mail affirmait donc « Dougs est nommé » sous une
 * citation où Dougs n'apparaissait pas. Une preuve qui ne prouve pas est pire
 * que pas de preuve : c'est la seule phrase du message que le prospect peut
 * vérifier d'un coup d'œil.
 *
 * On garde la tête de réponse quand elle suffit, sinon on ouvre la fenêtre à
 * l'endroit où le nom apparaît, en démarrant sur une frontière de phrase.
 */
export function citationAutourDe(texte: string, marque: string, max = 320): string {
  const tete = coupePhrase(texte, max);
  if (aplati(tete).includes(aplati(marque))) return tete;

  const propre = coupePhrase(texte, Number.MAX_SAFE_INTEGER);
  const pos = aplati(propre).indexOf(aplati(marque));
  if (pos < 0) return tete;

  const planche = Math.max(0, pos - Math.floor(max / 3));
  const finPhrase = propre.lastIndexOf(". ", pos);
  const debut = finPhrase >= planche ? finPhrase + 2 : planche;
  const morceau = coupePhrase(propre.slice(debut), max);
  return debut > 0 ? `…${morceau}` : morceau;
}

/** Le nom figure-t-il dans ce texte, accents et casse mis de côté ? */
export function contientNom(texte: string, nom: string): boolean {
  return aplati(texte).includes(aplati(nom));
}
