const { execSync } = require('child_process');

console.log('🔍 Test de compilation Angular...');

try {
  // Essayer une compilation sans servir
  const output = execSync('ng build --configuration development', { 
    encoding: 'utf8',
    cwd: '.',
    timeout: 120000 // 2 minutes max
  });
  
  console.log('✅ Compilation réussie !');
  console.log(output);
} catch (error) {
  console.log('❌ Erreurs de compilation détectées :');
  console.log(error.stdout || error.message);
  
  // Extraire les erreurs spécifiques
  const output = error.stdout || error.message;
  if (output.includes('TS2339')) {
    console.log('\n🔧 Erreurs de propriétés manquantes détectées (TS2339)');
  }
  if (output.includes('showUpdateSuccess')) {
    console.log('🔧 Méthode showUpdateSuccess manquante');
  }
  if (output.includes('@use rules must be written before')) {
    console.log('🔧 Problème d\'ordre des imports Sass');
  }
}
