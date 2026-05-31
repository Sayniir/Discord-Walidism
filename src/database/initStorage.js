/**
 * Script d'initialisation du bucket Supabase Storage pour les transcripts.
 * À exécuter une seule fois : node src/database/initStorage.js
 */
require('dotenv').config();
const supabase = require('./supabase');

async function initStorage() {
    console.log('[Storage] Vérification du bucket "transcripts"...');

    // Vérifier si le bucket existe déjà
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
        console.error('[Storage] ❌ Erreur listage buckets:', listError.message);
        console.log('[Storage] ℹ️  Vous devez créer le bucket manuellement depuis le dashboard Supabase :');
        console.log('[Storage]    1. Allez sur https://supabase.com/dashboard/project/vxvfckpdjzewydmbuljo/storage/buckets');
        console.log('[Storage]    2. Cliquez sur "New bucket"');
        console.log('[Storage]    3. Nom: transcripts');
        console.log('[Storage]    4. Public: OUI (cochez "Public bucket")');
        console.log('[Storage]    5. Cliquez sur "Create bucket"');
        process.exit(1);
    }

    const exists = buckets.some(b => b.name === 'transcripts');
    if (exists) {
        console.log('[Storage] ✅ Bucket "transcripts" existe déjà.');
        console.log('[Storage] ✅ Configuration terminée.');
        process.exit(0);
    }

    console.log('[Storage] ℹ️  Le bucket "transcripts" n\'existe pas.');
    console.log('[Storage] ℹ️  Créez-le manuellement depuis le dashboard Supabase :');
    console.log('[Storage]    1. Allez sur https://supabase.com/dashboard/project/vxvfckpdjzewydmbuljo/storage/buckets');
    console.log('[Storage]    2. Cliquez sur "New bucket"');
    console.log('[Storage]    3. Nom: transcripts');
    console.log('[Storage]    4. Public: OUI (cochez "Public bucket")');
    console.log('[Storage]    5. Cliquez sur "Create bucket"');
    console.log('[Storage]    6. Relancez ce script pour vérifier.');
    process.exit(0);
}

initStorage();
