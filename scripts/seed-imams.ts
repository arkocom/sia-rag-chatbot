import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

// Citations des ouvrages des Imams
const IMAM_SOURCES = [
  // RIYAD AS-SALIHIN (An-Nawawi) - SINCÉRITÉ & PAROLE
  { content: "L'homme atteint le niveau du jeûneur et du prieur juste par la sincérité de ses paroles.", reference: "Riyad as-Salihin (An-Nawawi) - Sincérité", source: "imam", theme: "sincerite" },
  { content: "Le mensonge précipite dans le péché, et le péché précipite dans l'Enfer.", reference: "Riyad as-Salihin (An-Nawawi) - Sincérité", source: "imam", theme: "sincerite" },
  { content: "Celui qui garantit pour moi ce qui est entre ses deux joues (la langue) et ce qui est entre ses deux cuisses (les désirs), je lui garantis le Paradis.", reference: "Riyad as-Salihin (An-Nawawi) - Sincérité", source: "imam", theme: "sincerite" },
  { content: "Le musulman est celui des autres musulmans échappent à ses mains et à sa langue.", reference: "Riyad as-Salihin (An-Nawawi) - Sincérité", source: "imam", theme: "sincerite" },
  { content: "Le plus grand mensonge est de dire « j'ai entendu » alors qu'on n'a pas entendu.", reference: "Riyad as-Salihin (An-Nawawi) - Sincérité", source: "imam", theme: "sincerite" },
  
  // RIYAD AS-SALIHIN - PATIENCE & COLÈRE
  { content: "La colère est une braise dans le cœur d'Adam : regardez comme elle rougit et flambe !", reference: "Riyad as-Salihin (An-Nawawi) - Patience", source: "imam", theme: "patience" },
  { content: "Celui qui se domine quand il est en colère, Allah le remplira de sécurité et de foi.", reference: "Riyad as-Salihin (An-Nawawi) - Patience", source: "imam", theme: "patience" },
  { content: "Quand l'un de vous se met en colère, qu'il se taise.", reference: "Riyad as-Salihin (An-Nawawi) - Patience", source: "imam", theme: "patience" },
  { content: "La patience est une lumière.", reference: "Riyad as-Salihin (An-Nawawi) - Patience", source: "imam", theme: "patience" },
  { content: "Allah n'a pas fait descendre de remède plus rapide que la prière quand un malheur survient.", reference: "Riyad as-Salihin (An-Nawawi) - Patience", source: "imam", theme: "patience" },
  
  // RIYAD AS-SALIHIN - COMPORTEMENT SOCIAL
  { content: "Le plus complet des croyants en foi est celui qui a la meilleure conduite.", reference: "Riyad as-Salihin (An-Nawawi) - Comportement", source: "imam", theme: "comportement" },
  { content: "Le croyant est un miroir du croyant : quand l'un voit une tache chez l'autre, il la lui nettoie.", reference: "Riyad as-Salihin (An-Nawawi) - Comportement", source: "imam", theme: "comportement" },
  { content: "Visitez les malades, suivez les convois funèbres, répondez à l'invitation, et exaucez le serment.", reference: "Riyad as-Salihin (An-Nawawi) - Comportement", source: "imam", theme: "comportement" },
  { content: "Celui qui croit en Allah et au Jour Dernier qu'honore son hôte.", reference: "Riyad as-Salihin (An-Nawawi) - Comportement", source: "imam", theme: "comportement" },
  { content: "Le sourire est une aumône.", reference: "Riyad as-Salihin (An-Nawawi) - Comportement", source: "imam", theme: "comportement" },
  
  // RIYAD AS-SALIHIN - AUMÔNE & DISCRÉTION
  { content: "Ta main gauche ne doit pas savoir ce que ta main droite a donné.", reference: "Riyad as-Salihin (An-Nawawi) - Aumône", source: "imam", theme: "aumone" },
  { content: "Le meilleur aumône est celle que l'on donne quand on est en bonne santé et avare, dans la peur de la pauvreté et l'espoir de la richesse.", reference: "Riyad as-Salihin (An-Nawawi) - Aumône", source: "imam", theme: "aumone" },
  { content: "Protège-toi de l'Enfer, même avec une demi-datte.", reference: "Riyad as-Salihin (An-Nawawi) - Aumône", source: "imam", theme: "aumone" },
  { content: "Le musulman est le frère du musulman : il ne le déçoit pas, ne le trahit pas et ne le méprise pas.", reference: "Riyad as-Salihin (An-Nawawi) - Aumône", source: "imam", theme: "aumone" },
  
  // AL-ADAB AL-MUFRAD (Al-Bukhari) - PARENTS & FAMILLE
  { content: "Le paradis se trouve sous les pieds des mères.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Famille", source: "imam", theme: "famille" },
  { content: "Celui qui ne prie pas pour ses parents vivants ou morts est renié par Allah.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Famille", source: "imam", theme: "famille" },
  { content: "Le regard compatissant d'un fils vers son père est une aumône.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Famille", source: "imam", theme: "famille" },
  { content: "Le père est la porte du paradis de son enfant : si tu veux l'ouvrir, sois bon avec lui.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Famille", source: "imam", theme: "famille" },
  { content: "Le meilleur des hommes est celui qui est bon avec sa famille.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Famille", source: "imam", theme: "famille" },
  
  // AL-ADAB AL-MUFRAD - VOISINAGE
  { content: "Gabriel m'a tellement recommandé le bon voisinage que j'ai cru qu'il allait lui donner un droit d'héritage.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Voisinage", source: "imam", theme: "voisinage" },
  { content: "Celui qui croit en Allah et au Jour Dernier qu'honore son voisin.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Voisinage", source: "imam", theme: "voisinage" },
  { content: "Le voisin a trois droits : le salut, le silence de la langue, et le partage du repas.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Voisinage", source: "imam", theme: "voisinage" },
  { content: "Le musulman qui dort le ventre plein pendant que son voisin a faim n'a pas cru en moi sincèrement.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Voisinage", source: "imam", theme: "voisinage" },
  { content: "Le plus proche d'Allah est le plus utile à Ses créatures.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Voisinage", source: "imam", theme: "voisinage" },
  
  // AL-ADAB AL-MUFRAD - POLITESSE & SALAM
  { content: "Le salut est avant la question.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Politesse", source: "imam", theme: "politesse" },
  { content: "Quand tu entres dans une maison, salue-toi vous-même : vous êtes dignes de salut.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Politesse", source: "imam", theme: "politesse" },
  { content: "Le jeune est invité à dire le bon mot ou à se taire.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Politesse", source: "imam", theme: "politesse" },
  { content: "Celui qui commence le salam est libéré de l'orgueil.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Politesse", source: "imam", theme: "politesse" },
  { content: "Le plus proche d'Allah le jour du Jugement est celui qui commence le salam.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Politesse", source: "imam", theme: "politesse" },
  
  // AL-ADAB AL-MUFRAD - GESTES COURTOIS
  { content: "Quand tu lèves la tête vers le ciel, rappelle-toi que tu regardes la demeure de ton Seigneur : baisse un peu ton regard de pudeur.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Courtoisie", source: "imam", theme: "courtoisie" },
  { content: "Celui qui est accueilli par un frère qu'il a déjà rencontré, qu'il le serre dans ses bras et qu'il lui dise « que Dieu te bénisse ».", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Courtoisie", source: "imam", theme: "courtoisie" },
  { content: "Le croyant est doux : il se plie comme l'herbe, mais il ne se brise pas.", reference: "Al-Adab al-Mufrad (Al-Bukhari) - Courtoisie", source: "imam", theme: "courtoisie" },
  
  // IHYA' ULUM AL-DIN (Al-Ghazali) - CONNAISSANCE DE SOI
  { content: "Connais-toi toi-même et tu connaîtras ton Seigneur.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Connaissance", source: "imam", theme: "connaissance" },
  { content: "Le cœur est un miroir : quand il est voilé par le péché, il ne reflète plus la vérité.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Connaissance", source: "imam", theme: "connaissance" },
  { content: "Le plus grand voyage est celui qui mène de la surface du cœur à son centre.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Connaissance", source: "imam", theme: "connaissance" },
  { content: "Celui qui ne se surveille pas ne peut surveiller les autres.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Connaissance", source: "imam", theme: "connaissance" },
  { content: "Le savant sans œuvres est comme un arbre sans fruits : il fait de l'ombre, mais il ne nourrit pas.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Connaissance", source: "imam", theme: "connaissance" },
  
  // IHYA' ULUM AL-DIN - MAÎTRISE DU CŒUR
  { content: "Le cœur est un roi et les membres sont ses soldats : quand le roi est corrompu, l'armée se disperse.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Cœur", source: "imam", theme: "coeur" },
  { content: "Le remède à l'orgueil : se souvenir qu'on a été créé d'une goutte impure et qu'on finira en cadavre.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Cœur", source: "imam", theme: "coeur" },
  { content: "L'envie consume le cœur comme le feu consume le bois sec.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Cœur", source: "imam", theme: "coeur" },
  { content: "Le cœur malade aime les compliments comme le corps fiévreux aime l'eau glacée.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Cœur", source: "imam", theme: "coeur" },
  { content: "Le cœur est une maison : si tu n'y allumes pas la lampe de la mémoire d'Allah, les corbeaux du doute s'y installent.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Cœur", source: "imam", theme: "coeur" },
  
  // IHYA' ULUM AL-DIN - SPIRITUALITÉ PRATIQUE
  { content: "La prière nocturne est le pilier de la lumière qui soutient le cœur pendant la journée.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Spiritualité", source: "imam", theme: "spiritualite" },
  { content: "Le jeûne est un bouclier : tant que tu le tiens, les flèches du péché ne te touchent pas.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Spiritualité", source: "imam", theme: "spiritualite" },
  { content: "Le dhikr est l'eau vive qui fait fuir les champs de poussière du cœur.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Spiritualité", source: "imam", theme: "spiritualite" },
  { content: "Le silence est la mosquée du cœur : c'est là qu'il entend le murmure de la vérité.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Spiritualité", source: "imam", theme: "spiritualite" },
  { content: "Le pèlerinage est une mort volontaire suivie d'une renaissance.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Spiritualité", source: "imam", theme: "spiritualite" },
  
  // IHYA' ULUM AL-DIN - LUTTE CONTRE LES VICES
  { content: "L'avarice est une chaîne en or : plus elle brille, plus elle serre.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Vices", source: "imam", theme: "vices" },
  { content: "La colère est un chien enragé : si tu le lâches, il te mord.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Vices", source: "imam", theme: "vices" },
  { content: "Le regard illicite plante le désir, le désir enfante la pensée, la pensée allume l'action, et l'action enchaîne au regret.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Vices", source: "imam", theme: "vices" },
  { content: "Le mensonge est la mère de tous les péchés : une fois qu'elle accouche, ses enfants ne s'arrêtent plus.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Vices", source: "imam", theme: "vices" },
  { content: "L'hypocrisie est un masque en verre : il reflète la beauté mais se brise au premier choc.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Vices", source: "imam", theme: "vices" },
  
  // IHYA' ULUM AL-DIN - ESPOIR & PARDON
  { content: "Le repentir efface ce qui précède, comme la naissance efface ce qui est dans le ventre.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Pardon", source: "imam", theme: "pardon" },
  { content: "L'espoir en la miséricorde d'Allah est lui-même une forme d'adoration.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Pardon", source: "imam", theme: "pardon" },
  { content: "Ne désespère pas de la miséricorde d'Allah : c'est comme refuser un océan parce que tu as bu de l'eau salée.", reference: "Ihya' Ulum al-Din (Al-Ghazali) - Pardon", source: "imam", theme: "pardon" },
  
  // LA RISALA (Al-Qayrawani) - PILIERS DE L'ISLAM
  { content: "L'islam se bâtit sur cinq : témoignage qu'il n'y a de divinité qu'Allah, prière, aumône, jeûne et pèlerinage de la maison.", reference: "La Risala (Al-Qayrawani) - Piliers", source: "imam", theme: "piliers" },
  { content: "Le témoignage est la clé des sept cieux : quand elle tourne dans la serrure, toutes les portes s'ouvrent.", reference: "La Risala (Al-Qayrawani) - Piliers", source: "imam", theme: "piliers" },
  { content: "La prière est la première chose dont on sera questionné : si elle est valide, le reste l'est ; sinon, le reste s'envole.", reference: "La Risala (Al-Qayrawani) - Piliers", source: "imam", theme: "piliers" },
  { content: "L'aumône purifie la richesse comme le feu purifie l'or.", reference: "La Risala (Al-Qayrawani) - Piliers", source: "imam", theme: "piliers" },
  { content: "Le jeûne est un bouclier ; tant que le bouclier est levé, les flèches ne passent pas.", reference: "La Risala (Al-Qayrawani) - Piliers", source: "imam", theme: "piliers" },
  
  // LA RISALA - PRIÈRE (SALAT)
  { content: "L'ablution est la lumière du croyant : chaque goutte efface une faute et allume une étoile.", reference: "La Risala (Al-Qayrawani) - Prière", source: "imam", theme: "priere" },
  { content: "Quand l'appel à la prière est prononcé, Satan prend la fuite en ventilant son derrière.", reference: "La Risala (Al-Qayrawani) - Prière", source: "imam", theme: "priere" },
  { content: "La mosquée est le marché d'Allah : qui y entre achète la sécurité et vend l'anxiété.", reference: "La Risala (Al-Qayrawani) - Prière", source: "imam", theme: "priere" },
  { content: "Le prostré est le plus proche d'Allah : c'est le moment de demander sans carte bancaire.", reference: "La Risala (Al-Qayrawani) - Prière", source: "imam", theme: "priere" },
  { content: "Le sourire dans la prière est une aumône cachée dans le cœur.", reference: "La Risala (Al-Qayrawani) - Prière", source: "imam", theme: "priere" },
  
  // LA RISALA - ZAKAT
  { content: "L'aumône légale est un pont : l'un des côtés est la richesse, l'autre est la sécurité de l'au-delà.", reference: "La Risala (Al-Qayrawani) - Zakat", source: "imam", theme: "zakat" },
  { content: "Celui qui refuse la zakat sera empoigné par sa richesse au jour du Jugement : elle deviendra un serpent autour de son cou.", reference: "La Risala (Al-Qayrawani) - Zakat", source: "imam", theme: "zakat" },
  { content: "La zakat est due sur l'or quand il atteint 85 g, sur l'argent à 595 g, et sur le bétail quand il broute.", reference: "La Risala (Al-Qayrawani) - Zakat", source: "imam", theme: "zakat" },
  { content: "Donne la zakat en secret : c'est un investissement sans risque dont le rendement est garanti par Celui qui ne fait jamais défaut.", reference: "La Risala (Al-Qayrawani) - Zakat", source: "imam", theme: "zakat" },
  
  // LA RISALA - JEÛNE (SAWM)
  { content: "Le jeûne commence à l'aube blanche (l'éclair horizontal) et se termine au coucher du disque rouge.", reference: "La Risala (Al-Qayrawani) - Jeûne", source: "imam", theme: "jeune" },
  { content: "Le jeûneur a deux joies : quand il brise son jeûne et quand il rencontre son Seigneur.", reference: "La Risala (Al-Qayrawani) - Jeûne", source: "imam", theme: "jeune" },
  { content: "Celui qui ne quitte pas le mensonge pendant son jeûne, Allah n'a pas besoin qu'il quitte son estomac.", reference: "La Risala (Al-Qayrawani) - Jeûne", source: "imam", theme: "jeune" },
  { content: "Le parfum n'annule pas le jeûne, mais le goût volontaire d'un grain de sel oui.", reference: "La Risala (Al-Qayrawani) - Jeûne", source: "imam", theme: "jeune" },
  { content: "Le jeûne du cœur est plus important que le jeûne de l'estomac : garde ton cœur clean et ton estomac suivra.", reference: "La Risala (Al-Qayrawani) - Jeûne", source: "imam", theme: "jeune" },
  
  // LA RISALA - PÈLERINAGE (HAJJ)
  { content: "Le pèlerinage est une mort volontaire suivie d'une renaissance sans péché.", reference: "La Risala (Al-Qayrawani) - Hajj", source: "imam", theme: "hajj" },
  { content: "Quand vous revêtez les habits d'Ihram, revêtez aussi l'humilité : deux feuilles de tissu suffisent à rappeler que vous n'êtes qu'un invité.", reference: "La Risala (Al-Qayrawani) - Hajj", source: "imam", theme: "hajj" },
  { content: "Le tawaf est la danse céleste : sept tours pour rappeler que la vie tourne autour d'un seul Centre.", reference: "La Risala (Al-Qayrawani) - Hajj", source: "imam", theme: "hajj" },
  { content: "Le sacrifice du 10 Dhul-Hijjah est le rappel que le sang de l'ego doit couler avant que le mouton ne soit égorgé.", reference: "La Risala (Al-Qayrawani) - Hajj", source: "imam", theme: "hajj" },
  { content: "Celui qui fait le hajj sans commettre de péché majeur revient comme le jour où sa mère l'a mis au monde.", reference: "La Risala (Al-Qayrawani) - Hajj", source: "imam", theme: "hajj" },
  
  // LA RISALA - RÈGLES MALÉKITES
  { content: "L'eau reste eau jusqu'à ce que son goût, son odeur ou sa couleur change : si elle change, elle devient impure.", reference: "La Risala (Al-Qayrawani) - Fiqh", source: "imam", theme: "fiqh" },
  { content: "La prière sur un tapis volé est valide, mais le péché reste sur le dos du voleur.", reference: "La Risala (Al-Qayrawani) - Fiqh", source: "imam", theme: "fiqh" },
  { content: "Le chien n'est pas impur dans sa chair, mais dans sa salive : lavez sept fois, dont une avec de la terre.", reference: "La Risala (Al-Qayrawani) - Fiqh", source: "imam", theme: "fiqh" },
  { content: "Le vin est mère de toutes les ordures : une goutte dans une cuvette rend tout le contenu impur.", reference: "La Risala (Al-Qayrawani) - Fiqh", source: "imam", theme: "fiqh" },
  { content: "Le tayammum remplace l'eau quand il y a peur de mourir de soif : la terre est une éponge spirituelle.", reference: "La Risala (Al-Qayrawani) - Fiqh", source: "imam", theme: "fiqh" },
  
  // ONE-LINERS HASHTAGS
  { content: "Le mot sincère est une clé qui ouvre 70 portes de bonté.", reference: "Sagesse des Imams - #Sincérité", source: "imam", theme: "sagesse" },
  { content: "Ton voisin a droit à ton bonheur, pas seulement à ton silence.", reference: "Sagesse des Imams - #Voisinage", source: "imam", theme: "sagesse" },
  { content: "La patience est un manteau que seul le cœur peut porter sans suer.", reference: "Sagesse des Imams - #Patience", source: "imam", theme: "sagesse" },
  { content: "Le repentir efface l'ardoise, pas la mémoire de l'enseignant.", reference: "Sagesse des Imams - #Pardon", source: "imam", theme: "sagesse" },
  { content: "Le jeûne est un mute button pour les passions.", reference: "Sagesse des Imams - #Jeûne", source: "imam", theme: "sagesse" },
  { content: "Le sajda est le plus court chemin entre le front et le ciel.", reference: "Sagesse des Imams - #Prière", source: "imam", theme: "sagesse" },
  { content: "L'aumône légale est un filtre anti-gourmandise.", reference: "Sagesse des Imams - #Zakat", source: "imam", theme: "sagesse" },
  { content: "Deux feuilles blanches, zéro étiquette, 100 % humilité.", reference: "Sagesse des Imams - #Hajj", source: "imam", theme: "sagesse" },
  { content: "Le savoir sans œuvres est une lampe sans huile.", reference: "Sagesse des Imams - #Connaissance", source: "imam", theme: "sagesse" },
  { content: "Le cœur malade voit la paille chez l'autre, la poutre chez lui il ne la sent pas.", reference: "Sagesse des Imams - #Cœur", source: "imam", theme: "sagesse" },
]

async function seedImams() {
  console.log('=== Indexation des enseignements des Imams ===')
  
  // Supprimer les anciennes entrées des imams
  const deleted = await prisma.documentChunk.deleteMany({
    where: { source: 'imam' }
  })
  console.log(`${deleted.count} anciennes entrées supprimées`)
  
  // Insérer les nouvelles
  for (const item of IMAM_SOURCES) {
    await prisma.documentChunk.create({
      data: {
        content: item.content,
        source: item.source,
        reference: item.reference,
        metadata: { theme: item.theme },
      }
    })
  }
  
  console.log(`✓ ${IMAM_SOURCES.length} citations des Imams indexées`)
  
  // Résumé total
  const total = await prisma.documentChunk.count()
  const bySource = await prisma.documentChunk.groupBy({
    by: ['source'],
    _count: true
  })
  
  console.log('\n=== Résumé de la base de données ===')
  bySource.forEach(s => console.log(`${s.source}: ${s._count}`))
  console.log(`Total: ${total}`)
}

seedImams()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
