import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('deliverables',{recursive:true});
const js=await readFile('offline-build/milo.js','utf8'),css=await readFile('offline-build/milo.css','utf8');
const favicon=await readFile('public/favicon.svg','utf8');
await writeFile('deliverables/Milo.html',`<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Milo · Orbia Systems</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><style>${css.replaceAll('</style','<\\/style')}</style></head><body><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`);
console.log('deliverables/Milo.html créé, autonome, sans dépendance réseau.');
