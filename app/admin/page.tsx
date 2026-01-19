'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  BarChart3, Users, MessageSquare, FileText, AlertTriangle, 
  Clock, TrendingUp, RefreshCw, Database, Shield, Activity,
  CreditCard, Target, Zap, Crown, Lock, LogOut, Eye, EyeOff,
  X, Send, CheckCircle, XCircle, MessageCircle, User, Mail,
  ChevronDown, ChevronUp, Flag, Inbox
} from 'lucide-react'

const STORAGE_KEY = 'sia_admin_token'

interface QuotaStats {
  totalUsers: number
  activeToday: number
  byPlan: {
    plan: string
    count: number
    totalQueries: number
    dailyQueries: number
  }[]
}

interface AdminStats {
  documents: {
    total: number
    by_source: { source: string; count: number }[]
  }
  sessions: {
    total: number
    by_status: { status: string; count: number }[]
  }
  messages: {
    total: number
    by_day: Record<string, number>
  }
  confidence: {
    average: number
    min: number
    max: number
  }
  top_topics: { topic: string; count: number }[]
  generated_at: string
}

interface MetricsData {
  time_range: string
  total_requests: number
  total_chats: number
  error_count: number
  avg_response_time_ms: number
  intents: Record<string, number>
}

interface AdminNote {
  id: string
  content: string
  action: string
  createdBy: string
  createdAt: string
}

interface ChatMessage {
  id: string
  role: string
  content: string
  createdAt: string
}

interface Escalation {
  id: string
  status: string
  priority: string
  turnCount: number
  topics: string[]
  userEmail: string | null
  userIdentifier: string | null
  escalatedAt: string | null
  escalationReason: string | null
  assignedTo: string | null
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
  adminNotes: AdminNote[]
  messageCount: number
}

interface EscalationStats {
  byStatus: Record<string, number>
  byPriority: Record<string, number>
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [quotaStats, setQuotaStats] = useState<QuotaStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h')
  
  // États pour les escalades
  const [activeTab, setActiveTab] = useState<'dashboard' | 'escalations'>('dashboard')
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [escalationStats, setEscalationStats] = useState<EscalationStats | null>(null)
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null)
  const [escalationFilter, setEscalationFilter] = useState<string>('all')
  const [newNote, setNewNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  
  // Vérifier le token au chargement
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY)
    if (token) {
      // Vérifier si le token est toujours valide
      try {
        const decoded = JSON.parse(atob(token))
        if (decoded.authenticated && decoded.expiresAt > Date.now()) {
          setIsAuthenticated(true)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setAuthChecked(true)
  }, [])
  
  // Fonction de connexion
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        localStorage.setItem(STORAGE_KEY, data.token)
        setIsAuthenticated(true)
        setPassword('')
      } else {
        setAuthError(data.error || 'Erreur de connexion')
      }
    } catch {
      setAuthError('Erreur de connexion au serveur')
    } finally {
      setAuthLoading(false)
    }
  }
  
  // Fonction de déconnexion
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setIsAuthenticated(false)
    setStats(null)
    setMetrics(null)
    setQuotaStats(null)
  }
  
  // Récupération des données avec token
  const fetchData = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEY)
    if (!token) {
      setIsAuthenticated(false)
      return
    }
    
    setLoading(true)
    try {
      const headers = { 'x-admin-token': token }
      
      const [statsRes, metricsRes, quotaRes, escalationsRes] = await Promise.all([
        fetch('/api/admin?action=stats', { headers }),
        fetch(`/api/admin/metrics?range=${timeRange}`, { headers }),
        fetch('/api/admin/quotas', { headers }),
        fetch('/api/admin/escalations', { headers })
      ])
      
      // Si 401, déconnecter
      if (statsRes.status === 401 || metricsRes.status === 401 || quotaRes.status === 401) {
        handleLogout()
        return
      }
      
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }
      if (metricsRes.ok) {
        setMetrics(await metricsRes.json())
      }
      if (quotaRes.ok) {
        setQuotaStats(await quotaRes.json())
      }
      if (escalationsRes.ok) {
        const data = await escalationsRes.json()
        setEscalations(data.escalations || [])
        setEscalationStats(data.stats || null)
      }
    } catch (error) {
      console.error('Erreur chargement données admin:', error)
    } finally {
      setLoading(false)
    }
  }, [timeRange])
  
  // Mettre à jour une escalade
  const updateEscalation = async (id: string, updates: { status?: string; priority?: string; note?: string }) => {
    const token = localStorage.getItem(STORAGE_KEY)
    if (!token) return
    
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/escalations', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': token 
        },
        body: JSON.stringify({ id, ...updates })
      })
      
      if (res.ok) {
        await fetchData()
        if (selectedEscalation?.id === id) {
          const data = await res.json()
          setSelectedEscalation(data.escalation)
        }
      }
    } catch (error) {
      console.error('Erreur mise à jour escalade:', error)
    } finally {
      setActionLoading(false)
    }
  }
  
  // Ajouter une note
  const addNote = async () => {
    if (!selectedEscalation || !newNote.trim()) return
    
    const token = localStorage.getItem(STORAGE_KEY)
    if (!token) return
    
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/escalations/${selectedEscalation.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': token 
        },
        body: JSON.stringify({ content: newNote, action: 'note' })
      })
      
      if (res.ok) {
        setNewNote('')
        await fetchData()
        // Recharger l'escalade sélectionnée
        const escRes = await fetch(`/api/admin/escalations/${selectedEscalation.id}`, {
          headers: { 'x-admin-token': token }
        })
        if (escRes.ok) {
          const data = await escRes.json()
          setSelectedEscalation(data.escalation)
        }
      }
    } catch (error) {
      console.error('Erreur ajout note:', error)
    } finally {
      setActionLoading(false)
    }
  }
  
  // Fermer une escalade
  const closeEscalation = async (id: string) => {
    const token = localStorage.getItem(STORAGE_KEY)
    if (!token) return
    
    if (!confirm('Êtes-vous sûr de vouloir fermer cette escalade ?')) return
    
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/escalations/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token }
      })
      
      if (res.ok) {
        setSelectedEscalation(null)
        await fetchData()
      }
    } catch (error) {
      console.error('Erreur fermeture escalade:', error)
    } finally {
      setActionLoading(false)
    }
  }
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
      const interval = setInterval(fetchData, 60000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, fetchData])
  
  // Filtrer les escalades
  const filteredEscalations = escalations.filter(e => {
    if (escalationFilter === 'all') return true
    return e.status === escalationFilter
  })
  
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'coran': return '📖'
      case 'hadith': return '📜'
      case 'imam': return '📕'
      default: return '📄'
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700'
      case 'escalated': return 'bg-red-100 text-red-700'
      case 'in_progress': return 'bg-amber-100 text-amber-700'
      case 'resolved': return 'bg-blue-100 text-blue-700'
      case 'closed': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'escalated': return 'Nouvelle'
      case 'in_progress': return 'En cours'
      case 'resolved': return 'Résolue'
      case 'closed': return 'Fermée'
      default: return status
    }
  }
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'normal': return 'bg-blue-500 text-white'
      case 'low': return 'bg-gray-400 text-white'
      default: return 'bg-gray-400 text-white'
    }
  }
  
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return '🔴 Urgent'
      case 'high': return '🟠 Haute'
      case 'normal': return '🔵 Normale'
      case 'low': return '⚪ Basse'
      default: return priority
    }
  }
  
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Écran de chargement initial
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
      </div>
    )
  }
  
  // Écran de connexion
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 bg-white shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Administration SIA</h1>
            <p className="text-gray-500 mt-2">Accès sécurisé au tableau de bord</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe administrateur
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {authError}
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={authLoading || !password}
            >
              {authLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Se connecter
                </>
              )}
            </Button>
          </form>
          
          <p className="text-center text-xs text-gray-400 mt-6">
            Sources Islamiques Authentiques - v1.0
          </p>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-4 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-7 h-7" />
                Administration SIA
              </h1>
              <p className="text-teal-100 text-sm mt-1">Sources Islamiques Authentiques</p>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                onClick={fetchData} 
                variant="outline" 
                size="sm"
                className="border-teal-400 text-white hover:bg-teal-600"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              <Button 
                onClick={handleLogout} 
                variant="outline" 
                size="sm"
                className="border-red-400 text-white hover:bg-red-600 bg-red-500/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
          
          {/* Onglets */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-white text-teal-700'
                  : 'bg-teal-500/30 text-white hover:bg-teal-500/50'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('escalations')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'escalations'
                  ? 'bg-white text-teal-700'
                  : 'bg-teal-500/30 text-white hover:bg-teal-500/50'
              }`}
            >
              <Inbox className="w-4 h-4" />
              Escalades
              {escalationStats?.byStatus?.escalated ? (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {escalationStats.byStatus.escalated}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>
      
      {/* Contenu selon l'onglet actif */}
      {activeTab === 'dashboard' ? (
        <main className="max-w-7xl mx-auto py-8 px-4">
          {/* Sélecteur période */}
          <div className="flex justify-end mb-6">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="1h">Dernière heure</option>
              <option value="24h">24 heures</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
            </select>
          </div>
          
        {/* KPIs principaux */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Documents indexés</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats?.documents.total.toLocaleString() || '-'}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Sessions actives</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats?.sessions.by_status.find(s => s.status === 'active')?.count || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Messages totaux</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats?.messages.total.toLocaleString() || '-'}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Escalades en attente</p>
                <p className="text-3xl font-bold text-amber-600">
                  {stats?.sessions.by_status.find(s => s.status === 'escalated')?.count || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>
        </div>
        
        {/* Métriques Business SaaS */}
        {quotaStats && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-teal-600" />
              Métriques Business
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="p-6 bg-gradient-to-br from-blue-50 to-white border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Utilisateurs totaux</p>
                    <p className="text-3xl font-bold text-blue-700">
                      {quotaStats.totalUsers}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </Card>
              
              <Card className="p-6 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600 font-medium">Actifs aujourd'hui</p>
                    <p className="text-3xl font-bold text-emerald-700">
                      {quotaStats.activeToday}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </Card>
              
              <Card className="p-6 bg-gradient-to-br from-amber-50 to-white border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-600 font-medium">Plan Gratuit</p>
                    <p className="text-3xl font-bold text-amber-700">
                      {quotaStats.byPlan.find(p => p.plan === 'free')?.count || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                    <Target className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </Card>
              
              <Card className="p-6 bg-gradient-to-br from-purple-50 to-white border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Abonnés payants</p>
                    <p className="text-3xl font-bold text-purple-700">
                      {quotaStats.byPlan.filter(p => p.plan !== 'free').reduce((acc, p) => acc + p.count, 0)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Crown className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </Card>
            </div>
            
            {/* Détail par plan */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quotaStats.byPlan.map((planData) => (
                <Card key={planData.plan} className="p-4 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      planData.plan === 'free' ? 'bg-gray-100 text-gray-700' :
                      planData.plan === 'essential' ? 'bg-blue-100 text-blue-700' :
                      planData.plan === 'premium' ? 'bg-purple-100 text-purple-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {planData.plan.charAt(0).toUpperCase() + planData.plan.slice(1)}
                    </span>
                    <span className="text-lg font-bold">{planData.count}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    <p>Total requêtes: {planData.totalQueries.toLocaleString()}</p>
                    <p>Aujourd'hui: {planData.dailyQueries}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Métriques temps réel */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-gray-900">Temps de réponse moyen</h3>
              </div>
              <p className="text-4xl font-bold text-teal-600">
                {metrics.avg_response_time_ms}ms
              </p>
              <p className="text-sm text-gray-500 mt-1">sur {metrics.total_chats} interactions</p>
            </Card>
            
            <Card className="p-6 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Requêtes API</h3>
              </div>
              <p className="text-4xl font-bold text-blue-600">
                {metrics.total_requests}
              </p>
              <p className="text-sm text-gray-500 mt-1">période: {metrics.time_range}</p>
            </Card>
            
            <Card className="p-6 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-gray-900">Erreurs</h3>
              </div>
              <p className="text-4xl font-bold text-red-600">
                {metrics.error_count}
              </p>
              <p className="text-sm text-gray-500 mt-1">période: {metrics.time_range}</p>
            </Card>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Répartition des sources */}
          <Card className="p-6 bg-white">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              Répartition des sources
            </h3>
            <div className="space-y-4">
              {stats?.documents.by_source.map((source) => (
                <div key={source.source} className="flex items-center gap-4">
                  <span className="text-2xl">{getSourceIcon(source.source)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium capitalize">{source.source}</span>
                      <span className="text-gray-600">{source.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-teal-500 h-2 rounded-full transition-all"
                        style={{ 
                          width: `${(source.count / (stats?.documents.total || 1)) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          
          {/* Score de confiance */}
          <Card className="p-6 bg-white">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-600" />
              Score de confiance
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Minimum</p>
                <p className="text-2xl font-bold text-red-500">
                  {((stats?.confidence.min || 0) * 100).toFixed(0)}%
                </p>
              </div>
              <div className="text-center p-4 bg-teal-50 rounded-lg">
                <p className="text-sm text-gray-500">Moyenne</p>
                <p className="text-2xl font-bold text-teal-600">
                  {((stats?.confidence.average || 0) * 100).toFixed(0)}%
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Maximum</p>
                <p className="text-2xl font-bold text-emerald-500">
                  {((stats?.confidence.max || 0) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            
            {/* Top sujets */}
            <h4 className="font-medium text-gray-900 mt-6 mb-3">Top sujets abordés</h4>
            <div className="flex flex-wrap gap-2">
              {stats?.top_topics.slice(0, 8).map((topic) => (
                <span 
                  key={topic.topic}
                  className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm"
                >
                  {topic.topic} ({topic.count})
                </span>
              ))}
            </div>
          </Card>
          
          {/* Statut des sessions */}
          <Card className="p-6 bg-white">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              Statut des sessions
            </h3>
            <div className="space-y-3">
              {stats?.sessions.by_status.map((status) => (
                <div key={status.status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.status)}`}>
                    {status.status === 'active' ? 'Actives' 
                      : status.status === 'escalated' ? 'Escalées' 
                      : 'Fermées'}
                  </span>
                  <span className="text-2xl font-bold text-gray-900">{status.count}</span>
                </div>
              ))}
            </div>
          </Card>
          
          {/* Intentions détectées */}
          {metrics && Object.keys(metrics.intents).length > 0 && (
            <Card className="p-6 bg-white">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" />
                Intentions détectées
              </h3>
              <div className="space-y-2">
                {Object.entries(metrics.intents)
                  .sort((a, b) => b[1] - a[1])
                  .map(([intent, count]) => (
                    <div key={intent} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{intent.replace('_', ' ')}</span>
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
        
        {/* Dernière mise à jour */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Dernière mise à jour : {stats?.generated_at ? new Date(stats.generated_at).toLocaleString('fr-FR') : '-'}
        </p>
        </main>
      ) : (
        /* ==================== SECTION ESCALADES ==================== */
        <main className="max-w-7xl mx-auto py-8 px-4">
          {/* Stats escalades */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-sm text-red-600">Nouvelles</p>
                  <p className="text-2xl font-bold text-red-700">{escalationStats?.byStatus?.escalated || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="text-sm text-amber-600">En cours</p>
                  <p className="text-2xl font-bold text-amber-700">{escalationStats?.byStatus?.in_progress || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-blue-600">Résolues</p>
                  <p className="text-2xl font-bold text-blue-700">{escalationStats?.byStatus?.resolved || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-gray-50 border-gray-200">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Fermées</p>
                  <p className="text-2xl font-bold text-gray-700">{escalationStats?.byStatus?.closed || 0}</p>
                </div>
              </div>
            </Card>
          </div>
          
          {/* Filtres */}
          <div className="flex gap-2 mb-6">
            {['all', 'escalated', 'in_progress', 'resolved'].map((filter) => (
              <button
                key={filter}
                onClick={() => setEscalationFilter(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  escalationFilter === filter
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border'
                }`}
              >
                {filter === 'all' ? 'Toutes' : getStatusLabel(filter)}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liste des escalades */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Escalades ({filteredEscalations.length})
              </h2>
              
              {filteredEscalations.length === 0 ? (
                <Card className="p-8 text-center text-gray-500">
                  <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune escalade à afficher</p>
                </Card>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredEscalations.map((esc) => (
                    <Card
                      key={esc.id}
                      onClick={() => setSelectedEscalation(esc)}
                      className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                        selectedEscalation?.id === esc.id ? 'ring-2 ring-teal-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(esc.status)}`}>
                            {getStatusLabel(esc.status)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(esc.priority)}`}>
                            {getPriorityLabel(esc.priority)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {esc.escalatedAt ? formatDate(esc.escalatedAt) : formatDate(esc.createdAt)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                        {esc.messages[esc.messages.length - 1]?.content || 'Pas de message'}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {esc.messageCount} messages
                        </span>
                        {esc.userEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {esc.userEmail}
                          </span>
                        )}
                        {esc.topics.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Flag className="w-3 h-3" />
                            {esc.topics.slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            {/* Détail de l'escalade sélectionnée */}
            <div>
              {selectedEscalation ? (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Détail de l&apos;escalade</h2>
                    <button onClick={() => setSelectedEscalation(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Actions rapides */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <select
                      value={selectedEscalation.status}
                      onChange={(e) => updateEscalation(selectedEscalation.id, { status: e.target.value })}
                      disabled={actionLoading}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="escalated">Nouvelle</option>
                      <option value="in_progress">En cours</option>
                      <option value="resolved">Résolue</option>
                    </select>
                    
                    <select
                      value={selectedEscalation.priority}
                      onChange={(e) => updateEscalation(selectedEscalation.id, { priority: e.target.value })}
                      disabled={actionLoading}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="low">Basse</option>
                      <option value="normal">Normale</option>
                      <option value="high">Haute</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    
                    <Button
                      onClick={() => closeEscalation(selectedEscalation.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      disabled={actionLoading}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Fermer
                    </Button>
                  </div>
                  
                  {/* Infos utilisateur */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-gray-600">
                        <User className="w-4 h-4" />
                        {selectedEscalation.userIdentifier || 'Anonyme'}
                      </span>
                      {selectedEscalation.userEmail && (
                        <a
                          href={`mailto:${selectedEscalation.userEmail}?subject=SIA - Suivi de votre demande`}
                          className="flex items-center gap-1 text-teal-600 hover:underline"
                        >
                          <Mail className="w-4 h-4" />
                          {selectedEscalation.userEmail}
                        </a>
                      )}
                    </div>
                    {selectedEscalation.escalationReason && (
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Raison :</strong> {selectedEscalation.escalationReason}
                      </p>
                    )}
                  </div>
                  
                  {/* Conversation */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Conversation</h3>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                      {selectedEscalation.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-2 rounded-lg text-sm ${
                            msg.role === 'user'
                              ? 'bg-teal-100 ml-8'
                              : 'bg-white mr-8 border'
                          }`}
                        >
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{msg.role === 'user' ? '👤 Utilisateur' : '🤖 SIA'}</span>
                            <span>{formatDate(msg.createdAt)}</span>
                          </div>
                          <p className="text-gray-700">{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Notes admin */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Notes administrateur</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto mb-3">
                      {selectedEscalation.adminNotes.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Aucune note</p>
                      ) : (
                        selectedEscalation.adminNotes.map((note) => (
                          <div key={note.id} className="bg-yellow-50 border-l-4 border-yellow-400 p-2 text-sm">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>{note.createdBy}</span>
                              <span>{formatDate(note.createdAt)}</span>
                            </div>
                            <p className="text-gray-700">{note.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* Ajouter note */}
                    <div className="flex gap-2">
                      <Textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Ajouter une note..."
                        className="flex-1 text-sm"
                        rows={2}
                      />
                      <Button
                        onClick={addNote}
                        disabled={!newNote.trim() || actionLoading}
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 text-center text-gray-500 h-full flex items-center justify-center">
                  <div>
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Sélectionnez une escalade pour voir les détails</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  )
}
