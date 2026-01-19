'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, BookOpen, Shield, RefreshCw, AlertTriangle, User, Sparkles, X, Phone, Mail, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatResponse, IntentType } from '@/lib/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{
    id: string
    score: number
    snippet: string
    reference: string
    source_type: 'coran' | 'hadith' | 'imam'
  }>
  intent?: IntentType
  confidence?: number
  session_id?: string
  needsEscalation?: boolean
  metadata?: {
    processing_time_ms: number
    sources_searched: number
    sources_selected: number
  }
}

// Mapping des intentions vers des labels lisibles
const INTENT_LABELS: Record<IntentType, string> = {
  question_religious: 'Question religieuse',
  search_verse: 'Recherche de verset',
  search_hadith: 'Recherche de hadith',
  explanation_request: 'Demande d\'explication',
  greeting: 'Salutation',
  escalate: 'Demande d\'assistance',
  out_of_scope: 'Hors sujet',
  unknown: 'Non déterminé'
}

// Couleur du badge de confiance
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (confidence >= 0.4) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turnCount, setTurnCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleNewQuestion = () => {
    setMessages([])
    setInput('')
    setSessionId(null)
    setTurnCount(0)
  }

  const [showEscalationModal, setShowEscalationModal] = useState(false)
  const [escalationForm, setEscalationForm] = useState({
    name: '',
    email: '',
    phone: '',
    reason: '',
    urgency: 'medium' as 'low' | 'medium' | 'high',
    preferred_contact: 'email' as 'email' | 'phone'
  })
  const [escalationLoading, setEscalationLoading] = useState(false)
  const [escalationSuccess, setEscalationSuccess] = useState(false)

  const handleEscalation = () => {
    setShowEscalationModal(true)
  }

  const submitEscalation = async () => {
    if (!sessionId || !escalationForm.reason.trim()) return

    setEscalationLoading(true)
    try {
      const response = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_name: escalationForm.name,
          user_email: escalationForm.email,
          user_phone: escalationForm.phone,
          reason: escalationForm.reason,
          urgency: escalationForm.urgency,
          preferred_contact: escalationForm.preferred_contact
        })
      })

      if (response.ok) {
        setEscalationSuccess(true)
        setTimeout(() => {
          setShowEscalationModal(false)
          setEscalationSuccess(false)
          setEscalationForm({
            name: '',
            email: '',
            phone: '',
            reason: '',
            urgency: 'medium',
            preferred_contact: 'email'
          })
        }, 3000)
      }
    } catch (error) {
      console.error('Erreur escalade:', error)
    } finally {
      setEscalationLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input?.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          session_id: sessionId
        }),
      })

      if (!response?.ok) {
        throw new Error('Erreur lors de la requête')
      }

      const reader = response?.body?.getReader()
      const decoder = new TextDecoder()
      let partialRead = ''

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        sources: [],
      }

      setMessages(prev => [...prev, assistantMessage])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        partialRead += decoder.decode(value, { stream: true })
        let lines = partialRead.split('\n')
        partialRead = lines.pop() || ''

        for (const line of lines) {
          if (line?.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              break
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed?.status === 'completed' && parsed?.result) {
                const result: ChatResponse = parsed.result

                // Mettre à jour le session ID et le compteur de tours
                if (result.session_id) {
                  if (!sessionId) {
                    setSessionId(result.session_id)
                  }
                  setTurnCount(prev => prev + 1)
                }

                // Vérifier si escalade nécessaire
                const needsEscalation = result.actions?.some(a => a.type === 'human_handoff')

                setMessages(prev => {
                  const updated = [...prev]
                  const lastMsg = updated[updated.length - 1]
                  if (lastMsg) {
                    lastMsg.content = result.response_text || ''
                    lastMsg.sources = result.sources || []
                    lastMsg.intent = result.intent
                    lastMsg.confidence = result.confidence
                    lastMsg.session_id = result.session_id
                    lastMsg.needsEscalation = needsEscalation
                    lastMsg.metadata = result.metadata ? {
                      processing_time_ms: result.metadata.processing_time_ms,
                      sources_searched: result.metadata.sources_searched,
                      sources_selected: result.metadata.sources_selected
                    } : undefined
                  }
                  return updated
                })
                break
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-teal-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-teal-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">SIA</h1>
                <p className="text-sm text-gray-600">Sources Islamiques Authentiques</p>
                <p className="text-xs text-amber-600 font-medium">Version Alpha - En cours d&apos;essais et de validation par les institutions en vigueur</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sessionId && (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    Session: {sessionId.slice(0, 8)}...
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
                    {turnCount} tour{turnCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {messages.length > 0 && (
                <Button
                  onClick={handleNewQuestion}
                  variant="outline"
                  className="flex items-center gap-2 border-teal-300 text-teal-700 hover:bg-teal-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Nouvelle question
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Info Banner */}
        {messages?.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 space-y-6"
          >
            {/* Sources disponibles */}
            <Card className="p-6 bg-gradient-to-r from-teal-50 to-amber-50 border-teal-200">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-teal-600" />
                Sources authentiques indexées
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                  <span><strong>6 236</strong> versets du Coran</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  <span><strong>37</strong> Hadiths du Prophète ﷺ</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span>Riyad as-Salihin (An-Nawawi)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span>Al-Adab al-Mufrad (Al-Bukhari)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span>Ihya&apos; Ulum al-Din (Al-Ghazali)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span>La Risala (Al-Qayrawani)</span>
                </div>
              </div>
            </Card>

            {/* Garanties */}
            <Card className="p-6 bg-white border-gray-200">
              <div className="flex items-start gap-4">
                <Shield className="w-6 h-6 text-teal-600 mt-1 flex-shrink-0" />
                <div>
                  <h2 className="font-semibold text-gray-900 mb-2">Garanties de neutralité absolue</h2>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>✓ <strong>Aucune opinion personnelle</strong> - Citations uniquement</li>
                    <li>✓ <strong>Références exactes</strong> - Sourate/Verset, Hadith, Ouvrage</li>
                    <li>✓ <strong>Pas d&apos;interprétation</strong> - Les textes parlent d&apos;eux-mêmes</li>
                    <li>✓ <strong>Conforme aux Imams</strong> - An-Nawawi, Al-Bukhari, Al-Ghazali</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Exemples de questions */}
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-4">Exemples de questions :</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => setInput("Que disent les sources sur la patience ?")}
                  className="text-left p-3 rounded-lg bg-white border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all text-sm"
                >
                  Que disent les sources sur la patience ?
                </button>
                <button
                  onClick={() => setInput("Enseignements sur le bon comportement avec les parents")}
                  className="text-left p-3 rounded-lg bg-white border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all text-sm"
                >
                  Bon comportement avec les parents
                </button>
                <button
                  onClick={() => setInput("Que dit l'Islam sur la colère ?")}
                  className="text-left p-3 rounded-lg bg-white border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all text-sm"
                >
                  Que dit l&apos;Islam sur la colère ?
                </button>
                <button
                  onClick={() => setInput("Comment purifier son cœur selon Al-Ghazali ?")}
                  className="text-left p-3 rounded-lg bg-white border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all text-sm"
                >
                  Purifier son cœur (Al-Ghazali)
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Messages */}
        <div className="space-y-4 mb-24">
          <AnimatePresence>
            {messages?.map((message) => (
              <motion.div
                key={message?.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${message?.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card className={`max-w-[85%] p-4 ${message?.role === 'user'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white border-gray-200 shadow-md'
                  }`}>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap m-0">{message?.content}</p>
                  </div>

                  {/* Métadonnées de la réponse */}
                  {message?.role === 'assistant' && message?.confidence !== undefined && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                      {/* Badge de confiance */}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(message.confidence)}`}>
                        <Sparkles className="w-3 h-3" />
                        Confiance: {Math.round(message.confidence * 100)}%
                      </span>

                      {/* Badge d'intention */}
                      {message.intent && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          {INTENT_LABELS[message.intent] || message.intent}
                        </span>
                      )}

                      {/* Badge temps de traitement */}
                      {message.metadata?.processing_time_ms && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
                          {(message.metadata.processing_time_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  )}

                  {/* Alerte escalade humaine */}
                  {message?.needsEscalation && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Confiance faible - Escalade recommandée</span>
                      </div>
                      <Button
                        onClick={handleEscalation}
                        variant="outline"
                        size="sm"
                        className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                      >
                        <User className="w-4 h-4 mr-1" />
                        Contacter un spécialiste
                      </Button>
                    </div>
                  )}

                  {/* Sources citées */}
                  {message?.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        Sources citées ({message.sources.length}) :
                      </p>
                      <div className="space-y-2">
                        {message?.sources?.map((source, idx) => (
                          <div key={source.id || idx} className="bg-amber-50 rounded p-2 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-semibold text-teal-700">{source?.reference}</p>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${source.source_type === 'coran' ? 'bg-teal-100 text-teal-700' :
                                  source.source_type === 'hadith' ? 'bg-amber-100 text-amber-700' :
                                    'bg-emerald-100 text-emerald-700'
                                }`}>
                                {source.source_type === 'coran' ? 'Coran' :
                                  source.source_type === 'hadith' ? 'Hadith' : 'Imam'}
                              </span>
                            </div>
                            <p className="text-gray-600 italic">"{source?.snippet?.substring(0, 150)}..."</p>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1">
                                <div
                                  className="bg-teal-500 h-1 rounded-full"
                                  style={{ width: `${source.score * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{Math.round(source.score * 100)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <Card className="p-4 bg-white border-gray-200">
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm">Recherche dans les sources...</span>
                </div>
              </Card>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-4 pb-6 px-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e?.target?.value || '')}
                placeholder="Posez votre question sur le Coran ou les Hadiths..."
                className="flex-1 bg-white border-gray-300 focus:border-teal-500 focus:ring-teal-500 shadow-lg"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={!input?.trim() || isLoading}
                className="bg-teal-600 hover:bg-teal-700 shadow-lg"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </form>
        </div>
      </main>

      {/* Modal d'escalade */}
      <AnimatePresence>
        {showEscalationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !escalationLoading && setShowEscalationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {escalationSuccess ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Demande envoyée !</h3>
                  <p className="text-gray-600">Un spécialiste vous contactera dans les plus brefs délais.</p>
                </div>
              ) : (
                <>
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">Contacter un spécialiste</h3>
                        <p className="text-sm text-gray-600 mt-1">Un imam ou savant qualifié vous répondra</p>
                      </div>
                      <button
                        onClick={() => setShowEscalationModal(false)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Votre nom</label>
                      <Input
                        placeholder="Prénom Nom"
                        value={escalationForm.name}
                        onChange={e => setEscalationForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <Input
                          type="email"
                          placeholder="email@exemple.com"
                          value={escalationForm.email}
                          onChange={e => setEscalationForm(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                        <Input
                          type="tel"
                          placeholder="+33 6 12 34 56 78"
                          value={escalationForm.phone}
                          onChange={e => setEscalationForm(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mode de contact préféré</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="contact"
                            checked={escalationForm.preferred_contact === 'email'}
                            onChange={() => setEscalationForm(prev => ({ ...prev, preferred_contact: 'email' }))}
                            className="w-4 h-4 text-teal-600"
                          />
                          <Mail className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">Email</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="contact"
                            checked={escalationForm.preferred_contact === 'phone'}
                            onChange={() => setEscalationForm(prev => ({ ...prev, preferred_contact: 'phone' }))}
                            className="w-4 h-4 text-teal-600"
                          />
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">Téléphone</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Urgence</label>
                      <div className="flex gap-2">
                        {(['low', 'medium', 'high'] as const).map(level => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setEscalationForm(prev => ({ ...prev, urgency: level }))}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${escalationForm.urgency === level
                                ? level === 'low' ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500'
                                  : level === 'medium' ? 'bg-amber-100 text-amber-700 border-2 border-amber-500'
                                    : 'bg-red-100 text-red-700 border-2 border-red-500'
                                : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                              }`}
                          >
                            {level === 'low' ? 'Faible' : level === 'medium' ? 'Moyenne' : 'Élevée'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Décrivez votre demande <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        placeholder="Expliquez pourquoi vous souhaitez parler à un spécialiste..."
                        value={escalationForm.reason}
                        onChange={e => setEscalationForm(prev => ({ ...prev, reason: e.target.value }))}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                      />
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-200 flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowEscalationModal(false)}
                      className="flex-1"
                      disabled={escalationLoading}
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={submitEscalation}
                      disabled={!escalationForm.reason.trim() || escalationLoading}
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                    >
                      {escalationLoading ? 'Envoi...' : 'Envoyer la demande'}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer - Ouvrages de référence */}
      <footer className="mt-auto py-6 text-center text-xs text-gray-400">
        <p>Sources : Coran (arabe + traduction Rachid Maach) • Sahih Al-Boukhari • Riyad as-Salihin • Al-Ghazali • La Risala</p>
      </footer>
    </div>
  )
}
