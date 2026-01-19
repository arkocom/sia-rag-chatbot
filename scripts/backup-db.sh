#!/bin/bash
# =============================================================================
# Script de Backup PostgreSQL pour SIA
# Conforme aux recommandations Databasus pour Disaster Recovery
# =============================================================================

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-sia_database}"
DB_USER="${DB_USER:-sia_user}"
BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/rag_islamique/backups}"
RETENTION_DAYS_DAILY=7
RETENTION_DAYS_WEEKLY=30
RETENTION_DAYS_MONTHLY=365

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Fonctions utilitaires
log_info() { echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }

# Créer les répertoires de backup
mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly}

# =============================================================================
# BACKUP JOURNALIER
# =============================================================================
backup_daily() {
    log_info "Démarrage du backup journalier..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/daily/sia_daily_${TIMESTAMP}.dump"
    
    # Backup compressé avec pg_dump
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -Fc \
        -Z9 \
        -f "$BACKUP_FILE"
    
    # Vérifier le fichier
    if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_info "Backup journalier créé: $BACKUP_FILE ($SIZE)"
    else
        log_error "Échec du backup journalier!"
        exit 1
    fi
    
    # Export JSON des données (pour portabilité)
    JSON_FILE="$BACKUP_DIR/daily/sia_data_${TIMESTAMP}.json"
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "COPY (SELECT row_to_json(t) FROM (SELECT * FROM document_chunks) t) TO STDOUT" \
        > "$JSON_FILE" 2>/dev/null || log_warn "Export JSON non disponible"
    
    # Nettoyage des anciens backups journaliers
    find "$BACKUP_DIR/daily" -name "*.dump" -mtime +$RETENTION_DAYS_DAILY -delete
    find "$BACKUP_DIR/daily" -name "*.json" -mtime +$RETENTION_DAYS_DAILY -delete
    
    log_info "Backup journalier terminé avec succès"
}

# =============================================================================
# BACKUP HEBDOMADAIRE (Dimanche)
# =============================================================================
backup_weekly() {
    if [ "$(date +%u)" = "7" ]; then
        log_info "Démarrage du backup hebdomadaire..."
        
        TIMESTAMP=$(date +%Y%m%d)
        BACKUP_FILE="$BACKUP_DIR/weekly/sia_weekly_${TIMESTAMP}.dump"
        
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -Fc \
            -Z9 \
            -f "$BACKUP_FILE"
        
        # Nettoyage
        find "$BACKUP_DIR/weekly" -name "*.dump" -mtime +$RETENTION_DAYS_WEEKLY -delete
        
        log_info "Backup hebdomadaire terminé: $BACKUP_FILE"
    fi
}

# =============================================================================
# BACKUP MENSUEL (1er du mois)
# =============================================================================
backup_monthly() {
    if [ "$(date +%d)" = "01" ]; then
        log_info "Démarrage du backup mensuel..."
        
        TIMESTAMP=$(date +%Y%m)
        BACKUP_FILE="$BACKUP_DIR/monthly/sia_monthly_${TIMESTAMP}.dump"
        
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -Fc \
            -Z9 \
            -f "$BACKUP_FILE"
        
        # Chiffrement du backup mensuel (optionnel)
        if command -v gpg &> /dev/null && [ -n "$GPG_KEY_ID" ]; then
            gpg --encrypt --recipient "$GPG_KEY_ID" "$BACKUP_FILE"
            rm "$BACKUP_FILE"
            log_info "Backup mensuel chiffré: ${BACKUP_FILE}.gpg"
        fi
        
        # Nettoyage
        find "$BACKUP_DIR/monthly" -name "*.dump*" -mtime +$RETENTION_DAYS_MONTHLY -delete
        
        log_info "Backup mensuel terminé"
    fi
}

# =============================================================================
# RESTAURATION
# =============================================================================
restore_backup() {
    BACKUP_FILE="$1"
    
    if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
        log_error "Fichier de backup non trouvé: $BACKUP_FILE"
        exit 1
    fi
    
    log_warn "ATTENTION: Cette opération va écraser la base de données actuelle!"
    read -p "Continuer? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        log_info "Restauration annulée"
        exit 0
    fi
    
    log_info "Restauration en cours depuis: $BACKUP_FILE"
    
    PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        "$BACKUP_FILE"
    
    log_info "Restauration terminée avec succès"
}

# =============================================================================
# VÉRIFICATION DE L'INTÉGRITÉ
# =============================================================================
verify_backup() {
    BACKUP_FILE="$1"
    
    if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
        log_error "Fichier de backup non trouvé: $BACKUP_FILE"
        exit 1
    fi
    
    log_info "Vérification de l'intégrité: $BACKUP_FILE"
    
    # Vérifier que le fichier peut être lu
    pg_restore -l "$BACKUP_FILE" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        log_info "✅ Backup valide et intègre"
    else
        log_error "❌ Backup corrompu ou invalide!"
        exit 1
    fi
}

# =============================================================================
# UPLOAD VERS S3 (Optionnel)
# =============================================================================
upload_to_s3() {
    if command -v aws &> /dev/null && [ -n "$S3_BUCKET" ]; then
        log_info "Upload vers S3: $S3_BUCKET"
        aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/sia-backups/" --exclude "*.tmp"
        log_info "Upload S3 terminé"
    else
        log_warn "AWS CLI non configuré ou S3_BUCKET non défini"
    fi
}

# =============================================================================
# MAIN
# =============================================================================
case "${1:-daily}" in
    daily)
        backup_daily
        backup_weekly
        backup_monthly
        upload_to_s3
        ;;
    weekly)
        backup_weekly
        ;;
    monthly)
        backup_monthly
        ;;
    restore)
        restore_backup "$2"
        ;;
    verify)
        verify_backup "$2"
        ;;
    *)
        echo "Usage: $0 {daily|weekly|monthly|restore <file>|verify <file>}"
        exit 1
        ;;
esac

log_info "Script terminé"
