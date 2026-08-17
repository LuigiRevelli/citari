/**
 * Les marchés d'exemple du schéma d'ouverture.
 *
 * Créés le 17/08/2026. Jérémie : « je sais pas si c'est bien de garder
 * l'exemple des cabinets comptables, c'est un peu trop précis, les clients
 * vont pas s'identifier ». Le relevé lui donnait raison — « comptable »
 * apparaissait à sept endroits du site, et un plombier qui lit « meilleur
 * cabinet comptable à Lyon » en conclut que le produit n'est pas pour lui.
 *
 * Plutôt que d'anonymiser (plus froid, moins crédible), le visiteur choisit
 * son métier et le schéma se repeuple avec SON marché. L'exemple reste
 * concret, et il devient le sien.
 *
 * Tous les noms sont inventés. Aucun ne doit correspondre à une entreprise
 * réelle : le site affiche « exemple illustratif » sous le schéma, et cette
 * mention n'est tenable que si les noms sont bien fictifs.
 */

export type Marche = {
  /** L'étiquette du sélecteur. Un mot, deux au plus. */
  metier: string;
  /** La requête telle qu'un acheteur la pose. */
  requete: string;
  /** Les trois seules entreprises que l'IA nomme. */
  cites: [string, string, string];
  /** Tous les autres. C'est leur NOMBRE qui porte l'argument. */
  foule: string[];
};

export const MARCHES: Marche[] = [
  {
    metier: "plombier",
    requete: "meilleur plombier à Lyon",
    cites: ["Plomberie Vasseur", "Artisans du Rhône", "Dépannage Lyon Sud"],
    foule: [
      "Plomberie Morel",
      "SOS Fuites",
      "Rhône Sanitaire",
      "Chauffe & Co",
      "Plomberie Girard",
      "Aqua Service",
      "Bertrand Plomberie",
      "Lyon Dépannage",
      "Sanitaire Express",
      "Plomberie Vidal",
      "Thermo Lyon",
      "Duval Sanitaire",
      "Plomberie Roux",
      "Hydro Conseil",
      "Atelier du Cuivre",
      "Plomberie Blanc",
      "Rhône Chauffage",
      "Plomberie Aubert",
      "Eau & Feu",
      "Plomberie Perrin",
      "Sud Sanitaire",
      "Plomberie Noël",
      "Cap Plomberie",
      "Plomberie Simon",
    ],
  },
  {
    metier: "avocat",
    requete: "meilleur avocat d'affaires à Lyon",
    cites: ["Ferrand & Associés", "Lexence Avocats", "Cabinet Delaunay"],
    foule: [
      "Cabinet Morel",
      "Juris Rhône",
      "Avocats Part-Dieu",
      "Cabinet Lambert",
      "Lex Lyon",
      "Cabinet Vidal",
      "Conseil & Droit",
      "Cabinet Roux",
      "Aequitas",
      "Cabinet Blanc",
      "Novalex",
      "Cabinet Aubert",
      "Rhône Juridique",
      "Cabinet Girard",
      "Jurisconseil",
      "Cabinet Perrin",
      "Themis Lyon",
      "Cabinet Noël",
      "Praxis Avocats",
      "Cabinet Simon",
      "Lyon Contentieux",
      "Cabinet Mercier",
      "Droit & Cie",
      "Cabinet Vincent",
    ],
  },
  {
    metier: "agence web",
    requete: "meilleure agence web à Lyon",
    cites: ["Studio Kaleo", "Atelier Novak", "Pixel & Cie"],
    foule: [
      "Digital Rhône",
      "Agence Morel",
      "WebLyon",
      "Studio Lambert",
      "Netcraft",
      "Agence Vidal",
      "Pixelium",
      "Studio Roux",
      "Onde Digitale",
      "Agence Blanc",
      "Kod & Co",
      "Studio Aubert",
      "Wavelab",
      "Agence Girard",
      "Fabrique Numérique",
      "Studio Perrin",
      "Hexa Digital",
      "Agence Noël",
      "Meta Studio",
      "Studio Simon",
      "Trame",
      "Agence Mercier",
      "Vertex Web",
      "Studio Vincent",
    ],
  },
  {
    metier: "restaurant",
    requete: "meilleur restaurant à Lyon",
    cites: ["Maison Lambert", "Le Comptoir Verdier", "Table & Co"],
    foule: [
      "Chez Morel",
      "Le Bouchon Lyonnais",
      "Brasserie Vidal",
      "La Table Roux",
      "Le Gourmet",
      "Chez Blanc",
      "L'Atelier du Goût",
      "Le Bistrot Aubert",
      "Saveurs & Co",
      "Chez Girard",
      "La Cantine",
      "Le Perrin",
      "Maison Noël",
      "L'Entrecôte Sud",
      "Chez Simon",
      "Le Refuge",
      "Table Mercier",
      "Le Jardin",
      "Chez Vincent",
      "La Cave",
      "Le Marché",
      "Chez Faure",
      "L'Auberge",
      "Le Quai",
    ],
  },
  {
    metier: "expert-comptable",
    requete: "meilleur cabinet comptable à Lyon",
    cites: ["Fiduciaire Rhône", "Cabinet Bertrand", "Expertise Lyon Sud"],
    foule: [
      "Cabinet Morel",
      "Audit Rhône",
      "Oméga Conseil",
      "Compta+",
      "Cabinet Vidal",
      "Duval & Associés",
      "Cabinet Roux",
      "Rhône Expertise",
      "Cap Compta",
      "Axe Conseil",
      "Cabinet Leroy",
      "Synergie Audit",
      "Cabinet Blanc",
      "Lyon Fiduciaire",
      "Vertex Conseil",
      "Cabinet Aubert",
      "Prisme Audit",
      "Cabinet Faure",
      "Neo Gestion",
      "Cabinet Girard",
      "Méridien Audit",
      "Cabinet Perrin",
      "Atlas Compta",
      "Cabinet Simon",
    ],
  },
];
