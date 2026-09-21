import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
 resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
 define:{'process.env.NODE_ENV':JSON.stringify('production')},
 build:{outDir:'offline-build',emptyOutDir:true,lib:{entry:'standalone/main.tsx',name:'Milo',formats:['iife'],fileName:()=> 'milo.js',cssFileName:'milo'},cssCodeSplit:false},
});
