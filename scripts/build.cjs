const fs = require('node:fs');
const path = require('node:path');
(async()=>{
  const {createPackage}=await import('@electron/asar');
  const root=path.join(__dirname,'..');
  fs.mkdirSync(path.join(root,'dist'),{recursive:true});
  await createPackage(path.join(root,'app'),path.join(root,'dist','app.asar'));
  console.log('Created dist/app.asar (Electron application archive, not an installer).');
})().catch(error=>{console.error(error);process.exitCode=1;});
