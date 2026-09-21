import path from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
 root:import.meta.dirname,publicDir:false,
 plugins:[react(),tailwindcss(),{name:'no-customer-api',configureServer(server){server.middlewares.use('/api',(_req,res)=>{res.statusCode=503;res.end('Isolated UI fixtures: no API.');});}}],
 resolve:{alias:{'@':path.resolve(import.meta.dirname,'../../src')}},
 server:{host:'127.0.0.1',port:4351,strictPort:true,fs:{allow:[path.resolve(import.meta.dirname,'../..')]},headers:{'Content-Security-Policy':"connect-src 'self' ws://127.0.0.1:4351; form-action 'none'"}},
});
