'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, BookOpen, Shield, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatResponse } from '@/lib/types'

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
  metadata?: {
    processing_time_ms: number
    sources_searched: number
    sources_selected: number
  }
}

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

function isArabicText(text: string): boolean {
  const arabicChars = (text.match(new RegExp(ARABIC_REGEX.source, 'g')) || []).length
  return arabicChars > text.length * 0.3
}

function renderContent(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return <br key={i} />

    if (isArabicText(trimmed)) {
      return (
        <div key={i} className="arabic-text my-3 p-4 bg-muted/50 rounded-lg border border-border">
          {trimmed}
        </div>
      )
    }

    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      return (
        <p key={i} className="font-semibold text-primary mt-3 mb-1">
          {trimmed.replace(/\*\*/g, '')}
        </p>
      )
    }

    if (trimmed.startsWith('---')) {
      return <Separator key={i} className="my-3" />
    }

    if (trimmed.startsWith('«') || trimmed.startsWith('"')) {
      return (
        <p key={i} className="italic text-foreground/80 pl-3 border-l-2 border-accent my-1">
          {trimmed}
        </p>
      )
    }

    if (trimmed.startsWith('Traduction')) {
      return (
        <p key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-primary/30 my-1">
          {trimmed}
        </p>
      )
    }

    return <p key={i} className="my-1">{trimmed}</p>
  })
}

function getSourceBadgeVariant(type: string): string {
  switch (type) {
    case 'coran': return 'bg-primary/10 text-primary border-primary/20'
    case 'hadith': return 'bg-accent/10 text-accent border-accent/20'
    default: return 'bg-secondary text-secondary-foreground border-secondary'
  }
}

function getSourceLabel(type: string): string {
  switch (type) {
    case 'coran': return 'Coran'
    case 'hadith': return 'Hadith'
    default: return 'Imam'
  }
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
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
        body: JSON.stringify({ message: input }),
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

                setMessages(prev => {
                  const updated = [...prev]
                  const lastMsg = updated[updated.length - 1]
                  if (lastMsg) {
                    lastMsg.content = result.response_text || ''
                    lastMsg.sources = result.sources || []
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
            } catch {
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

  const exampleQuestions = [
    'Que disent les sources sur la patience ?',
    'Bon comportement avec les parents',
    "Que dit l'Islam sur la colère ?",
    'Purifier son cœur (Al-Ghazali)',
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">SIA</h1>
                <p className="text-sm text-muted-foreground">Sources Islamiques Authentiques</p>
                <p className="text-xs text-accent font-medium">Version Alpha</p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                onClick={handleNewQuestion}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Nouvelle question
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome Screen */}
        {messages?.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 space-y-6"
          >
            {/* Sources disponibles */}
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Sources authentiques indexées
                </h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full" />
                    <span><strong>6 236</strong> versets du Coran</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-accent rounded-full" />
                    <span><strong>37</strong> Hadiths du Prophète</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                    <span>Riyad as-Salihin (An-Nawawi)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                    <span>Al-Adab al-Mufrad (Al-Bukhari)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                    <span>Ihya&apos; Ulum al-Din (Al-Ghazali)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                    <span>La Risala (Al-Qayrawani)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Garanties */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground mb-2">Garanties de neutralité absolue</h2>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-accent mt-0.5">-</span>
                        <span><strong className="text-foreground">Aucune opinion personnelle</strong> — Citations uniquement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-accent mt-0.5">-</span>
                        <span><strong className="text-foreground">Références exactes</strong> — Sourate/Verset, Hadith, Ouvrage</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-accent mt-0.5">-</span>
                        <span><strong className="text-foreground">Pas d&apos;interprétation</strong> — Les textes parlent d&apos;eux-mêmes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-accent mt-0.5">-</span>
                        <span><strong className="text-foreground">Conforme aux Imams</strong> — An-Nawawi, Al-Bukhari, Al-Ghazali</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exemples de questions */}
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-4">Exemples de questions :</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {exampleQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-left p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all text-sm text-foreground"
                  >
                    {q}
                  </button>
                ))}
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
                <Card className={`max-w-[85%] ${message?.role === 'user'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border shadow-md'
                }`}>
                  <CardContent className="p-4">
                    {message?.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{message?.content}</p>
                    ) : (
                      <div className="chat-response text-sm leading-relaxed">
                        {renderContent(message?.content || '')}
                      </div>
                    )}

                    {/* Processing time */}
                    {message?.role === 'assistant' && message?.metadata?.processing_time_ms && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <Badge variant="secondary" className="text-xs">
                          {(message.metadata.processing_time_ms / 1000).toFixed(1)}s — {message.metadata.sources_searched?.toLocaleString()} sources consultées
                        </Badge>
                      </div>
                    )}

                    {/* Sources */}
                    {message?.sources && message.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          Sources citées ({message.sources.length})
                        </p>
                        <div className="space-y-2">
                          {message?.sources?.map((source, idx) => (
                            <div key={source.id || idx} className="bg-muted/50 rounded-lg p-3 text-xs border border-border">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-foreground">{source?.reference}</p>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSourceBadgeVariant(source.source_type)}`}>
                                  {getSourceLabel(source.source_type)}
                                </span>
                              </div>
                              {isArabicText(source?.snippet || '') ? (
                                <div className="arabic-text text-base leading-relaxed text-foreground/80">
                                  {source?.snippet?.substring(0, 200)}
                                </div>
                              ) : (
                                <p className="text-muted-foreground italic">
                                  &laquo; {source?.snippet?.substring(0, 200)}... &raquo;
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading state */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm">Recherche dans les sources...</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-4 pb-6 px-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e?.target?.value || '')}
                placeholder="Posez votre question sur le Coran ou les Hadiths..."
                className="flex-1 shadow-lg"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={!input?.trim() || isLoading}
                className="shadow-lg"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-xs text-muted-foreground">
        <p>Sources : Coran (arabe + traduction Rachid Maach) — Sahih Al-Boukhari — Riyad as-Salihin — Al-Ghazali — La Risala</p>
      </footer>
    </div>
  )
}
