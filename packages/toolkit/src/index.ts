#!/usr/bin/env tsx
/**
 * Usine de livraison Citari — CLI interne du fondateur.
 * Usage : pnpm toolkit <commande> [args]
 */
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { Command } from "commander";

// Charge le .env de la racine du dépôt dans process.env (Node 20.12+).
// Sans ça, aucune commande ne verrait la clé Claude ni les accès Supabase :
// requireEnv lèverait « variable d'environnement manquante » dès le départ.
try {
  process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), "../../../.env"));
} catch {
  /* pas de .env : les variables sont peut-être déjà exportées dans le shell */
}
import { auditTechnique } from "./commands/audit-technique.js";
import { generateFixes } from "./commands/generate-fixes.js";
import { contentBrief } from "./commands/content-brief.js";
import { draftContent } from "./commands/draft-content.js";
import { citationTargets } from "./commands/citation-targets.js";
import { verifyFixes } from "./commands/verify-fixes.js";
import { crawlerLog } from "./commands/crawler-log.js";
import { sprintReport } from "./commands/sprint-report.js";
import { relance } from "./commands/relance.js";
import { reponses } from "./commands/reponses.js";
import { envoyer } from "./commands/envoyer.js";
import { desinscrire, effacer } from "./commands/desinscrire.js";
import { proposition } from "./commands/proposition.js";
import { rescan } from "./commands/rescan.js";
import { prioriser } from "./commands/prioriser.js";
import { concurrents } from "./commands/concurrents.js";
import { indexnow } from "./commands/indexnow.js";
import { verifyCitations } from "./commands/verify-citations.js";
import { verifyContents } from "./commands/verify-contents.js";
import { controle45 } from "./commands/controle-45.js";
import { scanLot } from "./commands/scan-lot.js";
import { sourcer } from "./commands/sourcer.js";
import { verifierBase } from "./commands/verifier-base.js";
import { classerLeads } from "./commands/classer-leads.js";
import { signauxGeo } from "./commands/signaux-geo.js";
import { enrichir } from "./commands/enrichir.js";

const program = new Command()
  .name("toolkit")
  .description("Outils de livraison des sprints GEO (Chantiers 1, 2, 3)");

program
  .command("audit-technique")
  .argument("<url>", "URL du site à auditer")
  .option("-c, --client <client>", "rattacher au client (nom ou id)")
  .description("Chantier 1 — crawle le site : robots.txt, llms.txt, schema.org, Hn, meta, latence")
  .action((url: string, opts: { client?: string }) => run(auditTechnique(url, opts)));

program
  .command("generate-fixes")
  .argument("<client>", "nom ou id du client")
  .description("Chantier 1 — robots.txt corrigé, llms.txt, blocs JSON-LD + doc de specs")
  .action((client: string) => run(generateFixes(client)));

program
  .command("prioriser")
  .argument("<client>", "nom ou id du client")
  .description("Chantier 2 — classe les questions perdues par gagnabilité avant J+90 (sans clé API)")
  .action((client: string) => run(prioriser(client)));

program
  .command("indexnow")
  .argument("<client>", "nom ou id du client")
  .argument("<urls...>", "URLs publiées à signaler à Bing/IndexNow")
  .option("--dry-run", "affiche le payload sans l'envoyer")
  .action((client: string, urls: string[], opts: { dryRun?: boolean }) =>
    run(indexnow(client, urls, opts)));

program
  .command("concurrents")
  .argument("<client>", "nom ou id du client")
  .option("--corriger <marque=classe...>", "corrige un classement, pour tous les scans suivants")
  .option("--secteur", "limite la correction au secteur de ce client")
  .description("Relit et corrige le classement des concurrents (rival | geant | outil | institution)")
  .action((client: string, o: { corriger?: string[]; secteur?: boolean }) =>
    run(concurrents(client, o)),
  );

program
  .command("content-brief")
  .argument("<client>", "nom ou id du client")
  .description("Chantier 2 — 4-6 briefs de contenu ciblés sur les requêtes où le client est absent")
  .action((client: string) => run(contentBrief(client)));

program
  .command("draft-content")
  .argument("<client>", "nom ou id du client")
  .argument("<brief-id>", "id du brief (voir content-briefs.md ou l'admin)")
  .description("Chantier 2 — rédige le brouillon complet d'un contenu (relecture obligatoire)")
  .action((client: string, briefId: string) => run(draftContent(client, briefId)));

program
  .command("citation-targets")
  .argument("<client>", "nom ou id du client")
  .description("Chantier 3 — cibles de citation priorisées + brouillons de pitchs presse")
  .action((client: string) => run(citationTargets(client)));

program
  .command("signaux-geo")
  .argument("<fichier>", "CSV de prospects avec une colonne site_web")
  .option("-o, --sortie <fichier>", "CSV produit (défaut : <fichier>-signaux-geo.csv)")
  .option("-p, --parallele <n>", "sites lus de front (max 8)", "6")
  .description("Acquisition — lit sur chaque site son matériau GEO : rythme de publication, taille, avis balisés, FAQ, llms.txt, et l'angle commercial que ça autorise")
  .action((fichier: string, o: Record<string, string>) =>
    run(signauxGeo(fichier, { sortie: o.sortie, parallele: Number(o.parallele) || 6 })));

program
  .command("classer-leads")
  .argument("<fichier>", "CSV de prospects, idéalement déjà passé par verifier-base")
  .option("-o, --sortie <fichier>", "CSV classé produit (défaut : <fichier>-classe.csv)")
  .option("-t, --top <n>", "nombre de lignes détaillées à l'écran", "15")
  .description("Acquisition — classe les prospects du plus chaud au plus froid, avec la raison")
  .action((fichier: string, o: Record<string, string>) =>
    run(classerLeads(fichier, { sortie: o.sortie, top: Number(o.top) || 15 })));

program
  .command("verifier-base")
  .argument("<fichier>", "CSV de prospects à contrôler")
  .option("-c, --communes <liste>", "communes de la zone, pour les entreprises dont l'INSEE masque le code postal")
  .option("-o, --sortie <fichier>", "CSV annoté produit (défaut : <fichier>-verifie.csv)")
  .description("Acquisition — contrôle la fiabilité d'une base : MX des domaines, doublons, zone, cohérence")
  .action((fichier: string, o: Record<string, string>) =>
    run(verifierBase(fichier, { communes: o.communes, sortie: o.sortie })));

program
  .command("sourcer")
  .requiredOption("--naf <codes>", "codes NAF séparés par des virgules (ex. 69.20Z : experts-comptables, 69.10Z : avocats, 68.31Z : agences immobilières)")
  .option("-d, --dept <numeros>", "départements du siège (ex. 69,01)")
  .option("--cp <codes>", "codes postaux du siège (ex. 69001,69002)")
  .option("-e, --effectif <plage>", "effectif salarié (tranches INSEE chevauchées)", "10-249")
  .option("-n, --nom <slug>", "nom des fichiers produits (défaut : naf-zone-date)")
  .option("--etablissements", "garder aussi les sièges hors zone qui y ont un établissement")
  .option("--max <n>", "plafond d'entreprises retenues", "500")
  .description("Acquisition — liste d'entreprises depuis l'annuaire officiel (API gouv, gratuite), prête pour scan-lot")
  .action((o: Record<string, string | boolean>) =>
    run(sourcer({
      naf: String(o.naf),
      dept: o.dept ? String(o.dept) : undefined,
      cp: o.cp ? String(o.cp) : undefined,
      effectif: String(o.effectif ?? "10-249"),
      nom: o.nom ? String(o.nom) : undefined,
      etablissements: Boolean(o.etablissements),
      max: Number(o.max) || 500,
    })));

program
  .command("enrichir")
  .argument("<fichier>", "CSV point-virgule avec une colonne de domaines")
  .option("-c, --colonne <nom>", "colonne contenant le domaine", "domaine")
  .option("-p, --parallele <n>", "sites visités de front (max 8)", "5")
  .option("--max <n>", "plafond de sites visités", "500")
  .description("Acquisition — complète un CSV avec les contacts que chaque site publie (emails, téléphones, mentions légales), les robots d'IA bloqués et les pixels publicitaires")
  .action((fichier: string, o: Record<string, string>) =>
    run(enrichir(fichier, {
      colonne: o.colonne,
      parallele: Number(o.parallele) || 5,
      max: Number(o.max) || 500,
    })));

program
  .command("scan-lot")
  .argument("<fichier>", "liste « Nom, site.fr » — une entreprise par ligne")
  .requiredOption("-s, --secteur <secteur>", "secteur commun (ex. « Expertise comptable »)")
  .option("-v, --ville <ville>", "ville ou zone")
  .option("-m, --mode <mode>", "apercu (0,14 €) ou complet (1,06 €)", "apercu")
  .option("-p, --parallele <n>", "scans menés de front (max 5)", "3")
  .option("--sans-pipeline", "ne pas créer les prospects dans la base")
  .option("--sans-cache", "remesurer même si un scan de moins de 3 jours existe (après une panne de clé)")
  .description("Acquisition — scanne une liste d'entreprises et produit le classement du baromètre")
  .action((fichier: string, o: Record<string, string | boolean>) =>
    run(scanLot(fichier, {
      secteur: String(o.secteur),
      ville: o.ville ? String(o.ville) : undefined,
      mode: o.mode === "complet" ? "complet" : "apercu",
      sansCache: Boolean(o.sansCache),
      parallele: Number(o.parallele) || 3,
      pipeline: !o.sansPipeline,
    })));

program
  .command("controle-45")
  .argument("<client>", "nom ou id du client")
  .description("Interne — mi-parcours : mêmes questions, moteurs à recherche seulement (~0,40 €)")
  .action((client: string) => run(controle45(client)));

program
  .command("verify-citations")
  .argument("<client>", "nom ou id du client")
  .description("Preuve — la marque figure-t-elle réellement sur chaque cible de citation ?")
  .action((client: string) => run(verifyCitations(client)));

program
  .command("verify-contents")
  .argument("<client>", "nom ou id du client")
  .argument("<urls...>", "URLs des contenus publiés")
  .description("Preuve — les contenus répondent, portent du JSON-LD et figurent dans llms.txt")
  .action((client: string, urls: string[]) => run(verifyContents(client, urls)));

program
  .command("verify-fixes")
  .argument("<client>", "nom ou id du client")
  .description("Contrôle — vérifie que les correctifs livrés sont réellement en ligne")
  .action((client: string) => run(verifyFixes(client)));

program
  .command("crawler-log")
  .argument("<client>", "nom ou id du client")
  .argument("<fichier>", "log d'accès du serveur, format combiné Apache/Nginx")
  .description("Preuve — compte les passages réels des crawlers IA sur le site du client")
  .action((client: string, fichier: string) => run(crawlerLog(client, fichier)));

program
  .command("relance")
  .argument("[lead]", "id, email ou marque du lead")
  .option("-a, --all", "générer la séquence pour tous les leads au statut « new »")
  .description("Commercial — séquence de 3 relances personnalisées (J+2, J+7, J+21) à partir des données du scan")
  .action((lead: string | undefined, opts: { all?: boolean }) => {
    if (!lead && !opts.all) {
      console.error("Précisez un lead, ou utilisez --all pour tous les leads non traités.");
      process.exit(1);
    }
    run(relance(lead ?? "", opts));
  });

program
  .command("reponses")
  .argument("<lead>", "id, email ou marque du prospect")
  .description("Commercial — réponses aux objections, remplies avec ses vrais chiffres")
  .action((lead: string) => run(reponses(lead)));

program
  .command("envoyer")
  .option("--vraiment", "envoyer réellement (sans ce drapeau : simulation)")
  .option("-l, --limite <n>", "nombre maximal d'envois par passage", "50")
  .description("Commercial — envoie par Resend les relances dues, après revérification (simulation par défaut)")
  .action((opts: { vraiment?: boolean; limite?: string }) => run(envoyer(opts)));

program
  .command("desinscrire")
  .argument("<email>", "adresse du prospect qui a répondu STOP")
  .description("Commercial — plus aucun email vers cette adresse, définitivement ; relances en attente annulées")
  .action((email: string) => run(desinscrire(email)));

program
  .command("effacer")
  .argument("<email>", "adresse de la personne qui invoque son droit à l'effacement")
  .option("--vraiment", "exécuter la suppression (sans ce drapeau : simulation)")
  .description("RGPD — droit à l'effacement : supprime le lead et ses relances, vide les coordonnées client")
  .action((email: string, opts: { vraiment?: boolean }) => run(effacer(email, opts)));

program
  .command("proposition")
  .argument("<cible>", "client, lead, email ou id de scan")
  .option("-o, --offer <offre>", "sprint (2 900 €) ou domination (4 900 €)", "sprint")
  .description("Commercial — proposition post-call personnalisée avec les chiffres réels du scan")
  .action((cible: string, opts: { offer?: string }) => run(proposition(cible, opts)));

program
  .command("sprint-report")
  .argument("<client>", "nom ou id du client")
  .description("Semaine 4 — rapport de fin de sprint : actions livrées, citations, re-scan J+90")
  .action((client: string) => run(sprintReport(client)));

program
  .command("rescan")
  .argument("<client>", "nom ou id du client")
  .description("Re-scan J+90 avec les MÊMES requêtes + rapport avant/après")
  .action((client: string) => run(rescan(client)));

function run(p: Promise<void>) {
  p.catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}

program.parse();
