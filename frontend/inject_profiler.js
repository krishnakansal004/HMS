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
        
        // Skip if already injected
        if (code.includes('useProfileRender')) return;
        
        const componentName = path.basename(file, '.jsx');
        
        // Find default export function
        // Case 1: export default function ComponentName(...) {
        const regex1 = new RegExp(`export\\s+default\\s+function\\s+(${componentName})\\s*\\((.*?)\\)\\s*\\{`, 'g');
        
        // Case 2: function ComponentName(...) { ... export default ComponentName
        const regex2 = new RegExp(`function\\s+(${componentName})\\s*\\((.*?)\\)\\s*\\{`, 'g');
        
        let modified = false;
        let relativePath = dir.includes('director') ? '../../utils/profiler' : '../utils/profiler';
        const importStatement = `import { useProfileRender } from '${relativePath}';\n`;
        
        if (regex1.test(code)) {
            code = importStatement + code.replace(regex1, `export default function $1($2) {\n    useProfileRender('$1', true);`);
            modified = true;
        } else if (regex2.test(code)) {
            code = importStatement + code.replace(regex2, `function $1($2) {\n    useProfileRender('$1', true);`);
            modified = true;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, code, 'utf8');
            console.log(`[PROFILER] Injected into ${componentName} (${file})`);
        }
    });
});
