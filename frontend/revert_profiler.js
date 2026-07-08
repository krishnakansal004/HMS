import fs from 'fs';
import path from 'path';

const searchDirs = [
    'c:/Users/manik/Desktop/HMS-main/HMS-main/frontend/src/pages',
    'c:/Users/manik/Desktop/HMS-main/HMS-main/frontend/src/pages/director'
];

searchDirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        if (!file.endsWith('.jsx')) return;
        const filePath = path.join(dir, file);
        let code = fs.readFileSync(filePath, 'utf8');
        
        // Skip if not injected
        if (!code.includes('useProfileRender')) return;
        
        const componentName = path.basename(file, '.jsx');
        
        // Clean imports
        code = code.replace(/import\s+\{\s*useProfileRender\s*\}\s+from\s+['"].*?['"];?\n?/g, '');
        
        // Clean hook calls
        code = code.replace(/\s*useProfileRender\s*\(\s*['"][a-zA-Z0-9_]+['"]\s*,\s*true\s*\);?\n?/g, '');
        
        fs.writeFileSync(filePath, code, 'utf8');
        console.log(`[PROFILER] Reverted ${componentName} (${file})`);
    });
});
