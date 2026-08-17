import { citationAutourDe, contientNom, coupePhrase, pct, type ScanInsights } from "./insights.js";
import { meilleureAccroche, type TypeAccroche } from "./accroches.js";

/**
 * Les emails envoyés après un scan gratuit.
 *
 * Un seul module pour tous les messages : le ton doit être le même du premier
 * au dernier, et une copie dispersée dans plusieurs fichiers dérive toujours.
 *
 * Trois partis pris tiennent tout le reste :
 *
 *  1. **Aucun chiffre inventé.** Tout sort de `buildScanInsights`, donc de la
 *     base. Un email de prospection qui avance un chiffre faux est mort, et il
 *     tue la crédibilité de la mesure avec lui.
 *  2. **Ses données plutôt que des statistiques.** « 46 % des acheteurs
 *     démarrent sur une IA » est le chiffre de quelqu'un d'autre. « Vos
 *     concurrents cités 253 fois, vous 19 » est le sien, et c'est ce qui fait
 *     ouvrir le rapport.
 *  3. **Le message suit la situation, pas le score.** Un site qui bloque
 *     GPTBot n'a pas un problème de visibilité, il a une cause technique qui
 *     explique tout le reste. Le dire d'abord nous place en expert et non en
 *     vendeur.
 */

const BOOKING = () => process.env.BOOKING_URL || "[LIEN DE RÉSERVATION]";
const SIGNATURE = () => process.env.FOUNDER_SIGNATURE || "Luigi\nCitari";

export interface Email {
  /** 0 = envoyé dès la fin du scan. 1 à 3 = relances programmées. */
  step: number;
  offsetDays: number;
  subject: string;
  body: string;
}

/**
 * Quatre situations, dans cet ordre de priorité.
 *
 * `bloque` passe avant tout, y compris avant un bon score : c'est une cause,
 * pas un symptôme, et elle se vérifie en trente secondes. `solide` protège la
 * promesse faite sur le site, « si votre score est bon, nous vous le dirons et
 * nous ne vous vendrons rien ».
 */
export type Situation = "bloque" | "invisible" | "marginal" | "solide";

export function situationDuScan(i: ScanInsights): Situation {
  if (i.botsBloques.length > 0) return "bloque";
  if (i.score >= 55) return "solide";
  // « Invisible » veut dire jamais cité, rien d'autre.
  //
  // La règle a d'abord été « zéro citation OU moins de 5 % de part de voix ».
  // Le seuil partait d'une bonne intention, distinguer une marque qui pèse
  // d'une marque qui fait du bruit de fond, mais il se retournait contre les
  // meilleurs prospects : dans un secteur qui compte des centaines de
  // cabinets, être cité vingt-cinq fois pèse encore moins de 5 %. Dougs,
  // vingt-cinq citations, tombait ainsi dans « invisible ».
  //
  // Aucun email ne prétendait qu'il n'existait pas, le texte restait exact.
  // Mais il recevait le message écrit pour une marque absente au lieu de
  // celui écrit pour une marque présente et mal placée, qui est le meilleur
  // argument que nous ayons : « c'est la situation où le travail paye le plus
  // vite ». Le mauvais argument partait donc aux prospects les plus mûrs.
  //
  // La part de voix reste dans le rapport, où elle informe. Elle ne décide
  // plus de ce qu'on écrit.
  if (i.citationsCible === 0) return "invisible";
  return "marginal";
}

/* ─────────────────────────── briques communes ─────────────────────────── */

const lienRapport = (i: ScanInsights) =>
  i.reportUrl
    ? `${i.mode === "apercu" ? "Votre mesure est ici" : "Votre rapport complet est ici"} :\n${i.reportUrl}`
    : "";

/** Ce qu'on sait de la personne à qui on écrit. Rien n'est obligatoire. */
export type Contact = { prenom?: string | null };

/**
 * « Bonjour Mickael, » plutôt que « Bonjour, ».
 *
 * Le manuel de vente prévoyait « Bonjour {prénom} » depuis le début, mais la
 * salutation était codée en dur : les quarante messages d'un lot sortaient
 * tous anonymes. Le prénom n'est jamais deviné — sans lui en base, on garde
 * la formule neutre, qui reste correcte.
 */
function salutation(contact?: Contact): string {
  const prenom = (contact?.prenom ?? "").trim();
  return prenom ? `Bonjour ${prenom},` : `Bonjour,`;
}

/** Le concurrent nommé, ou une formule neutre si aucun ne ressort. */
const rival = (i: ScanInsights) => i.topCompetitor?.name ?? "vos concurrents";

/**
 * Le verbatim : la phrase exacte où une IA recommande un concurrent.
 *
 * C'est notre pièce la plus forte, et de loin. Lire « je recommanderais de
 * contacter Cabinet Perrin-Lacaze » quand on est son concurrent produit un
 * effet qu'aucun argumentaire n'obtient.
 */
/**
 * Nettoie un extrait de réponse pour un email en texte brut.
 *
 * Les moteurs répondent en markdown : « **Evol**, **Comète** ». Recopié tel
 * quel dans un email, l'astérisque saute aux yeux et fait bricolage. On coupe
 * aussi sur une frontière de mot, jamais au milieu d'un mot.
 */
function citation(texte: string, max = 320): string {
  // La coupe finit sur une phrase : un « mot pour mot » tronqué en plein mot
  // (« et accompagnemen... ») ruine exactement ce qu'il prétend prouver.
  return coupePhrase(texte, max);
}

function verbatim(i: ScanInsights): string {
  if (!i.killerQuote) return "";
  const { engine, query, excerpt, competitor } = i.killerQuote;
  const extrait = citationAutourDe(excerpt, competitor);
  // Le nom reste introuvable (le moteur l'écrit autrement, ou il vient d'une
  // autre réponse) : on affirme seulement ce que la citation montre.
  const prouve = contientNom(extrait, competitor);
  return `Voici ce que ${engine} répond, mot pour mot, à la question « ${query} » :

« ${extrait} »

${prouve ? `${competitor} est nommé. ${i.brand} n'apparaît pas.` : `${i.brand} n'y apparaît pas.`}`;
}

/**
 * Les concurrents que le prospect a nommés lui-même.
 *
 * Rien ne frappe plus fort : ce sont SES noms, pas les nôtres. Et le cas à
 * zéro citation vaut d'être dit aussi, il désamorce l'idée que le scan
 * chercherait à faire peur.
 */
function concurrentsNommes(i: ScanInsights): string {
  const suivis = i.concurrentsSuivis.filter((c) => c.saisi);
  if (suivis.length === 0) return "";
  const lignes = suivis.map((c) =>
    c.citations > 0
      ? `  . ${c.saisi} : cité ${c.citations} fois`
      : `  . ${c.saisi} : jamais cité non plus`,
  );
  return `Vous nous aviez cité ${suivis.length === 1 ? "un concurrent" : `${suivis.length} concurrents`}. Voici ce que les moteurs en disent, face à vos ${i.citationsCible} citations :

${lignes.join("\n")}`;
}

/**
 * L'invitation à vérifier soi-même.
 *
 * Contre-intuitif mais décisif : on donne une vraie question du scan et on
 * l'invite à la poser lui-même. Ça ne coûte rien, ça installe une crédibilité
 * qu'aucune promesse n'achète, et la mise en garde sur la variabilité désamorce
 * d'avance la seule objection possible, « moi je me vois cité ».
 */
function defiVerifiable(i: ScanInsights): string {
  const question = i.missedQueries[0] ?? i.killerQuote?.query;
  if (!question) return "";
  return `Ne me croyez pas sur parole. Ouvrez ChatGPT, copiez cette question, regardez la réponse :

« ${question} »

Les réponses varient d'une fois sur l'autre, c'est précisément pourquoi nous en posons ${i.totalQueries} à plusieurs moteurs plutôt qu'une seule. Mais l'ordre de grandeur, vous le verrez tout de suite.`;
}

/**
 * La question miroir : ce que le moteur raconte de l'entreprise elle-même.
 *
 * La pièce la plus personnelle du scan, et la seule question qui prononce le
 * nom du prospect — le bloc l'annonce lui-même, sinon il contredirait le
 * protocole deux paragraphes plus loin, et un dirigeant qui repère une
 * incohérence dans l'email doute aussitôt de toute la mesure.
 */
function miroirBloc(i: ScanInsights): string {
  if (!i.miroir) return "";
  return `Avant de compter vos concurrents, nous avons posé une question plus simple, la seule qui prononce votre nom : qui est ${i.brand}, selon ${i.miroir.moteur}. Voici sa réponse, mot pour mot :

« ${i.miroir.extrait} »

Ce texte est votre fiche d'identité dans ${i.miroir.moteur} : ce qui y est daté, approximatif ou inventé se répète, à peu de variations près, à chaque personne qui pose la question. Vous seul pouvez dire ce qui est encore vrai.`;
}

/**
 * La lecture d'analyste : ce que le score ne montre pas.
 *
 * C'est le bloc qui fait dire « ils ont vraiment regardé mon cas ». Tout est
 * compté en RÉPONSES, l'unité du rapport : l'email et la page qu'il ouvre
 * doivent dire le même nombre. Chaque phrase ne sort que si sa donnée existe,
 * il n'y a jamais de trou ni de zéro embarrassant.
 */
const LIBELLE_INTENT: Record<string, string> = {
  comparative: "questions où un acheteur compare avant de choisir",
  probleme: "questions où un client décrit son problème",
  locale: "questions posées avec votre ville",
  confiance: "questions de confiance",
};

function lectureAnalyste(i: ScanInsights): string {
  const phrases: string[] = [];

  const comparatives = i.intentions.find((g) => g.intent === "comparative");
  const locales = i.intentions.find((g) => g.intent === "locale");
  if (comparatives && locales) {
    phrases.push(
      `Sur les ${comparatives.total} réponses aux ${LIBELLE_INTENT.comparative}, vous apparaissez dans ${comparatives.presentes} ; sur les ${locales.total} réponses aux ${LIBELLE_INTENT.locale}, dans ${locales.presentes}.`,
    );
  } else if (comparatives) {
    phrases.push(
      `Sur les ${comparatives.total} réponses aux ${LIBELLE_INTENT.comparative}, vous apparaissez dans ${comparatives.presentes}.`,
    );
  }

  if (i.rangMoyen !== null && i.citationsCible > 0) {
    phrases.push(`Quand vous êtes cité, votre position moyenne est ${String(i.rangMoyen).replace(".", ",")}.`);
  }

  if (i.classement) {
    phrases.push(
      `${i.classement.nbMarques} marques se partagent vos questions ; vous y êtes au rang ${i.classement.rang}.`,
    );
  }

  if (i.weakestEngine && i.bestEngine && i.weakestEngine.label !== i.bestEngine.label) {
    phrases.push(
      `Le point faible est ${i.weakestEngine.label} ; le point d'appui, ${i.bestEngine.label}.`,
    );
  }

  if (phrases.length === 0) return "";
  return `Voici ce que votre score ne montre pas. ${phrases.join(" ")}`;
}

/**
 * Le protocole : vendre la rigueur de la mesure, sans jargon.
 *
 * « De mesure » n'est pas un mot de trop : la question miroir, elle, prononce
 * le nom, et le bloc miroir le dit. Les deux s'emboîtent au lieu de se
 * contredire.
 */
function protocoleBloc(i: ScanInsights): string {
  return `Nos questions de mesure ne prononcent jamais le nom de ${i.brand} : quand une marque sort, le moteur l'a choisie seul. Elles sont scellées, puis rejouées mot pour mot quatre-vingt-dix jours plus tard : l'écart devient un fait opposable. Et une panne de moteur est retirée du calcul, un incident chez eux ne fait pas une mauvaise note chez vous.`;
}

/**
 * La demande.
 *
 * On ne vend pas un rendez-vous, on offre un diagnostic. C'est vrai au sens
 * strict : le scan complet n'est lancé que lorsqu'un créneau est réservé, et il
 * coûte réellement de l'argent. Le rendez-vous n'est que la façon de le remettre.
 */
function offreDiagnostic(): string {
  return `Je vous offre le scan complet : les 6 moteurs, 24 questions, 144 réponses, l'audit technique de votre site, et les sources exactes sur lesquelles les IA s'appuient pour recommander vos concurrents.

Il me faut trente minutes avec vous pour vous le présenter, parce qu'un tableau de chiffres sans lecture ne sert à rien.

${BOOKING()}`;
}

const pied = (avecStop = true) =>
  `${SIGNATURE()}${
    avecStop
      ? `

--
Ce message vous est adressé par Citari. Pour ne plus être contacté, répondez « STOP ».`
      : ""
  }`;

/** Assemble en supprimant les blocs vides, pour ne jamais laisser de trou. */
const bloc = (...parties: string[]) => parties.filter((p) => p.trim()).join("\n\n");

/* ───────────────────── l'email immédiat, par situation ───────────────────── */

/**
 * Envoyé dès la fin du scan, pas deux jours après.
 *
 * C'est le seul message dont l'ouverture est quasi certaine : il est attendu,
 * et le prospect vient de voir son score. Deux jours plus tard, l'émotion est
 * retombée et l'ouverture avec elle.
 */
export function emailImmediat(i: ScanInsights, contact?: Contact): Email {
  const situation = situationDuScan(i);
  const base = { step: 0, offsetDays: 0 };

  if (situation !== "solide") {
    // L'objet et l'ouverture viennent du fait le plus vendeur du scan, pas
    // d'un ordre décidé à l'avance. Voir lib/accroches.ts : le blocage
    // technique y est volontairement bas, parce qu'il souffle au dirigeant
    // que le problème est petit et gratuit à régler.
    const a = meilleureAccroche(i);
    const dit = (t: TypeAccroche) => a?.type === t;

    // Le reste du scan suit dans le corps, sans jamais répéter l'ouverture :
    // relire deux fois le même chiffre donne l'impression d'un gabarit.
    const site = (i.url ?? "").replace(/\/$/, "");
    return {
      ...base,
      subject: a?.sujet ?? `${i.brand} : ${i.score}/100 de visibilité dans les IA`,
      body: bloc(
        salutation(contact),
        `Votre scan est terminé : ${i.score}/100.`,
        lienRapport(i),
        a?.ouverture ?? "",

        // L'écart, s'il n'a pas déjà servi d'ouverture.
        dit("ecart") || dit("absence") || dit("concurrent-nomme")
          ? ""
          : i.citationsCible === 0
            ? `Sur les ${i.totalQueries} questions testées, ${i.brand} n'est cité aucune fois. Vos concurrents comparables, ${i.citationsRivaux} fois.`
            : `${i.brand} est cité ${i.citationsCible} fois. Vos concurrents comparables, ${i.citationsRivaux} fois.`,

        // Les questions perdues.
        dit("questions-perdues") || i.missedCount === 0
          ? ""
          : i.missedCount >= i.totalQueries
            ? `Sur les ${i.totalQueries} questions, sans exception, aucun moteur ne mentionne ${i.brand}. Ce sont des questions que vos prospects posent au moment de choisir.`
            : `Vous êtes absent sur ${i.missedCount} de ces ${i.totalQueries} questions, celles où vos prospects comparent avant de trancher.`,

        // La lecture d'analyste : la ventilation que le score ne montre pas.
        // C'est elle qui remplace l'ancienne phrase générique de situation.
        lectureAnalyste(i),

        // Les concurrents qu'il a nommés : la liste complète garde sa valeur
        // même quand l'un d'eux a servi d'ouverture, à cause du cas « jamais
        // cité non plus », qui désamorce l'idée qu'on cherche à faire peur.
        concurrentsNommes(i),

        dit("verbatim") ? "" : verbatim(i),

        // La fiche d'identité : ce que le moteur raconte de l'entreprise.
        miroirBloc(i),

        // Le blocage technique : jamais perdu, même quand il n'est pas
        // l'accroche. C'est notre meilleure preuve de sérieux, et la seule
        // chose du message qu'il peut vérifier lui-même en trente secondes.
        i.botsBloques.length === 0
          ? ""
          : dit("technique")
            ? `C'est presque toujours involontaire : beaucoup de sites ont hérité ce réglage d'un CMS installé en 2023, quand bloquer les robots d'IA passait pour une précaution. Vérifiez en trente secondes, ouvrez ${site || "votre site"}/robots.txt et cherchez ${i.botsBloques[0]}.`
            : `Une cause probable, et c'est une bonne nouvelle : votre fichier robots.txt bloque ${i.botsBloques.join(", ")}. Ces moteurs ne peuvent donc pas lire votre site. Vérifiez en trente secondes sur ${site || "votre site"}/robots.txt. C'est une ligne à changer, dix minutes pour votre développeur, et c'est le préalable à tout le reste.`,

        defiVerifiable(i),

        situation === "marginal"
          ? `C'est la situation où le travail paye le plus vite. Quand une marque existe déjà mais manque les bonnes questions, il s'agit de combler des trous identifiés, pas de tout construire.`
          : `Ce n'est presque jamais une question de budget ni de notoriété. Dans la grande majorité des cas que nous mesurons, l'essentiel vient de trois causes techniques et éditoriales identifiables en une vingtaine de minutes.`,

        // La rigueur du protocole, juste avant l'offre : c'est elle qui rend
        // l'offre crédible.
        protocoleBloc(i),

        offreDiagnostic(),
        pied(),
      ),
    };
  }

  // solide : on tient la promesse faite sur le site, et on ne vend rien.
  return {
    ...base,
    subject: `${i.brand} : ${i.score}/100, et je n'ai rien à vous vendre`,
    body: bloc(
      salutation(contact),
      `Votre scan est terminé : ${i.score}/100.`,
      lienRapport(i),
      `Je vais être direct : c'est un bon score, et je n'ai rien à vous vendre.`,
      `${i.brand} est cité ${i.citationsCible} fois au fil des ${i.totalQueries} questions testées, tous moteurs confondus. La plupart des entreprises que nous mesurons sont très en dessous. Vous faites déjà ce qu'il faut, peut-être sans l'avoir cherché.`,
      i.missedCount > 0
        ? `Un seul angle mort, gratuitement : vous restez absent sur ${i.missedCount} questions, dont « ${i.missedQueries[0]} ». Si ce sujet compte pour votre activité, c'est là qu'il y a quelque chose à récupérer.`
        : "",
      i.llmstxtAbsent
        ? `Détail technique, sans urgence : votre site n'a pas de fichier llms.txt. C'est un résumé court que les moteurs lisent en priorité. Une heure de travail, et ça consolide une position que vous avez déjà.`
        : "",
      `Votre score de départ est archivé avec ses questions. Si vous refaites un scan dans six mois, vous aurez une comparaison exacte, mêmes questions, même formule. C'est la seule façon honnête de savoir si votre position tient.`,
      // Le seul appel de ce message : la recommandation à un pair. Un bon
      // score transféré à un confrère vaut plus que trois relances.
      `Si un confrère se demande ce que les IA répondent à sa place, cet email vaut d'être transféré : le scan est gratuit, la mesure sera la même, les chiffres seront les siens.`,
      `Si un jour vous voulez qu'on en parle, mon agenda est ouvert : ${BOOKING()}. Mais dans votre situation, rien ne presse.`,
      pied(),
    ),
  };
}

/* ─────────────────────── les trois relances de rattrapage ─────────────────────── */

/**
 * Pour ceux qui n'ont pas réservé. Le premier email a déjà tout dit du score :
 * répéter le même argument plus fort ne convainc personne. Chacune de ces trois
 * relances apporte donc autre chose, et la dernière sait s'arrêter.
 */
export function emailsDeRelance(i: ScanInsights, contact?: Contact): Email[] {
  const situation = situationDuScan(i);

  // Aucune relance quand le score est bon.
  //
  // Le premier message dit « je n'ai rien à vous vendre, rien ne presse ».
  // Enchaîner trois relances qui poussent le diagnostic contredirait
  // frontalement cette phrase, et détruirait la confiance qu'elle construit.
  // Une promesse tenue vaut plus qu'un rendez-vous arraché.
  if (situation === "solide") return [];

  const site = (i.url ?? "").replace(/\/$/, "");
  const sources = i.competitorSources.slice(0, 3);

  return [
    // J+2 : une seule question, très courte. C'est le format qui obtient des réponses.
    {
      step: 1,
      offsetDays: 2,
      subject: `Une question sur ${i.brand}`,
      body: bloc(
        salutation(contact),
        `Vous avez mesuré la visibilité IA de ${i.brand} il y a deux jours.`,
        situation === "bloque"
          ? `Une question, sincèrement : saviez-vous que votre site interdisait l'accès à ${i.botsBloques[0]} ?`
          : i.missedCount > 0
            ? `Une question, sincèrement : saviez-vous que vous n'apparaissiez sur aucune des ${i.missedCount} questions où vos prospects comparent avant de choisir ?`
            : `Une question, sincèrement : saviez-vous que vos concurrents comparables étaient cités ${i.citationsRivaux} fois contre ${i.citationsCible} pour vous ?`,
        `Si la réponse est non, ça vaut trente minutes. Si c'est oui et que c'est assumé, dites-le-moi et je ne vous relance plus.`,
        `${BOOKING()}`,
        pied(),
      ),
    },

    // J+7 : de la valeur, sans rien demander. Change le rapport de force.
    {
      step: 2,
      offsetDays: 7,
      subject: `Une action à faire vous-même pour ${i.brand}`,
      body: bloc(
        salutation(contact),
        `Je reviens sans relancer sur notre offre, avec quelque chose que vous pouvez faire sans nous.`,
        i.botsBloques.length > 0
          ? `Priorité absolue dans votre cas : votre robots.txt bloque ${i.botsBloques.join(", ")}. Tant que ce n'est pas levé, aucun autre effort ne peut porter. Dix minutes pour votre développeur.`
          : `Ouvrez ${site || "votre site"}/robots.txt et cherchez GPTBot, ClaudeBot et PerplexityBot. S'ils y sont bloqués, aucune IA ne peut lire votre site, et tout le reste devient inutile tant que ce n'est pas corrigé.`,
        sources.length > 0
          ? `Autre chose, tirée de votre scan : quand les moteurs recommandent vos concurrents, ils s'appuient régulièrement sur ces sources :\n${sources.map((s) => `  . ${s}`).join("\n")}\n\nY figurer est souvent plus rentable qu'un mois de publicité. Vous pouvez commencer par la première cette semaine, sans nous.`
          : situation === "marginal" && i.missedQueries[0]
            ? `Et une piste précise, puisque vous êtes déjà cité ailleurs : la question « ${i.missedQueries[0]} » vous échappe complètement. Une page qui y répond en moins de quarante mots, en tête d'article, suffit souvent à y entrer.`
            : i.llmstxtAbsent
              ? `Deuxième chose, plus rapide : votre site n'a pas de fichier llms.txt. C'est un résumé court de votre offre et de vos zones, que les moteurs lisent en priorité. Une heure de travail, et personne ne le fait dans votre secteur.`
              : "",
        `Si vous préférez qu'on déroule ça ensemble sur ${i.brand} : ${BOOKING()}`,
        pied(),
      ),
    },

    // J+21 : la clôture. Souvent l'email qui obtient le plus de réponses,
    // parce qu'il rend la main au lieu de la forcer.
    {
      step: 3,
      offsetDays: 21,
      subject: `Je clos votre dossier ${i.brand} ?`,
      body: bloc(
        salutation(contact),
        `Sans nouvelles, je pars du principe que le sujet n'est pas prioritaire en ce moment, ce qui est parfaitement légitime.`,
        `Je clos donc votre dossier, sans relance supplémentaire. Trois choses avant :`,
        `1. Votre rapport reste accessible${i.reportUrl ? ` : ${i.reportUrl}` : ""}.
2. Votre score de départ (${i.score}/100) est archivé avec ses ${i.totalQueries} questions. Un scan dans six mois vous donnera une comparaison exacte.
3. Si la situation change, par exemple si un prospect vous dit avoir vu un concurrent dans ChatGPT, écrivez-moi et je reprends le dossier là où on l'a laissé.`,
        `Bonne continuation à ${i.brand}.`,
        `${SIGNATURE()}

--
Vous ne recevrez plus d'email de ma part concernant ce scan.`,
      ),
    },
  ];
}

/** Les quatre messages d'un lead, dans l'ordre. */
export function tousLesEmails(i: ScanInsights, contact?: Contact): Email[] {
  return [emailImmediat(i, contact), ...emailsDeRelance(i, contact)];
}

/* ─────────────────────────── la version HTML ─────────────────────────── */

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Habille un message en HTML sobre.
 *
 * Volontairement minimal : aucune image, aucun tableau de mise en page, aucune
 * feuille de style externe, uniquement des styles en ligne et des polices
 * système. Les clients mail sont un champ de ruines et tout ce qui est
 * sophistiqué finit cassé quelque part, ou en indésirables.
 *
 * ⚠ À n'utiliser qu'une fois le domaine chauffé. Un domaine neuf qui envoie du
 * HTML avec des liens part beaucoup plus facilement en spam que le même texte
 * brut. Les cent premiers envois doivent rester en texte : c'est aussi ce qui
 * convertit le mieux en B2B, parce qu'un message qui ressemble à une vraie
 * lettre est lu comme une vraie lettre.
 *
 * Le texte brut reste la version de référence et doit toujours accompagner le
 * HTML dans l'envoi : les clients qui refusent le HTML l'afficheront, et les
 * filtres anti-spam pénalisent un message HTML sans équivalent texte.
 */
export function enHtml(email: Email, i: ScanInsights): string {
  const ENCRE = "#1a1a1a";
  const DOUX = "#666";
  const TRAIT = "#e5e5e5";
  const ACCENT = "#8b2942";

  // Le bloc de score ne s'affiche que sur le premier message : c'est le seul
  // qui annonce un résultat. Le mettre partout en ferait un ornement.
  const score =
    email.step === 0
      ? `<div style="border:1px solid ${TRAIT};padding:24px;margin:28px 0;">
  <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${DOUX};">Votre score de visibilité IA</div>
  <div style="font-size:52px;line-height:1;font-weight:300;color:${ENCRE};margin:10px 0 4px;">${i.score}<span style="font-size:20px;color:${DOUX};"> / 100</span></div>
  <div style="font-size:14px;color:${DOUX};">${echapper(i.brand)} cité ${i.citationsCible} fois · concurrents comparables ${i.citationsRivaux} fois</div>
</div>`
      : "";

  // Le corps est déjà écrit en paragraphes séparés par des lignes vides : on
  // s'appuie dessus plutôt que d'inventer un balisage.
  const corps = email.body
    .split(/\n{2,}/)
    .map((p) => {
      const t = p.trim();
      if (!t) return "";
      // Les URL seules deviennent un bouton, le reste un paragraphe.
      if (/^https?:\/\/\S+$/.test(t)) {
        return `<p style="margin:26px 0;"><a href="${t}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:13px 26px;font-size:15px;">Réserver mon scan complet</a></p>`;
      }
      if (t.startsWith("--")) {
        return `<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${TRAIT};font-size:12px;color:${DOUX};">${echapper(t.replace(/^--\s*/, "")).replace(/\n/g, "<br>")}</p>`;
      }
      // Un extrait entre guillemets français : on le détache visuellement.
      if (t.startsWith("«") && t.endsWith("»")) {
        return `<blockquote style="margin:22px 0;padding:14px 18px;border-left:3px solid ${TRAIT};font-style:italic;color:${ENCRE};">${echapper(t)}</blockquote>`;
      }
      return `<p style="margin:16px 0;">${echapper(t).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${ENCRE};max-width:560px;margin:0 auto;padding:8px;">
${corps.split("\n")[0] ?? ""}
${score}
${corps.split("\n").slice(1).join("\n")}
</div>`;
}
