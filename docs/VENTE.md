# Manuel de vente

Comment on trouve un client et comment on le signe. Pour le quoi et le
pourquoi, voir [POSITIONNEMENT.md](POSITIONNEMENT.md).

---

## 1. Le coup que nous seuls pouvons jouer

Tout le monde peut envoyer un mail de prospection. **Nous pouvons scanner un
prospect avant de le contacter**, pour quatorze centimes.

Cela change la nature de l'échange. Ce n'est plus un démarchage, c'est un
diagnostic offert et vérifiable. Le prospect n'a rien demandé mais il reçoit
une information sur son entreprise qu'il n'avait pas, qu'il peut contrôler, et
qui le concerne directement.

**Les meilleurs prospects sont ceux qui ont les plus mauvais scores.** Ils ont
le plus à gagner et le plus de mal à nier le problème. Un score de 4/100 avec
trois concurrents cités quarante fois est une conversation qui démarre toute
seule.

### La séquence

1. **Constituer une liste** de 30 à 50 entreprises d'un même secteur et d'une
   même zone. Sources : Pappers pour les données légales françaises, Apollo
   pour les contacts, annuaires sectoriels.
2. **Scanner le lot en mode aperçu** (`scan-lot --mode apercu`, 0,14 € par
   entreprise) et classer du pire au meilleur score.
3. **Contacter les vingt plus mauvais**, en commençant par ceux dont le panier
   moyen dépasse 2 900 €.
4. **L'exclusivité ne s'engage qu'à la signature.** Prospecter plusieurs
   concurrents d'une même zone est permis : le premier message ne promet rien,
   il offre un diagnostic. La règle du client unique reste entière — elle se
   déclenche au contrat, pas au premier contact. *Tranché le 16/08/2026 par
   Jérémy ; la règle inverse interdisait le test des dix, qui porte par
   construction sur dix cabinets d'un même secteur et d'une même zone.*

---

## 2. Le premier message

Déterministe, rempli avec les vraies données du scan. **Jamais de génération
libre par un modèle sur un mail de prospection** : une phrase inventée dans un
mail commercial est une faute qui ne se rattrape pas.

> Objet : votre visibilité dans ChatGPT (mesure faite ce matin)
>
> Bonjour {prénom},
>
> J'ai mesuré la visibilité de {marque} dans ChatGPT et Gemini.
>
> Sur 20 questions que posent vos clients avant de choisir un
> {métier}, {marque} est citée {N} fois. {concurrent} l'est {M} fois.
>
> Voici la mesure, gratuitement et sans contrepartie :
> {lien}
>
> Si le sujet vous intéresse, je vous propose trente minutes pour la
> commenter, et j'y ajoute les quatre moteurs restants — Claude,
> Perplexity, Grok et Le Chat. Si ce n'est pas le moment, ce message
> restera sans suite.
>
> {signature}

**Ce qui fait fonctionner ce message :** un objet factuel sans superlatif, un
chiffre vérifiable dans les deux premières lignes, un lien qui donne de la
valeur avant toute demande, et une porte de sortie explicite.

**Ce qui le tuerait :** un superlatif, une urgence fabriquée, une relance
automatique agressive, ou un chiffre approximatif.

### Pourquoi l'aperçu, et pas le scan complet

*Tranché le 17/08/2026 par Jérémy.* Le mail de prospection envoie désormais un
scan **aperçu** : 20 questions, deux moteurs, 0,14 € au lieu de 1,06 €.

Trois raisons, dans cet ordre :

1. **Le prospect voit la page publique**, celle du site, et non le document de
   mesure. C'est la même chose qu'il aurait obtenue en saisissant son adresse
   lui-même, donc le mail ne court-circuite pas le tunnel.
2. **Les quatre moteurs non interrogés s'affichent verrouillés.** Le manque
   devient l'objet du rendez-vous, au lieu que tout soit donné à froid.
3. **Sept fois moins cher**, ce qui autorise des lots plus larges à budget égal.

**La règle qui en découle, et elle ne se négocie pas : le mail ne nomme que les
moteurs qui ont réellement répondu.** En aperçu, c'est ChatGPT et Gemini, jamais
les six. Un prospect qui ouvre son rapport et n'y trouve pas Perplexity a
attrapé le message en flagrant délit dès la première ligne, et le reste de la
mesure devient suspect avec lui.

Le corollaire opérationnel : quand un moteur tombe en panne pendant un lot — clé
révoquée, projet archivé, plafond de débit — le mail doit cesser de le nommer
avant de partir. Vérifier les erreurs du lot AVANT de rédiger, jamais après.

### La séquence de relance

Trois messages, à J+2, J+5 et J+12, générés automatiquement à la capture du
lead. Le troisième annonce la clôture du dossier, ce qui produit plus de
réponses que n'importe quelle relance insistante.

Toute réponse, même négative, arrête la séquence.

---

## 3. Le cadre légal

La prospection B2B par email vers une adresse professionnelle nominative est
licite en France sur la base de l'intérêt légitime, à trois conditions :
l'objet du message doit être en rapport avec la fonction de la personne,
l'expéditeur doit être clairement identifié, et un moyen de désinscription doit
être présent.

Le démarchage téléphonique B2B n'est pas concerné par Bloctel, qui ne couvre
que les particuliers.

**À faire valider par un juriste avant de passer à l'échelle.** Ce paragraphe
est une orientation, pas un avis juridique.

---

## 4. Le rendez-vous de trente minutes

L'objectif n'est pas de vendre. Il est de déterminer si le prospect a le
problème et s'il peut être aidé. Si la réponse est non, le dire et raccrocher
vaut mieux qu'un sprint mal vendu qui ne produira rien.

**Cinq premières minutes.** Faire parler. « Comment vos clients vous
trouvent-ils aujourd'hui ? » Écouter s'il mentionne une phase de recherche
avant le premier contact. Sans elle, il n'est pas éligible.

**Dix minutes suivantes.** Commenter le rapport ensemble, à l'écran. Ne pas
présenter, ouvrir le rapport et le lire avec lui. S'arrêter sur les verbatims :
c'est le moment où le problème devient concret, parce qu'il voit la phrase
exacte où son concurrent est recommandé à sa place.

**Cinq minutes.** Poser deux questions dont les réponses conditionnent tout :
le panier moyen d'un nouveau client, et le nombre de nouveaux clients par mois.
Elles servent au calcul du seuil de remboursement.

**Cinq minutes.** Présenter le sprint par les trois causes, jamais par la liste
des prestations. « Une IA ne vous cite pas pour trois raisons possibles. » Puis
le prix, sans hésitation ni justification spontanée.

**Cinq dernières minutes.** Poser la contrainte : trois sprints par mois, un
seul client par secteur et par zone. Annoncer l'envoi de la proposition sous
vingt-quatre heures. Ne pas chercher à conclure pendant l'appel.

---

## 5. Les objections, et quoi répondre

**« C'est du SEO, j'en fais déjà. »**
Non. Le SEO vous place dans une liste de liens, ici il s'agit d'être cité dans
une réponse rédigée. Les signaux que lisent les IA ne sont pas ceux que lit
Google. Les deux se complètent, ils ne se remplacent pas.

**« Vous garantissez quoi, exactement ? »**
La livraison intégrale des actions listées, documentées une par une, et une
mesure identique avant et après. Pas un score. Les moteurs intègrent les
changements en quatre à douze semaines et personne ne contrôle ce délai.
Quiconque vous promet une position vous vend ce qu'il ne contrôle pas.

**« 2 900 €, c'est cher. »**
Ne jamais baisser le prix. Répondre par le seuil : à votre panier moyen de
{X} €, un seul client récupéré rembourse le sprint. Puis comparer : une
prestation SEO équivalente se vend en abonnement de 1 000 à 3 000 € par mois
sur douze mois. Si le budget bloque réellement, réduire le périmètre, jamais le
tarif.

**« Je vais y réfléchir. »**
Très bien. Rappeler la contrainte sans insister : nous prenons trois sprints
par mois et un seul client par secteur et par zone. Si un concurrent direct
nous appelle d'ici là, la place part. Ce n'est pas une pression commerciale,
c'est un fait.

**« Comment je sais que ça marche ? »**
Vous ne le savez pas encore, et nous non plus avec certitude sur votre cas
précis. C'est pour cela que le re-scan à J+90 est inclus et qu'il rejoue
exactement les mêmes questions. Vous verrez la progression réelle, quelle
qu'elle soit, y compris si elle est mauvaise.

**« Vous avez des références ? »**
Non, et vous ne trouverez sur notre site ni témoignage ni logo. L'agence est
récente. Ce que nous pouvons vous montrer, c'est la méthode entière, la formule
de calcul publiée, et un rapport complet gratuit avant tout engagement.

*Cette réponse fonctionne mieux qu'une esquive. Assumer directement est plus
crédible que de contourner.*

---

## 6. La proposition

Envoyée sous vingt-quatre heures, générée par
`pnpm toolkit proposition "<client>"` à partir des vraies données du scan.

Elle est **déterministe** : le prix, les livrables et les engagements ne
varient jamais. Seul le diagnostic est personnalisé, avec des faits
vérifiables issus du scan.

Validité trente jours. Relire avant envoi : vérifier le nom du contact et
adapter le mot d'introduction.

---

## 7. Ce qu'on ne fait jamais

- Inventer un chiffre, un délai ou une référence.
- Générer librement le texte d'un mail de prospection avec un modèle.
- **Nommer dans un mail un moteur qui n'a pas répondu.** Le nombre de moteurs et
  le nombre de questions se lisent sur le lot réellement mesuré, jamais sur le
  gabarit.
- Envoyer un lot sans avoir regardé ses erreurs. Un moteur muet à 100 % ne se
  voit pas dans un score, il se voit dans les erreurs.
- Promettre une position ou un score.
- Baisser le prix pour conclure.
- Vendre un sprint à quelqu'un dont le score est déjà bon. On le lui dit et on
  s'arrête là.
- Prendre deux clients concurrents sur le même secteur et la même zone.
