'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Book, Send, Users, Database, Shield, FileText, 
  AlertTriangle, Key, UserCheck, ChevronDown, ChevronRight,
  Copy, Check, ExternalLink
} from 'lucide-react'

interface ApiDoc {
  openapi: string
  info: {
    title: string
    version: string
    description: string
    contact: { name: string; email: string }
  }
  endpoints: Record<string, Record<string, Record<string, unknown>>>
  errors: Record<string, { description: string }>
}

export default function DocsPage() {
  const [docs, setDocs] = useState<ApiDoc | null>(null)
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set())
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  
  useEffect(() => {
    fetch('/api/docs')
      .then(res => res.json())
      .then(setDocs)
      .catch(console.error)
  }, [])
  
  const toggleEndpoint = (key: string) => {
    const newSet = new Set(expandedEndpoints)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedEndpoints(newSet)
  }
  
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'chat': return <Send className="w-5 h-5" />
      case 'session': return <Users className="w-5 h-5" />
      case 'ingest': return <Database className="w-5 h-5" />
      case 'admin': return <Shield className="w-5 h-5" />
      case 'escalate': return <AlertTriangle className="w-5 h-5" />
      case 'auth': return <Key className="w-5 h-5" />
      case 'gdpr': return <UserCheck className="w-5 h-5" />
      default: return <FileText className="w-5 h-5" />
    }
  }
  
  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'POST': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'PATCH': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'DELETE': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }
  
  if (!docs) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Book className="w-10 h-10" />
            <h1 className="text-3xl font-bold">{docs.info.title}</h1>
          </div>
          <p className="text-teal-100 text-lg max-w-3xl">
            {docs.info.description}
          </p>
          <div className="flex items-center gap-4 mt-6">
            <Badge variant="outline" className="bg-white/10 text-white border-white/30">
              Version {docs.info.version}
            </Badge>
            <Badge variant="outline" className="bg-white/10 text-white border-white/30">
              OpenAPI {docs.openapi}
            </Badge>
          </div>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto py-8 px-4">
        {/* Base URL */}
        <Card className="p-6 mb-8 bg-white">
          <h2 className="font-semibold text-gray-900 mb-3">Base URL</h2>
          <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-lg font-mono text-sm">
            <code className="flex-1">https://sia2026.abacusai.app</code>
            <button
              onClick={() => copyToClipboard('https://sia2026.abacusai.app', 'base')}
              className="p-2 hover:bg-gray-200 rounded"
            >
              {copiedCode === 'base' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
            </button>
          </div>
        </Card>
        
        {/* Authentication */}
        <Card className="p-6 mb-8 bg-white">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-teal-600" />
            Authentification
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">Bearer Token</h3>
              <code className="text-sm bg-blue-100 px-2 py-1 rounded">Authorization: Bearer sia_xxx...</code>
              <p className="text-sm text-blue-700 mt-2">Token API avec permissions (read, write, admin)</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h3 className="font-medium text-amber-900 mb-2">Admin Secret</h3>
              <code className="text-sm bg-amber-100 px-2 py-1 rounded">x-admin-secret: YOUR_SECRET</code>
              <p className="text-sm text-amber-700 mt-2">Pour les opérations sensibles (création de tokens, RGPD)</p>
            </div>
          </div>
        </Card>
        
        {/* Endpoints */}
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Endpoints</h2>
        
        {Object.entries(docs.endpoints).map(([category, endpoints]) => (
          <div key={category} className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 capitalize">
              {getCategoryIcon(category)}
              {category}
            </h3>
            
            {Object.entries(endpoints).map(([path, methods]) => (
              <Card key={path} className="mb-4 bg-white overflow-hidden">
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                  onClick={() => toggleEndpoint(path)}
                >
                  <div className="flex items-center gap-3">
                    <code className="font-mono text-sm bg-gray-100 px-3 py-1 rounded">{path}</code>
                    <div className="flex gap-2">
                      {Object.keys(methods).map(method => (
                        <Badge key={method} variant="outline" className={getMethodColor(method)}>
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {expandedEndpoints.has(path) 
                    ? <ChevronDown className="w-5 h-5 text-gray-500" />
                    : <ChevronRight className="w-5 h-5 text-gray-500" />
                  }
                </div>
                
                {expandedEndpoints.has(path) && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    {Object.entries(methods).map(([method, details]: [string, any]) => (
                      <div key={method} className="mb-6 last:mb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={getMethodColor(method)}>
                            {method}
                          </Badge>
                          <span className="font-medium text-gray-900">{details.summary}</span>
                        </div>
                        
                        {details.description && (
                          <p className="text-gray-600 text-sm mb-3">{details.description}</p>
                        )}
                        
                        {details.authentication && (
                          <div className="text-sm text-gray-500 mb-3">
                            <strong>Auth:</strong> {details.authentication}
                          </div>
                        )}
                        
                        {details.parameters && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Paramètres</h4>
                            <div className="bg-white rounded border p-3">
                              {Object.entries(details.parameters).map(([param, info]: [string, any]) => (
                                <div key={param} className="flex items-start gap-2 mb-2 last:mb-0">
                                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">{param}</code>
                                  <span className="text-sm text-gray-600">
                                    ({info.type})
                                    {info.required && <span className="text-red-500 ml-1">*</span>}
                                    {info.description && ` - ${info.description}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {details.request?.body && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Corps de la requête</h4>
                            <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                              {JSON.stringify(details.request.body, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {details.request?.example && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Exemple</h4>
                            <div className="relative">
                              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                                {JSON.stringify(details.request.example, null, 2)}
                              </pre>
                              <button
                                onClick={() => copyToClipboard(JSON.stringify(details.request.example, null, 2), `${path}-${method}`)}
                                className="absolute top-2 right-2 p-1 bg-gray-700 rounded hover:bg-gray-600"
                              >
                                {copiedCode === `${path}-${method}` 
                                  ? <Check className="w-4 h-4 text-emerald-400" />
                                  : <Copy className="w-4 h-4 text-gray-400" />
                                }
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        ))}
        
        {/* Error Codes */}
        <Card className="p-6 bg-white">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Codes d'erreur
          </h2>
          <div className="space-y-2">
            {Object.entries(docs.errors).map(([code, info]) => (
              <div key={code} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                <Badge variant="outline" className={
                  code.startsWith('4') ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'
                }>
                  {code}
                </Badge>
                <span className="text-gray-700">{info.description}</span>
              </div>
            ))}
          </div>
        </Card>
        
        {/* Footer */}
        <div className="text-center text-gray-500 text-sm mt-8">
          <p>Contact: {docs.info.contact.email}</p>
          <a 
            href="/" 
            className="inline-flex items-center gap-1 text-teal-600 hover:underline mt-2"
          >
            Retour au chatbot <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </main>
    </div>
  )
}
