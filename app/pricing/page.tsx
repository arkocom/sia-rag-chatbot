'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Star, Building2, Sparkles, MessageCircle } from 'lucide-react'

const plans = [
  {
    name: 'Gratuit',
    price: '0',
    period: '/mois',
    description: 'Découvrez SIA avec les fonctionnalités essentielles',
    icon: MessageCircle,
    features: [
      '10 questions par jour',
      'Coran + Hadiths majeurs',
      'Références de base',
      'Interface conversationnelle',
      'Publicités respectueuses'
    ],
    limitations: [
      'Historique limité à 7 jours',
      'Sources limitées'
    ],
    cta: 'Commencer gratuitement',
    ctaLink: '/',
    highlighted: false,
    badge: null
  },
  {
    name: 'Essentiel',
    price: '4,99',
    period: '/mois',
    yearlyPrice: '49,99€/an',
    yearlySaving: '2 mois offerts',
    description: 'Pour une utilisation quotidienne approfondie',
    icon: Star,
    features: [
      'Questions illimitées',
      'Toutes les sources authentiques',
      'Recherche avancée sémantique',
      'Sans publicité',
      'Historique complet',
      'Export conversations',
      'Support par email'
    ],
    limitations: [],
    cta: 'Essai gratuit 7 jours',
    ctaLink: '/signup?plan=essential',
    highlighted: true,
    badge: 'Populaire'
  },
  {
    name: 'Premium',
    price: '9,99',
    period: '/mois',
    yearlyPrice: '99,99€/an',
    yearlySaving: '2 mois offerts',
    description: 'Pour les chercheurs et étudiants en sciences islamiques',
    icon: Sparkles,
    features: [
      'Tout Essentiel +',
      'Analyse comparative des écoles',
      'Export PDF avec mise en page',
      'Accès API développeur',
      'Annotations personnelles',
      'Collections de sources',
      'Support prioritaire 24h'
    ],
    limitations: [],
    cta: 'Essai gratuit 7 jours',
    ctaLink: '/signup?plan=premium',
    highlighted: false,
    badge: null
  },
  {
    name: 'Institutionnel',
    price: 'Sur devis',
    period: '',
    description: 'Pour mosquées, universités et centres islamiques',
    icon: Building2,
    features: [
      'Tout Premium +',
      'Licences multi-utilisateurs',
      'Marque blanche personnalisable',
      'Dashboard administrateur',
      'Statistiques d\'utilisation',
      'Intégration LMS',
      'SLA 24/7 garanti',
      'Formation équipe incluse'
    ],
    limitations: [],
    cta: 'Nous contacter',
    ctaLink: '/contact?plan=institutional',
    highlighted: false,
    badge: 'Entreprise'
  }
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">س</span>
            </div>
            <div>
              <span className="font-bold text-xl text-gray-900">SIA</span>
              <span className="text-xs text-emerald-600 block -mt-1">Sources Islamiques Authentiques</span>
            </div>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-gray-600 hover:text-emerald-600 transition">Accueil</Link>
            <Link href="/docs" className="text-gray-600 hover:text-emerald-600 transition">Documentation</Link>
            <Link href="/pricing" className="text-emerald-600 font-medium">Tarifs</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Tarifs simples et transparents
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Accédez aux sources islamiques authentiques avec l'offre adaptée à vos besoins
        </p>

        {/* Toggle Mensuel/Annuel */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium ${!isYearly ? 'text-gray-900' : 'text-gray-500'}`}>Mensuel</span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              isYearly ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                isYearly ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${isYearly ? 'text-gray-900' : 'text-gray-500'}`}>
            Annuel <span className="text-emerald-600 font-bold">-17%</span>
          </span>
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-6 ${
                  plan.highlighted
                    ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200 scale-105'
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}
              >
                {plan.badge && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold rounded-full ${
                      plan.highlighted
                        ? 'bg-yellow-400 text-yellow-900'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {plan.badge}
                  </span>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      plan.highlighted ? 'bg-white/20' : 'bg-emerald-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${plan.highlighted ? 'text-white' : 'text-emerald-600'}`} />
                  </div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold">
                    {plan.price === 'Sur devis' ? '' : plan.price}
                    {plan.price !== 'Sur devis' && <span className="text-lg">€</span>}
                  </span>
                  {plan.price === 'Sur devis' ? (
                    <span className="text-lg font-medium">Sur devis</span>
                  ) : (
                    <span className={`text-sm ${plan.highlighted ? 'text-emerald-100' : 'text-gray-500'}`}>
                      {plan.period}
                    </span>
                  )}
                  {isYearly && plan.yearlyPrice && (
                    <div className={`text-sm mt-1 ${plan.highlighted ? 'text-emerald-100' : 'text-gray-500'}`}>
                      {plan.yearlyPrice}
                      <span className={`ml-2 font-medium ${plan.highlighted ? 'text-yellow-300' : 'text-emerald-600'}`}>
                        {plan.yearlySaving}
                      </span>
                    </div>
                  )}
                </div>

                <p className={`text-sm mb-6 ${plan.highlighted ? 'text-emerald-100' : 'text-gray-600'}`}>
                  {plan.description}
                </p>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          plan.highlighted ? 'text-emerald-200' : 'text-emerald-600'
                        }`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaLink}
                  className={`block w-full py-3 px-4 rounded-lg text-center font-medium transition ${
                    plan.highlighted
                      ? 'bg-white text-emerald-600 hover:bg-emerald-50'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center mb-8">Questions fréquentes</h2>
        <div className="space-y-4">
          <details className="bg-white rounded-lg p-4 border border-gray-200">
            <summary className="font-medium cursor-pointer">Puis-je annuler mon abonnement à tout moment ?</summary>
            <p className="mt-2 text-gray-600 text-sm">
              Oui, vous pouvez annuler votre abonnement à tout moment. Vous conserverez l'accès jusqu'à la fin de la période payée.
            </p>
          </details>
          <details className="bg-white rounded-lg p-4 border border-gray-200">
            <summary className="font-medium cursor-pointer">Les sources sont-elles validées par des savants ?</summary>
            <p className="mt-2 text-gray-600 text-sm">
              Oui, toutes nos sources proviennent d'ouvrages classiques reconnus (Sahih Al-Bukhari, Riyad as-Salihin, etc.) et sont en cours de validation par des institutions islamiques.
            </p>
          </details>
          <details className="bg-white rounded-lg p-4 border border-gray-200">
            <summary className="font-medium cursor-pointer">Quelle est la différence entre Essentiel et Premium ?</summary>
            <p className="mt-2 text-gray-600 text-sm">
              L'offre Premium ajoute l'analyse comparative des écoles juridiques, l'export PDF professionnel, et l'accès API pour les développeurs.
            </p>
          </details>
          <details className="bg-white rounded-lg p-4 border border-gray-200">
            <summary className="font-medium cursor-pointer">Proposez-vous des tarifs pour les étudiants ?</summary>
            <p className="mt-2 text-gray-600 text-sm">
              Oui, contactez-nous avec votre carte étudiant pour bénéficier de 50% de réduction sur les offres Essentiel et Premium.
            </p>
          </details>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-600 text-sm">
          <p>© 2026 SIA - Sources Islamiques Authentiques. Version Alpha.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link href="/" className="hover:text-emerald-600">Accueil</Link>
            <Link href="/docs" className="hover:text-emerald-600">API</Link>
            <Link href="/admin" className="hover:text-emerald-600">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
